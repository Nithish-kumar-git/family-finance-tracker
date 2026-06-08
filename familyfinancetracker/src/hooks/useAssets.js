/**
 * useAssets — store-first asset loading.
 * Uses localStorage data if available so user edits survive refresh.
 * Only fetches from API if store is empty (first load or after reset).
 */
import { useCallback } from 'react'
import useStore from '../store/useStore'

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

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

    // If store already has data from localStorage, use it.
    // Never overwrite user-edited data with server seed data.
    const storeHasData =
      (s.fixedDeposits?.length ?? 0) > 0 ||
      (s.mutualFunds?.length ?? 0) > 0 ||
      (s.licPolicies?.length ?? 0) > 0 ||
      (s.chitFunds?.length ?? 0) > 0

    if (storeHasData) {
      return {
        fixedDeposits: s.fixedDeposits ?? [],
        mutualFunds:   s.mutualFunds   ?? [],
        licPolicies:   s.licPolicies   ?? [],
        chitFunds:     s.chitFunds     ?? [],
      }
    }

    // Store is empty — first time load. Fetch from Supabase.
    try {
      const [fds, mfs, lics, chits] = await Promise.all([
        fetch(`${BASE}/api/assets/fixeddeposits`).then(r => r.json()),
        fetch(`${BASE}/api/assets/mutualfunds`).then(r => r.json()),
        fetch(`${BASE}/api/assets/lic`).then(r => r.json()),
        fetch(`${BASE}/api/assets/chitfunds`).then(r => r.json()),
      ])
      const result = {
        fixedDeposits: toCamel(Array.isArray(fds)   ? fds   : []),
        mutualFunds:   toCamel(Array.isArray(mfs)   ? mfs   : []),
        licPolicies:   toCamel(Array.isArray(lics)  ? lics  : []),
        chitFunds:     toCamel(Array.isArray(chits) ? chits : []),
      }
      useStore.setState(result)
      return result
    } catch {
      return {
        fixedDeposits: [],
        mutualFunds:   [],
        licPolicies:   [],
        chitFunds:     [],
      }
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
