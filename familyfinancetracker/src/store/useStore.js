import { create } from 'zustand'
import { INITIAL_DATA } from '../data/seedData.js'

// Load persisted state from localStorage, fall back to INITIAL_DATA
function loadState() {
  try {
    const raw = localStorage.getItem('fft_data')
    if (raw) {
      return JSON.parse(raw)
    }
  } catch {
    // JSON parse error or localStorage not available — use initial data
  }
  return { ...INITIAL_DATA }
}

const useStore = create((set, get) => ({
  ...loadState(),

  // ── Auth ────────────────────────────────────────────────────────────────
  setCurrentUser(userId) {
    set({ currentUser: userId })
    try {
      localStorage.setItem('fft_currentUser', userId ?? '')
    } catch {
      // ignore localStorage write failures (private browsing, quota exceeded)
    }
  },

  // ── Expenses ──────────────────────────────────────────────────────────
  addExpense(expense) {
    set(state => ({ expenses: [...state.expenses, expense] }))
  },

  deleteExpense(id) {
    set(state => ({ expenses: state.expenses.filter(e => e.id !== id) }))
  },

  // ── Budgets ───────────────────────────────────────────────────────────
  updateBudget(category, amount) {
    set(state => ({ budgets: { ...state.budgets, [category]: amount } }))
  },

  // ── Milestones ────────────────────────────────────────────────────────
  updateMilestoneStatus(id, status) {
    set(state => ({
      milestones: state.milestones.map(m =>
        m.id === id ? { ...m, status } : m
      ),
    }))
  },

  // ── Job Applications ──────────────────────────────────────────────────
  addJobApplication(application) {
    set(state => ({ jobApplications: [...state.jobApplications, application] }))
  },

  updateJobStatus(id, status) {
    set(state => ({
      jobApplications: state.jobApplications.map(j =>
        j.id === id ? { ...j, status } : j
      ),
    }))
  },

  // ── Assets ────────────────────────────────────────────────────────────
  updateMutualFundValue(id, currentValue) {
    set(state => ({
      mutualFunds: state.mutualFunds.map(mf =>
        mf.id === id ? { ...mf, currentValue } : mf
      ),
    }))
  },

  markLICPaid(id) {
    set(state => ({
      licPolicies: state.licPolicies.map(lic => {
        if (lic.id !== id) return lic
        const nextDate = new Date(lic.nextDueDate)
        nextDate.setFullYear(nextDate.getFullYear() + 1)
        return {
          ...lic,
          premiumsPaid: lic.premiumsPaid + 1,
          nextDueDate: nextDate.toISOString().split('T')[0],
        }
      }),
    }))
  },

  updateGold(goldData) {
    set(state => ({ gold: { ...state.gold, ...goldData } }))
  },

  // ── UI state ──────────────────────────────────────────────────────────
  setIsOffline(isOffline) {
    set({ isOffline })
  },

  // ── Reports ───────────────────────────────────────────────────────────
  addMonthlySnapshot(snapshot) {
    set(state => {
      const existingIdx = state.monthlySnapshots.findIndex(
        s => s.month === snapshot.month
      )
      if (existingIdx >= 0) {
        const updated = [...state.monthlySnapshots]
        updated[existingIdx] = snapshot
        return { monthlySnapshots: updated }
      }
      return { monthlySnapshots: [...state.monthlySnapshots, snapshot] }
    })
  },

  updateMonthlyIncome(field, value) {
    set(state => ({
      monthlyIncome: { ...state.monthlyIncome, [field]: value },
    }))
  },

  // ── Full Reset ────────────────────────────────────────────────────────
  resetStore() {
    set({ ...INITIAL_DATA, currentUser: null, isOffline: false })
    try {
      localStorage.removeItem('fft_data')
      localStorage.removeItem('fft_currentUser')
    } catch {
      // ignore
    }
  },
}))

// Persist state to localStorage after every change
useStore.subscribe(state => {
  try {
    // Exclude isOffline from persistence — it should always start false
    const { isOffline: _ignored, ...persistable } = state
    localStorage.setItem('fft_data', JSON.stringify(persistable))
  } catch {
    // localStorage quota exceeded or private browsing — ignore silently
  }
})

export default useStore
