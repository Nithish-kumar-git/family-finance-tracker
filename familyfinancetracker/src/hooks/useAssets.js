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
    // PRIORITY: use Zustand store (localStorage) if it has data.
    // Only fetch from API if store is completely empty.
    // This preserves user edits across page refreshes.
    const storeState = useStore.getState()
    
    const storeHasData =
      (storeState.fixedDeposits?.length ?? 0) > 0 ||
      (storeState.mutualFunds?.length ?? 0) > 0 ||
      (storeState.licPolicies?.length ?? 0) > 0 ||
      (storeState.chitFunds?.length ?? 0) > 0

    if (storeHasData) {
      // Return store data directly — no API call needed
      return {
        fixedDeposits: storeState.fixedDeposits ?? [],
        mutualFunds:   storeState.mutualFunds ?? [],
        licPolicies:   storeState.licPolicies ?? [],
        chitFunds:     storeState.chitFunds ?? [],
      }
    }

    // Store is empty — first time load, fetch from API
    try {
      const data = await api.assets.getAll()
      
      const fixedDeposits = data.fixedDeposits ?? []
      const mutualFunds = data.mutualFunds ?? []
      const licPolicies = data.licPolicies ?? []
      const chitFunds = data.chitFunds ?? []
      
      // Save API response to store so future loads use store
      useStore.setState({ fixedDeposits, mutualFunds, licPolicies, chitFunds })
      
      return { fixedDeposits, mutualFunds, licPolicies, chitFunds }
    } catch {
      // API also failed — return seed data from store as final fallback
      return {
        fixedDeposits: storeState.fixedDeposits ?? [],
        mutualFunds:   storeState.mutualFunds ?? [],
        licPolicies:   storeState.licPolicies ?? [],
        chitFunds:     storeState.chitFunds ?? [],
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
