// useExpenses — custom hook for expense data access and mutations.
// All API calls go through api.* from utils/api.js.
// All store mutations go through Zustand actions — never direct localStorage writes.

import { addMonths, format, startOfMonth } from 'date-fns'
import { api } from '../utils/api.js'
import useStore from '../store/useStore.js'

// All 10 valid category keys
const ALL_CATEGORIES = [
  'groceries',
  'utilities',
  'medical',
  'transport',
  'household',
  'lic_premium',
  'chit_contribution',
  'personal',
  'education',
  'other',
]

// Safe UUID generator with fallback for environments where crypto.randomUUID
// is unavailable (e.g. non-HTTPS in some mobile browsers).
function generateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

export const useExpenses = () => {
  // ── getExpensesForMonth ────────────────────────────────────────────────────
  // Calls api.expenses.getByMonth and normalises the two possible response
  // shapes into { expenses, categoryTotals }.
  // On error: returns { expenses: [], categoryTotals: {} }.

  const getExpensesForMonth = async (year, month, userId = null) => {
    try {
      const result = await api.expenses.getByMonth(year, month, userId)

      // Response shape A (online): { expenses: [...], category_totals: {...} }
      if (result && Array.isArray(result.expenses)) {
        const categoryTotals = {}
        ALL_CATEGORIES.forEach(k => {
          categoryTotals[k] = result.category_totals?.[k] ?? 0
        })
        return { expenses: result.expenses, categoryTotals }
      }

      // Response shape B (offline fallback): raw array
      const raw = Array.isArray(result) ? result : []
      const categoryTotals = getTotalByCategory(raw)
      return { expenses: raw, categoryTotals }
    } catch {
      return { expenses: [], categoryTotals: {} }
    }
  }

  // ── getTotalByCategory ─────────────────────────────────────────────────────
  // Pure function. Returns an object with all 10 category keys, defaulting to 0.

  const getTotalByCategory = (expensesArray) => {
    const totals = {}
    ALL_CATEGORIES.forEach(k => { totals[k] = 0 })
    if (!Array.isArray(expensesArray)) return totals
    expensesArray.forEach(e => {
      if (totals[e.category] !== undefined) {
        totals[e.category] += e.amount
      } else {
        totals.other = (totals.other ?? 0) + e.amount
      }
    })
    return totals
  }

  // ── getMonthlyTotal ────────────────────────────────────────────────────────
  // Pure function. Sums all amount values.

  const getMonthlyTotal = (expensesArray) => {
    if (!Array.isArray(expensesArray)) return 0
    return expensesArray.reduce((sum, e) => sum + (e.amount ?? 0), 0)
  }

  // ── addExpense ─────────────────────────────────────────────────────────────
  // Validates and normalises expenseData, then calls api.expenses.add().
  // On success: stores via Zustand and handles recurring expansion.
  // On failure: throws so the caller (Expenses.jsx) can show a toast.

  const addExpense = async (expenseData) => {
    // Build the full, normalised expense object
    const today = new Date().toISOString().split('T')[0]
    const fullExpense = {
      id: generateId(),
      userId: expenseData.userId ?? null,
      amount: typeof expenseData.amount === 'string'
        ? parseInt(expenseData.amount, 10)
        : expenseData.amount,
      category: expenseData.category ?? 'other',
      description: (expenseData.description ?? '').slice(0, 60),
      date: expenseData.date || today,
      isRecurring: Boolean(expenseData.isRecurring),
    }

    // Save primary expense — throw on failure so caller shows toast
    await api.expenses.add(fullExpense)
    useStore.getState().addExpense(fullExpense)

    // If recurring, save 3 more on the 1st of the next 3 months
    if (fullExpense.isRecurring) {
      for (let i = 1; i <= 3; i++) {
        const nextDate = format(
          startOfMonth(addMonths(new Date(fullExpense.date), i)),
          'yyyy-MM-dd'
        )
        const recurringExpense = {
          ...fullExpense,
          id: generateId(),
          date: nextDate,
        }
        try {
          await api.expenses.add(recurringExpense)
          useStore.getState().addExpense(recurringExpense)
        } catch {
          // Silently skip — do not roll back the primary expense
        }
      }
    }

    return fullExpense
  }

  // ── deleteExpense ──────────────────────────────────────────────────────────
  // Calls api.expenses.remove(id) FIRST.
  // Only deletes from store on confirmed success.
  // Throws on failure — caller shows toast, store is untouched.

  const deleteExpense = async (id) => {
    const result = await api.expenses.remove(id)
    // The API returns { deleted: true } on success, or throws
    if (result && (result.deleted === true || result)) {
      useStore.getState().deleteExpense(id)
      return true
    }
    throw new Error('Delete failed')
  }

  return {
    getExpensesForMonth,
    getTotalByCategory,
    getMonthlyTotal,
    addExpense,
    deleteExpense,
  }
}
