import useStore from '../store/useStore.js'
import { unlockedProfile } from './localLogin.js'
import { writeWorkspace } from './workspace.js'

// Implements the existing UI contracts locally. No fetch, Supabase, or provider calls.
export async function browserRequest(rawUrl, options = {}) {
  const state = useStore.getState()
  const profile = unlockedProfile()
  const response = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, local: true, json: async () => structuredClone(body) })
  if (!profile || !state.users.some(user => user.id === profile)) return response({ detail: 'Unlock a local profile first.' }, 401)
  const url = new URL(rawUrl, window.location.origin), route = url.pathname.replace(/\/$/, '')
  const method = (options.method ?? 'GET').toUpperCase()
  const body = options.body ? JSON.parse(options.body) : {}
  const save = patch => {
    try { writeWorkspace({ ...state, ...patch }) }
    catch { throw Object.assign(Error('Changes could not be saved on this device. Free browser storage and try again.'), { code: 'LOCAL_SAVE_FAILED' }) }
    useStore.setState(patch)
  }
  if (route === '/health') return response({ status: 'ok', storage: 'browser-only', database: 'not contacted' })
  if (route === '/api/reset') return response({ detail: 'Reset is disabled. Your data is unchanged.' }, 403)
  if (route.startsWith('/api/ai/')) {
    return response({ detail: 'AI providers are disconnected in browser workspaces. Enter transactions manually.' }, 503)
  }
  if (route === '/api/settings/income' && method === 'PATCH') {
    if (Object.values(body).some(v => typeof v !== 'number' || !Number.isFinite(v) || v < 0)) return response({}, 422)
    save({ monthlyIncome: { ...state.monthlyIncome, ...body } }); return response(body)
  }
  if (route === '/api/expenses/bulk' && method === 'DELETE') {
    const month = url.searchParams.get('month')
    if (!/^(?!0000)\d{4}-(0[1-9]|1[0-2])$/.test(month ?? '')) return response({}, 422)
    save({ expenses: state.expenses.filter(e => !e.date?.startsWith(month)) }); return response({ deleted: true })
  }
  if (route === '/api/expenses' && method === 'GET') {
    const month = url.searchParams.get('month'), userId = url.searchParams.get('userId')
    const expenses = state.expenses.filter(e => (!month || e.date?.startsWith(month)) && (!userId || e.userId === userId))
    const category_totals = {}; for (const e of expenses) category_totals[e.category] = (category_totals[e.category] ?? 0) + e.amount
    return response({ expenses, category_totals })
  }
  if (route === '/api/assets/gold' && method === 'PATCH') { save({ gold: { ...state.gold, ...body } }); return response({ ...state.gold, ...body }) }
  if (route === '/api/assets/summary') {
    const fds = state.fixedDeposits.reduce((s, x) => s + x.principal, 0), mutual_funds = state.mutualFunds.reduce((s, x) => s + x.currentValue, 0)
    const gold = state.gold.weightGrams * state.gold.currentValuePerGram
    return response({ fds, mutual_funds, gold, total: fds + mutual_funds + gold })
  }
  if (route === '/api/employment/stats') {
    const apps = state.jobApplications, by_status = {}, counts = {}
    for (const app of apps) { by_status[app.status] = (by_status[app.status] ?? 0) + 1; const month = app.appliedDate?.slice(0, 7); if (month) counts[month] = (counts[month] ?? 0) + 1 }
    const cutoff = Date.now() - 7 * 86400000
    return response({ total: apps.length, this_week: apps.filter(a => new Date(a.appliedDate).getTime() >= cutoff).length,
      interviews: apps.filter(a => ['interview_scheduled', 'interviewed', 'offered', 'accepted'].includes(a.status)).length,
      offers: apps.filter(a => ['offered', 'accepted'].includes(a.status)).length, by_status,
      applications_by_month: Object.entries(counts).sort().map(([month, count]) => ({ month, count })) })
  }
  if (route === '/api/employment/bulk' && method === 'DELETE') {
    const status = url.searchParams.get('status')
    save({ jobApplications: state.jobApplications.filter(a => status !== 'all' && a.status !== status) }); return response({ deleted: true })
  }
  if (route === '/api/reports/snapshots') return response(state.monthlySnapshots)
  if (route === '/api/reports/snapshot') {
    if (method === 'GET') return response(state.monthlySnapshots.find(s => s.month === url.searchParams.get('month')) ?? null)
    if (method === 'POST') { save({ monthlySnapshots: [...state.monthlySnapshots.filter(s => s.month !== body.month), body] }); return response(body) }
  }
  const collections = { '/api/expenses': 'expenses', '/api/assets/fixeddeposits': 'fixedDeposits', '/api/assets/mutualfunds': 'mutualFunds', '/api/assets/lic': 'licPolicies', '/api/assets/chitfunds': 'chitFunds', '/api/milestones': 'milestones', '/api/employment': 'jobApplications' }
  const prefix = Object.keys(collections).find(key => route === key || route.startsWith(key + '/'))
  if (!prefix) return response({ detail: 'This operation is unavailable in the local workspace.' }, 404)
  const key = collections[prefix], rows = state[key], [id, action] = route.slice(prefix.length + 1).split('/').map(decodeURIComponent)
  if (method === 'GET') {
    let filtered = rows
    if (key === 'milestones') { const status = url.searchParams.get('status'); if (status) filtered = rows.filter(r => r.status === status) }
    return response(filtered)
  }
  if (method === 'POST' && !id) {
    if (key === 'expenses' && (!Number.isFinite(body.amount) || body.amount <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(body.date ?? ''))) return response({}, 422)
    const row = { ...body, id: body.id || crypto.randomUUID() }, existing = rows.find(r => r.id === row.id)
    if (existing) {
      if (JSON.stringify(existing) !== JSON.stringify(row)) return response({ detail: 'Conflicting record ID.' }, 409)
      return response(existing)
    }
    save({ [key]: [...rows, row] }); return response(row, 201)
  }
  const row = rows.find(r => r.id === id)
  if (!row) return response({ deleted: false }, 404)
  if (method === 'DELETE') { save({ [key]: rows.filter(r => r.id !== id) }); return response({ deleted: true }) }
  if (['PATCH', 'PUT'].includes(method)) {
    const updated = { ...row, ...body, id: row.id }
    if (action === 'mark-paid') { const date = new Date(row.nextDueDate); date.setFullYear(date.getFullYear() + 1); updated.nextDueDate = date.toISOString().slice(0, 10); updated.premiumsPaid = (row.premiumsPaid ?? 0) + 1 }
    save({ [key]: rows.map(r => r.id === id ? updated : r) }); return response(updated)
  }
  return response({}, 405)
}
