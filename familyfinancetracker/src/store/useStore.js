import { ensureOriginalPreserved, planRecovery } from '../utils/recordRecovery.js'
import { create } from 'zustand'
import { INITIAL_DATA } from '../data/emptyData.js'
import { dataKey, workspaceMode, workspaceKey, syntheticData, writeWorkspace } from '../utils/workspace.js'

// Load persisted state from localStorage, fall back to INITIAL_DATA
function loadState() {
  try {
    if (workspaceMode === 'personal') ensureOriginalPreserved(localStorage)
    const raw = localStorage.getItem(dataKey)
    if (raw) {
      return { ...INITIAL_DATA, ...JSON.parse(raw), currentUser: null }
    }
  } catch {
    return { ...INITIAL_DATA, currentUser: null, storageReadError: true }
  }
  return { ...INITIAL_DATA, ...(workspaceMode === 'demo' ? syntheticData() : {}), currentUser: null }
}

const useStore = create((set, get) => {
  const save = update => {
    const patch = typeof update === 'function' ? update(get()) : update
    writeWorkspace({ ...get(), ...patch }); set(patch)
  }
  return ({
  ...loadState(),

  // ── Auth ────────────────────────────────────────────────────────────────
  setCurrentUser(userId) {
    set({ currentUser: userId })
    try {
      localStorage.setItem(workspaceKey('fft_currentUser'), userId ?? '')
    } catch {
      // ignore localStorage write failures (private browsing, quota exceeded)
    }
  },

  // ── Expenses ──────────────────────────────────────────────────────────
  addExpense(expense) {
    save(state => ({ expenses: [...state.expenses.filter(row => row.id !== expense.id), expense] }))
  },

  deleteExpense(id) {
    save(state => ({ expenses: state.expenses.filter(e => e.id !== id) }))
  },

  setExpensesForMonth(ym, freshExpenses) {
    // Read responses are not authoritative deletions. Keep missing rows and both conflict versions.
    save(state => {
      const plan = planRecovery(state, { expenses: freshExpenses.filter(row => row.date?.startsWith(ym)) })
      return { ...plan.patch, recoveryConflicts: [...(state.recoveryConflicts ?? []), ...plan.conflicts] }
    })
  },

  // ── Budgets ───────────────────────────────────────────────────────────
  updateBudget(category, amount) {
    save(state => ({ budgets: { ...state.budgets, [category]: amount } }))
  },

  // ── Milestones ────────────────────────────────────────────────────────
  updateMilestoneStatus(id, status) {
    save(state => ({
      milestones: state.milestones.map(m =>
        m.id === id ? { ...m, status } : m
      ),
    }))
  },

  // ── Job Applications ──────────────────────────────────────────────────
  addJobApplication(application) {
    save(state => ({ jobApplications: [...state.jobApplications.filter(row => row.id !== application.id), application] }))
  },

  updateJobStatus(id, status) {
    save(state => ({
      jobApplications: state.jobApplications.map(j =>
        j.id === id ? { ...j, status } : j
      ),
    }))
  },

  // ── Assets ────────────────────────────────────────────────────────────
  updateMutualFundValue(id, currentValue) {
    save(state => ({
      mutualFunds: state.mutualFunds.map(mf =>
        mf.id === id ? { ...mf, currentValue } : mf
      ),
    }))
  },

  markLICPaid(id) {
    save(state => ({
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
    save(state => ({ gold: { ...state.gold, ...goldData } }))
  },

  // ── UI state ──────────────────────────────────────────────────────────
  setIsOffline(isOffline) {
    set({ isOffline })
  },

  // ── Reports ───────────────────────────────────────────────────────────
  addMonthlySnapshot(snapshot) {
    save(state => {
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
    save(state => ({
      monthlyIncome: { ...state.monthlyIncome, [field]: value },
    }))
  },

  // ── Full Reset ────────────────────────────────────────────────────────
  resetStore() {
    set({ ...INITIAL_DATA, currentUser: null, isOffline: false })
    try {
      localStorage.removeItem(dataKey)
    } catch {
      // ignore
    }
  },
}) })

export function saveLocalChanges(update) {
  const state = useStore.getState(), patch = typeof update === 'function' ? update(state) : update
  writeWorkspace({ ...state, ...patch }); useStore.setState(patch)
}

// Persist state to localStorage after every change
useStore.subscribe(state => {
  try {
    // Exclude isOffline from persistence — it should always start false
    writeWorkspace(state)
    if (state.persistenceError) useStore.setState({ persistenceError: '' })
  } catch {
    if (!state.persistenceError) useStore.setState({ persistenceError: 'Browser storage is unavailable or full. Changes may not survive closing this page. Export a backup before leaving.' })
  }
})

export default useStore

// Explicitly disposable synthetic data only. Neither private storage nor its PIN is inspected.
export function resetDemoWorkspace() {
  if (workspaceMode !== 'demo') throw Error('Demo reset is unavailable in personal mode.')
  const next = { ...INITIAL_DATA, ...syntheticData(), currentUser: useStore.getState().currentUser,
    storageReadError: false, persistenceError: '', recoveryConflicts: [], recoveryStatus: null }
  writeWorkspace(next)
  useStore.setState(next)
  try { localStorage.removeItem(workspaceKey('fft_nithish_status')) } catch { /* Financial records already saved. */ }
}
