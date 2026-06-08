// Hook for loading and computing asset data.
// Primary data source: api.assets.getAll()
// Fallback (offline): Zustand store fields.
import { useCallback } from 'react'

import { api } from '../utils/api'
import { daysUntil } from '../utils/formatters'
import useStore from '../store/useStore'

export const useAssets = () => {
  /**
   * loadAssets — fetch all 4 asset types from the backend.
   * Falls back to store data if the API is unreachable.
   */
  const loadAssets = useCallback(async () => {
    const fromApi = (obj) => {
      if (!obj || typeof obj !== 'object') return obj
      if (Array.isArray(obj)) return obj.map(fromApi)
      return Object.fromEntries(
        Object.entries(obj).map(([k, v]) => [
          k.replace(/_([a-z])/g, (_, c) => c.toUpperCase()),
          Array.isArray(v) ? v.map(i =>
            typeof i === 'object' ? fromApi(i) : i) : v,
        ])
      )
    }

    const BASE_URL = typeof import.meta !== 'undefined'
      ? (import.meta.env?.VITE_API_URL ?? 'http://localhost:8000')
      : 'http://localhost:8000'

    try {
      const [fds, mfs, lics, chits] = await Promise.all([
        fetch(`${BASE_URL}/api/assets/fixeddeposits`).then(r => r.json()),
        fetch(`${BASE_URL}/api/assets/mutualfunds`).then(r => r.json()),
        fetch(`${BASE_URL}/api/assets/lic`).then(r => r.json()),
        fetch(`${BASE_URL}/api/assets/chitfunds`).then(r => r.json()),
      ])
      const result = {
        fixedDeposits: fromApi(fds),
        mutualFunds: fromApi(mfs),
        licPolicies: fromApi(lics),
        chitFunds: fromApi(chits),
      }
      // Save to store so localStorage is always in sync with server
      useStore.setState(result)
      return result
    } catch {
      // API unreachable — use localStorage data
      const s = useStore.getState()
      return {
        fixedDeposits: s.fixedDeposits ?? [],
        mutualFunds: s.mutualFunds ?? [],
        licPolicies: s.licPolicies ?? [],
        chitFunds: s.chitFunds ?? [],
      }
    }
  }, [])

  /**
   * getTotalCorpus — pure function, no API call.
   * Computes totals from the provided data.
   */
  const getTotalCorpus = (fixedDeposits, mutualFunds, gold) => {
    const fds = fixedDeposits.reduce((sum, fd) => sum + fd.principal, 0)
    const mfs = mutualFunds.reduce((sum, mf) => sum + mf.currentValue, 0)
    const goldTotal = gold.weightGrams * gold.currentValuePerGram
    return {
      fds,
      mfs,
      gold: goldTotal,
      total: fds + mfs + goldTotal,
    }
  }

  /**
   * getUpcomingFDMaturities — pure function.
   * Returns FDs maturing within `days` days, sorted ascending.
   */
  const getUpcomingFDMaturities = (fixedDeposits, days = 90) => {
    return fixedDeposits
      .filter((fd) => {
        const d = daysUntil(fd.maturityDate)
        return d !== null && d >= 0 && d <= days
      })
      .sort(
        (a, b) => new Date(a.maturityDate) - new Date(b.maturityDate)
      )
  }

  /**
   * getUpcomingLICDues — pure function.
   * Returns LIC policies due within `days` days, sorted ascending.
   */
  const getUpcomingLICDues = (licPolicies, days = 60) => {
    return licPolicies
      .filter((lic) => {
        const d = daysUntil(lic.nextDueDate)
        return d !== null && d >= 0 && d <= days
      })
      .sort(
        (a, b) => new Date(a.nextDueDate) - new Date(b.nextDueDate)
      )
  }

  return { loadAssets, getTotalCorpus, getUpcomingFDMaturities, getUpcomingLICDues }
}
