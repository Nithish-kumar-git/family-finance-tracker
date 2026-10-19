import test from 'node:test'
import assert from 'node:assert/strict'
import { browserHarness, memoryStorage } from './browserHarness.mjs'
const url = path => 'https://production-backend.invalid' + path
async function unlocked(options) {
  const h = await browserHarness({ demo: true, ...options })
  await h.login.unlockProfile(h.store.getState().users[0]); return h
}
test('locked browser requests reject before accessing records; no production request is sent', async () => {
  const h = await browserHarness()
  assert.equal((await h.request(url('/api/expenses'))).status, 401)
})
test('the actual application transport routes production-looking URLs locally without a cloud token or network', async () => {
  const h = await unlocked()
  const response = await h.transport(url('/api/expenses'))
  assert.equal(response.local, true)
  assert.equal((await response.json()).expenses.length, 2)
  const pending = h.transport(url('/api/expenses'), { method: 'POST', body: JSON.stringify({ id: 'local-decimal', amount: 17.25, date: '2026-12-01', userId: 'mother', category: 'other' }) })
  assert.equal((await pending).status, 201)
  assert.equal(h.store.getState().expenses.find(e => e.id === 'local-decimal').amount, 17.25)
})
test('expense create, history filtering, refresh and confirmed deletion use only the selected workspace', async () => {
  const h = await unlocked(), expense = { id: 'synthetic-new', amount: 17, category: 'other', userId: 'mother', date: '2026-12-01', description: 'Synthetic test' }
  const create = () => h.request(url('/api/expenses'), { method: 'POST', body: JSON.stringify(expense) })
  assert.equal((await create()).status, 201)
  assert.equal((await create()).status, 200)
  assert.equal(h.store.getState().expenses.filter(e => e.id === expense.id).length, 1)
  const refreshed = await unlocked({ localStorage: h.localStorage })
  const history = await (await refreshed.request(url('/api/expenses?month=2026-12'))).json()
  assert.equal(history.expenses.length, 1); assert.equal(history.category_totals.other, 17)
  const removed = await (await refreshed.request(url('/api/expenses/synthetic-new'), { method: 'DELETE' })).json()
  assert.equal(removed.deleted, true)
  assert.equal((await refreshed.request(url('/api/expenses/synthetic-new'), { method: 'DELETE' })).status, 404)
})
test('storage failure preserves records and rejects writes before acknowledgement', async () => {
  const h = await unlocked(), before = JSON.stringify(h.store.getState().expenses)
  h.localStorage.setItem = () => { throw Error('synthetic quota failure') }
  await assert.rejects(h.request(url('/api/expenses/demo-groceries'), { method: 'DELETE' }), /could not be saved/)
  assert.equal(JSON.stringify(h.store.getState().expenses), before)
  await assert.rejects(h.request(url('/api/expenses'), { method: 'POST', body: JSON.stringify({ id: 'no-save', amount: 1, date: '2026-12-01' }) }), /could not be saved/)
  assert.equal(JSON.stringify(h.store.getState().expenses), before)
})
test('assets, income, milestones, employment and report snapshots are editable and persist across reload', async () => {
  const h = await unlocked()
  const cases = [
    ['/api/assets/mutualfunds', { name: 'Synthetic fund', currentValue: 123, investedAmount: 100 }],
    ['/api/assets/lic', { insured: 'Synthetic insured', annualPremium: 100, premiumsPaid: 0 }],
    ['/api/milestones', { title: 'Synthetic goal', date: '2027-01-01', status: 'pending' }],
    ['/api/employment', { company: 'Synthetic employer', appliedDate: '2026-10-01', status: 'applied' }],
  ]
  for (const [path, body] of cases) {
    const row = await (await h.request(url(path), { method: 'POST', body: JSON.stringify(body) })).json()
    assert.ok(row.id)
    assert.equal((await h.request(url(path + '/' + row.id), { method: 'PUT', body: JSON.stringify({ notes: 'Edited' }) })).ok, true)
    const rows = await (await h.request(url(path))).json()
    assert.equal(rows.find(r => r.id === row.id).notes, 'Edited')
  }
  assert.equal((await h.request(url('/api/settings/income'), { method: 'PATCH', body: JSON.stringify({ pension: 100 }) })).ok, true)
  await h.request(url('/api/reports/snapshot'), { method: 'POST', body: JSON.stringify({ month: '2026-10', totalExpenses: 17 }) })
  const refreshed = await unlocked({ localStorage: h.localStorage })
  assert.equal(refreshed.store.getState().monthlyIncome.pension, 100)
  assert.equal((await (await refreshed.request(url('/api/reports/snapshot?month=2026-10'))).json()).totalExpenses, 17)
})
test('reset stays disabled, invalid bulk months are rejected, and local chat is honestly labelled', async () => {
  const h = await unlocked()
  assert.equal((await h.request(url('/api/reset'), { method: 'DELETE' })).status, 403)
  assert.equal((await h.request(url('/api/expenses/bulk?month=%25'), { method: 'DELETE' })).status, 422)
  const chat = await (await h.request(url('/api/ai/chat'), { method: 'POST', body: '{}' })).json()
  assert.match(chat.answer, /not an AI-provider response/)
})
