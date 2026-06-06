// Fetch wrapper for all backend API calls with automatic localStorage/Zustand
// fallback when the backend is unreachable.

import useStore from '../store/useStore.js'

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

// ── Internal fetch helper ──────────────────────────────────────────────────

async function apiFetch(path, options = {}) {
  const url = BASE_URL + path
  const method = (options.method ?? 'GET').toUpperCase()

  const config = {
    ...options,
    headers: {
      ...(method !== 'GET' ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers ?? {}),
    },
  }

  let response
  try {
    response = await fetch(url, config)
  } catch {
    // Network error — backend unreachable
    useStore.getState().setIsOffline(true)
    throw new Error('Network error')
  }

  if (!response.ok) {
    useStore.getState().setIsOffline(true)
    throw new Error(`HTTP ${response.status}`)
  }

  useStore.getState().setIsOffline(false)
  return response.json()
}

// ── API namespace ──────────────────────────────────────────────────────────

export const api = {

  // ── Expenses ─────────────────────────────────────────────────────────

  expenses: {
    async getByMonth(year, month, userId) {
      const mm = String(month).padStart(2, '0')
      const prefix = `${year}-${mm}`
      try {
        const params = new URLSearchParams({ month: prefix })
        if (userId) params.append('userId', userId)
        return await apiFetch(`/api/expenses?${params}`)
      } catch {
        const store = useStore.getState()
        const filtered = store.expenses.filter(e => e.date.startsWith(prefix))
        const byUserId = userId ? filtered.filter(e => e.userId === userId) : filtered
        // Build category_totals locally
        const category_totals = {}
        byUserId.forEach(e => {
          category_totals[e.category] = (category_totals[e.category] ?? 0) + e.amount
        })
        return { expenses: byUserId, category_totals }
      }
    },

    async add(expense) {
      try {
        return await apiFetch('/api/expenses', {
          method: 'POST',
          body: JSON.stringify(expense),
        })
      } catch {
        useStore.getState().addExpense(expense)
        return expense
      }
    },

    async remove(id) {
      try {
        return await apiFetch(`/api/expenses/${id}`, { method: 'DELETE' })
      } catch {
        useStore.getState().deleteExpense(id)
        return { deleted: true }
      }
    },
  },

  // ── Assets ───────────────────────────────────────────────────────────

  assets: {
    async getSummary() {
      try {
        return await apiFetch('/api/assets/summary')
      } catch {
        const s = useStore.getState()
        const fds = s.fixedDeposits.reduce((sum, fd) => sum + fd.principal, 0)
        const mutual_funds = s.mutualFunds.reduce((sum, mf) => sum + mf.currentValue, 0)
        const gold = s.gold.weightGrams * s.gold.currentValuePerGram
        return { fds, mutual_funds, gold, total: fds + mutual_funds + gold }
      }
    },

    async getAll() {
      try {
        const [fixedDeposits, mutualFunds, licPolicies, chitFunds] =
          await Promise.all([
            apiFetch('/api/assets/fixeddeposits'),
            apiFetch('/api/assets/mutualfunds'),
            apiFetch('/api/assets/lic'),
            apiFetch('/api/assets/chitfunds'),
          ])
        return { fixedDeposits, mutualFunds, licPolicies, chitFunds }
      } catch {
        const s = useStore.getState()
        return {
          fixedDeposits: s.fixedDeposits,
          mutualFunds: s.mutualFunds,
          licPolicies: s.licPolicies,
          chitFunds: s.chitFunds,
        }
      }
    },

    async updateGold(goldData) {
      try {
        return await apiFetch('/api/assets/gold', {
          method: 'PATCH',
          body: JSON.stringify(goldData),
        })
      } catch {
        useStore.getState().updateGold(goldData)
        return goldData
      }
    },

    async markLICPaid(id) {
      try {
        return await apiFetch(`/api/assets/lic/${id}/mark-paid`, {
          method: 'PATCH',
        })
      } catch {
        useStore.getState().markLICPaid(id)
        return useStore.getState().licPolicies.find(l => l.id === id)
      }
    },

    async updateMFValue(id, currentValue) {
      try {
        return await apiFetch(`/api/assets/mutualfunds/${id}/update-value`, {
          method: 'PATCH',
          body: JSON.stringify({ currentValue }),
        })
      } catch {
        useStore.getState().updateMutualFundValue(id, currentValue)
        return useStore.getState().mutualFunds.find(m => m.id === id)
      }
    },
  },

  // ── Milestones ────────────────────────────────────────────────────────

  milestones: {
    async getAll(filters = {}) {
      try {
        const params = new URLSearchParams()
        if (filters.status) params.append('status', filters.status)
        if (filters.upcoming_days != null)
          params.append('upcoming_days', filters.upcoming_days)
        const qs = params.toString()
        return await apiFetch(`/api/milestones${qs ? '?' + qs : ''}`)
      } catch {
        const milestones = useStore.getState().milestones
        if (filters.status) {
          return milestones.filter(m => m.status === filters.status)
        }
        return milestones
      }
    },

    async updateStatus(id, status) {
      try {
        return await apiFetch(`/api/milestones/${id}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ status }),
        })
      } catch {
        useStore.getState().updateMilestoneStatus(id, status)
        return useStore.getState().milestones.find(m => m.id === id)
      }
    },

    async add(milestone) {
      try {
        return await apiFetch('/api/milestones', {
          method: 'POST',
          body: JSON.stringify(milestone),
        })
      } catch {
        const newMilestone = { ...milestone, id: milestone.id ?? crypto.randomUUID() }
        useStore.getState().updateMilestoneStatus // no direct add action — push via store workaround
        // Fallback: use store subscribe to add via setState manually
        useStore.setState(state => ({
          milestones: [...state.milestones, newMilestone],
        }))
        return newMilestone
      }
    },

    async remove(id) {
      try {
        return await apiFetch(`/api/milestones/${id}`, { method: 'DELETE' })
      } catch {
        useStore.setState(state => ({
          milestones: state.milestones.filter(m => m.id !== id),
        }))
        return { deleted: true }
      }
    },
  },

  // ── Employment ────────────────────────────────────────────────────────

  employment: {
    async getAll() {
      try {
        return await apiFetch('/api/employment')
      } catch {
        return useStore.getState().jobApplications
      }
    },

    async add(application) {
      try {
        return await apiFetch('/api/employment', {
          method: 'POST',
          body: JSON.stringify(application),
        })
      } catch {
        useStore.getState().addJobApplication(application)
        return application
      }
    },

    async updateStatus(id, status) {
      try {
        return await apiFetch(`/api/employment/${id}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ status }),
        })
      } catch {
        useStore.getState().updateJobStatus(id, status)
        return useStore.getState().jobApplications.find(j => j.id === id)
      }
    },

    async getStats() {
      try {
        return await apiFetch('/api/employment/stats')
      } catch {
        const apps = useStore.getState().jobApplications
        const total = apps.length
        const sevenDaysAgo = new Date()
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
        const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0]
        const this_week = apps.filter(a => a.appliedDate >= sevenDaysAgoStr).length
        const interviews = apps.filter(a =>
          a.status === 'interview_scheduled' || a.status === 'interviewed'
        ).length
        const offers = apps.filter(a => a.status === 'offered').length
        const by_status = apps.reduce((acc, a) => {
          acc[a.status] = (acc[a.status] ?? 0) + 1
          return acc
        }, {})
        const monthCounts = apps.reduce((acc, a) => {
          const m = a.appliedDate.substring(0, 7)
          acc[m] = (acc[m] ?? 0) + 1
          return acc
        }, {})
        const applications_by_month = Object.entries(monthCounts)
          .map(([month, count]) => ({ month, count }))
          .sort((a, b) => a.month.localeCompare(b.month))
        return { total, this_week, interviews, offers, by_status, applications_by_month }
      }
    },
  },

  // ── Reports ───────────────────────────────────────────────────────────

  reports: {
    async getSnapshot(month) {
      try {
        return await apiFetch(`/api/reports/snapshot?month=${month}`)
      } catch {
        return useStore.getState().monthlySnapshots.find(s => s.month === month) ?? null
      }
    },

    async saveSnapshot(snapshot) {
      try {
        return await apiFetch('/api/reports/snapshot', {
          method: 'POST',
          body: JSON.stringify(snapshot),
        })
      } catch {
        useStore.getState().addMonthlySnapshot(snapshot)
        return snapshot
      }
    },

    async getAllSnapshots() {
      try {
        return await apiFetch('/api/reports/snapshots')
      } catch {
        return [...useStore.getState().monthlySnapshots].sort((a, b) =>
          b.month.localeCompare(a.month)
        )
      }
    },
  },

  // ── AI ────────────────────────────────────────────────────────────────

  ai: {
    async parseTransaction(rawText) {
      try {
        return await apiFetch('/api/ai/parse-transaction', {
          method: 'POST',
          body: JSON.stringify({ raw_text: rawText }),
        })
      } catch {
        // AI requires network — do not fall back to local data
        return null
      }
    },

    async getMonthlyInsights(reportJson) {
      try {
        return await apiFetch('/api/ai/monthly-insights', {
          method: 'POST',
          body: JSON.stringify({ report: reportJson }),
        })
      } catch {
        return null
      }
    },

    async chat(question, context, history) {
      try {
        return await apiFetch('/api/ai/chat', {
          method: 'POST',
          body: JSON.stringify({ question, context, history }),
        })
      } catch {
        return null
      }
    },
  },
}
