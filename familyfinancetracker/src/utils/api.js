// Fetch wrapper for all backend API calls with automatic localStorage/Zustand
// fallback when the backend is unreachable.

import useStore from '../store/useStore.js'
import { readHistoryMonth } from './expenseHistory.js'
import { readChat } from './ammaChat.js'
import { authorizedFetch } from './authorizedFetch.js'

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
    response = await authorizedFetch(url, config)
  } catch (error) {
    if (error?.code === 'AUTH_REQUIRED') throw error
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
    // Opt-in History contract. Do not use apiFetch: its store setters can
    // trigger persistence. Dashboard continues to use getByMonth unchanged.
    getForHistory(year, month) {
      const prefix = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`
      const params = new URLSearchParams({ month: prefix })
      return readHistoryMonth({
        month: prefix,
        url: `${BASE_URL}/api/expenses?${params}`,
        fetchResponse: url => authorizedFetch(url),
        getLocalExpenses: () => useStore.getState().expenses,
      })
    },

    async getByMonth(year, month, userId) {
      const mm = String(month).padStart(2, '0')
      const prefix = `${year}-${mm}`
      try {
        const params = new URLSearchParams({ month: prefix })
        if (userId) params.append('userId', userId)
        return await apiFetch(`/api/expenses?${params}`)
      } catch (error) {
        if (error?.code === 'AUTH_REQUIRED') throw error
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
      // A failed/unconfirmed POST must not masquerade as a server save.
      // Keep the draft in the form; never retry or upload old local rows here.
      return await apiFetch('/api/expenses', {
        method: 'POST',
        body: JSON.stringify(expense),
      })
    },

    async remove(id) {
      const result = await apiFetch(`/api/expenses/${encodeURIComponent(id)}`, { method: 'DELETE' })
      if (result?.deleted !== true) {
        throw new Error('Server deletion could not be confirmed')
      }
      return result
    },
  },

  // ── Assets ───────────────────────────────────────────────────────────

  assets: {

    // ── Read ──────────────────────────────────────────────────────────

    async getSummary() {
      try {
        return await apiFetch('/api/assets/summary')
      } catch (error) {
        if (error?.code === 'AUTH_REQUIRED') throw error
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
      } catch (error) {
        if (error?.code === 'AUTH_REQUIRED') throw error
        const s = useStore.getState()
        return {
          fixedDeposits: s.fixedDeposits,
          mutualFunds: s.mutualFunds,
          licPolicies: s.licPolicies,
          chitFunds: s.chitFunds,
        }
      }
    },

    // ── Fixed Deposits — throws on failure, caller shows error toast ───

    async createFD(body) {
      return await apiFetch('/api/assets/fixeddeposits', {
        method: 'POST',
        body: JSON.stringify(body),
      })
    },

    async updateFD(id, body) {
      return await apiFetch(`/api/assets/fixeddeposits/${id}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      })
    },

    async deleteFD(id) {
      return await apiFetch(`/api/assets/fixeddeposits/${id}`, { method: 'DELETE' })
    },

    // ── Mutual Funds ──────────────────────────────────────────────────

    /**
     * If investedAmount is also changed, uses PUT (full field update).
     * Otherwise uses PATCH /update-value (currentValue only).
     * Throws on failure — caller shows error toast.
     */
    async updateMutualFundValue(id, currentValue, investedAmount) {
      if (investedAmount !== undefined && investedAmount !== null) {
        return await apiFetch(`/api/assets/mutualfunds/${id}`, {
          method: 'PUT',
          body: JSON.stringify({ currentValue, investedAmount }),
        })
      }
      return await apiFetch(`/api/assets/mutualfunds/${id}/update-value`, {
        method: 'PATCH',
        body: JSON.stringify({ currentValue }),
      })
    },

    // ── LIC ───────────────────────────────────────────────────────────

    async updateLIC(id, body) {
      return await apiFetch(`/api/assets/lic/${id}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      })
    },

    async markLICPaid(id) {
      return await apiFetch(`/api/assets/lic/${id}/mark-paid`, { method: 'PATCH' })
    },

    // ── Chit Funds ────────────────────────────────────────────────────

    async createChit(body) {
      return await apiFetch('/api/assets/chitfunds', {
        method: 'POST',
        body: JSON.stringify(body),
      })
    },

    async updateChit(id, body) {
      return await apiFetch(`/api/assets/chitfunds/${id}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      })
    },

    /** Status-only update — uses PUT with just the status field. */
    async updateChitStatus(id, status) {
      return await apiFetch(`/api/assets/chitfunds/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      })
    },

    async deleteChit(id) {
      return await apiFetch(`/api/assets/chitfunds/${id}`, { method: 'DELETE' })
    },

    // ── Gold ──────────────────────────────────────────────────────────

    async updateGold(goldData) {
      return await apiFetch('/api/assets/gold', {
        method: 'PATCH',
        body: JSON.stringify(goldData),
      })
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
      } catch (error) {
        if (error?.code === 'AUTH_REQUIRED') throw error
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
      } catch (error) {
        if (error?.code === 'AUTH_REQUIRED') throw error
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
      } catch (error) {
        if (error?.code === 'AUTH_REQUIRED') throw error
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
      } catch (error) {
        if (error?.code === 'AUTH_REQUIRED') throw error
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
      } catch (error) {
        if (error?.code === 'AUTH_REQUIRED') throw error
        return useStore.getState().jobApplications
      }
    },

    async add(application) {
      try {
        return await apiFetch('/api/employment', {
          method: 'POST',
          body: JSON.stringify(application),
        })
      } catch (error) {
        if (error?.code === 'AUTH_REQUIRED') throw error
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
      } catch (error) {
        if (error?.code === 'AUTH_REQUIRED') throw error
        useStore.getState().updateJobStatus(id, status)
        return useStore.getState().jobApplications.find(j => j.id === id)
      }
    },

    async getStats() {
      try {
        return await apiFetch('/api/employment/stats')
      } catch (error) {
        if (error?.code === 'AUTH_REQUIRED') throw error
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
      } catch (error) {
        if (error?.code === 'AUTH_REQUIRED') throw error
        return useStore.getState().monthlySnapshots.find(s => s.month === month) ?? null
      }
    },

    async saveSnapshot(snapshot) {
      try {
        return await apiFetch('/api/reports/snapshot', {
          method: 'POST',
          body: JSON.stringify(snapshot),
        })
      } catch (error) {
        if (error?.code === 'AUTH_REQUIRED') throw error
        useStore.getState().addMonthlySnapshot(snapshot)
        return snapshot
      }
    },

    async getAllSnapshots() {
      try {
        return await apiFetch('/api/reports/snapshots')
      } catch (error) {
        if (error?.code === 'AUTH_REQUIRED') throw error
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
      } catch (error) {
        if (error?.code === 'AUTH_REQUIRED') throw error
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
      } catch (error) {
        if (error?.code === 'AUTH_REQUIRED') throw error
        return null
      }
    },

    async chat(question, context, history, { signal } = {}) {
      // Keep the wire contract; surface chat failures to its own UI, not isOffline.
      return readChat({ baseUrl: BASE_URL, question, context, history, signal })
    },
  },
}
