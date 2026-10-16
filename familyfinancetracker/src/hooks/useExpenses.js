// useExpenses — custom hook for expense data access and mutations.
// All API calls go through api.* from utils/api.js.
// All store mutations go through Zustand actions — never direct localStorage writes.

import { addMonths, format, startOfMonth } from 'date-fns'
import { api } from '../utils/api.js'
import useStore from '../store/useStore.js'

// Stable identity for the History effect; the legacy method below is unchanged.
const getHistoryForMonth = month => {
  const [year, number] = month.split('-').map(Number)
  return api.expenses.getForHistory(year, number)
}

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

  const addExpense = async (expenseData, submission = {}) => {
    // Build the full, normalised expense object
    const today = new Date().toISOString().split('T')[0]
    const fullExpense = {
      id: submission.id ?? (submission.id = generateId()),
      userId: expenseData.userId ?? null,
      amount: typeof expenseData.amount === 'string'
        ? parseInt(expenseData.amount, 10)
        : expenseData.amount,
      category: expenseData.category ?? 'other',
      description: (expenseData.description ?? '').slice(0, 60),
      date: expenseData.date || today,
      isRecurring: Boolean(expenseData.isRecurring),
    }

    // Only a matching server acknowledgement may enter the local cache.
    const saveConfirmed = async expense => {
      const saved = await api.expenses.add(expense)
      if (!saved || typeof saved.id !== 'string' || !saved.id.trim()
          || saved.date !== expense.date || saved.userId !== expense.userId
          || saved.amount !== expense.amount || saved.category !== expense.category) {
        throw new Error('Expense save could not be confirmed')
      }
      useStore.getState().addExpense(saved)
      return saved
    }
    const savedExpense = await saveConfirmed(fullExpense)
    const recurringSave = { requested: fullExpense.isRecurring ? 3 : 0, confirmed: 0, unconfirmed: 0 }

    // If recurring, save 3 more on the 1st of the next 3 months
    if (fullExpense.isRecurring) {
      for (let i = 1; i <= 3; i++) {
        try {
          const nextDate = format(
            startOfMonth(addMonths(new Date(fullExpense.date), i)),
            'yyyy-MM-dd'
          )
          const recurringExpense = {
            ...fullExpense,
            id: generateId(),
            date: nextDate,
          }
          await saveConfirmed(recurringExpense)
          recurringSave.confirmed++
        } catch {
          // Primary save stays confirmed; ambiguous child saves are never retried.
          recurringSave.unconfirmed++
        }
      }
    }

    // This status is returned to the UI only, not persisted in financial records.
    return { ...savedExpense, recurringSave }
  }

  // ── deleteExpense ──────────────────────────────────────────────────────────
  // Calls api.expenses.remove(id) FIRST.
  // Only deletes from store on confirmed success.
  // Throws on failure — caller shows toast, store is untouched.

  const deleteExpense = async (id) => {
    const result = await api.expenses.remove(id)
    // The API returns { deleted: true } on success, or throws
    if (result?.deleted === true) {
      useStore.getState().deleteExpense(id)
      return true
    }
    throw new Error('Delete failed')
  }

  return {
    getHistoryForMonth,
    getExpensesForMonth,
    getTotalByCategory,
    getMonthlyTotal,
    addExpense,
    deleteExpense,
  }
}
