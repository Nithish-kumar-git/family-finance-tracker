/**
 * useAssets — store-first asset loading.
 * Uses localStorage data if available so user edits survive refresh.
 * Cloud sync is disconnected; an empty browser is not a verified empty database.
 */
import { useCallback } from 'react'
import useStore from '../store/useStore'


export const toCamel = (obj) => {
  if (obj === null || obj === undefined) return obj
  if (Array.isArray(obj)) return obj.map(toCamel)
  if (typeof obj !== 'object') return obj
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [
      k.replace(/_([a-z])/g, (_, c) => c.toUpperCase()),
      toCamel(v),
    ])
  )
}

export const toSnake = (obj) => {
  if (obj === null || obj === undefined) return obj
  if (Array.isArray(obj)) return obj.map(toSnake)
  if (typeof obj !== 'object') return obj
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [
      k.replace(/[A-Z]/g, c => '_' + c.toLowerCase()),
      toSnake(v),
    ])
  )
}

export function useAssets() {

  const loadAssets = useCallback(async () => {
    const s = useStore.getState()

    // Both workspaces are browser-local. Reads must never replace persisted collections.
    return {
      fixedDeposits: s.fixedDeposits ?? [], mutualFunds: s.mutualFunds ?? [],
      licPolicies: s.licPolicies ?? [], chitFunds: s.chitFunds ?? [],
      loadError: s.storageReadError ? 'Existing browser data could not be read. Asset totals are unavailable; open recovery in Settings.' : '',
    }
  }, [])

  const getTotalCorpus = () => {
    const s = useStore.getState()
    const fds  = (s.fixedDeposits ?? []).reduce((n, fd) => n + (fd.principal ?? 0), 0)
    const mfs  = (s.mutualFunds   ?? []).reduce((n, mf) => n + (mf.currentValue ?? 0), 0)
    const gold = (s.gold?.weightGrams ?? 0) * (s.gold?.currentValuePerGram ?? 0)
    return { fds, mfs, gold, total: fds + mfs + gold }
  }

  const getUpcomingFDMaturities = (fds, days) => {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() + days)
    return (fds ?? []).filter(fd =>
      fd.maturityDate && new Date(fd.maturityDate) <= cutoff
    )
  }

  const getUpcomingLICDues = (lics, days) => {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() + days)
    return (lics ?? []).filter(l =>
      l.nextDueDate && new Date(l.nextDueDate) <= cutoff
    )
  }

  return { loadAssets, getTotalCorpus, getUpcomingFDMaturities, getUpcomingLICDues }
}
