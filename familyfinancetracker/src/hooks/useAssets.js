// Hook for loading and computing asset data.
// Primary data source: api.assets.getAll()
// Fallback (offline): Zustand store fields.

import { api } from '../utils/api'
import { daysUntil } from '../utils/formatters'
import useStore from '../store/useStore'

export const useAssets = () => {
  /**
   * loadAssets — fetch all 4 asset types from the backend.
   * Falls back to store data if the API is unreachable.
   */
  const loadAssets = async () => {
    try {
      const data = await api.assets.getAll()
      return {
        fixedDeposits: data.fixedDeposits ?? [],
        mutualFunds: data.mutualFunds ?? [],
        licPolicies: data.licPolicies ?? [],
        chitFunds: data.chitFunds ?? [],
      }
    } catch {
      const state = useStore.getState()
      return {
        fixedDeposits: state.fixedDeposits,
        mutualFunds: state.mutualFunds,
        licPolicies: state.licPolicies,
        chitFunds: state.chitFunds,
      }
    }
  }

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
