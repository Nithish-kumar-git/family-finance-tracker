import test from 'node:test'
import assert from 'node:assert/strict'
import { browserHarness, memoryStorage } from './browserHarness.mjs'
import { resolveWorkspace, syntheticData } from '../src/utils/workspace.js'
import { getTotalCorpus, getMonthlyIncome } from '../src/utils/calculations.js'

test('root and public deep links are demo; owner URLs remain personal on refresh', () => {
  for (const path of ['/', '/dashboard', '/expenses', '/settings', '/?demo=1', '/?demo=0']) assert.equal(resolveWorkspace('https://synthetic.invalid' + path), 'demo')
  for (const path of ['/personal', '/personal/', '/personal/dashboard', '/personal/settings?demo=1']) assert.equal(resolveWorkspace('https://synthetic.invalid' + path), 'personal')
  assert.equal(resolveWorkspace('https://synthetic.invalid/personality'), 'demo')
})
test('default public URL ignores stale personal session markers and never reads private keys', async () => {
  const storage = memoryStorage({ fft_data: 'private sentinel', fft_demo_data_v1: 'legacy demo retained' })
  const read = storage.getItem, write = storage.setItem
  storage.getItem = key => { if (!key.startsWith('fft_demo_')) throw Error('Private storage read forbidden'); return read(key) }
  storage.setItem = (key, value) => { if (!key.startsWith('fft_demo_')) throw Error('Private storage write forbidden'); write(key, value) }
  const h = await browserHarness({ href: 'https://synthetic.invalid/', localStorage: storage, sessionStorage: memoryStorage({ fft_workspace: 'personal', fft_personal_unlocked: 'mother' }) })
  assert.equal(h.workspace.workspaceMode, 'demo')
  await h.login.unlockProfile(h.store.getState().users[0])
  h.store.getState().updateBudget('groceries', 123)
  assert.equal(storage.values.get('fft_data'), 'private sentinel')
  assert.equal(storage.values.get('fft_demo_data_v1'), 'legacy demo retained')
  assert.ok(storage.values.get('fft_demo_data_v2'))
  assert.equal(h.sessionStorage.getItem('fft_personal_unlocked'), 'mother')
})
test('owner URL ignores a stale demo marker and retains private records without importing examples', async () => {
  const original = JSON.stringify({ expenses: [{ id: 'private-synthetic-fixture', date: '2026-10-01', amount: 17 }] })
  const h = await browserHarness({ href: 'https://synthetic.invalid/personal/settings', localStorage: memoryStorage({ fft_data: original }), sessionStorage: memoryStorage({ fft_workspace: 'demo' }) })
  assert.equal(h.workspace.workspaceMode, 'personal')
  assert.equal(h.workspace.workspacePath('/assets'), '/personal/assets')
  assert.equal(h.store.getState().expenses.length, 1)
  assert.equal(h.store.getState().expenses[0].id, 'private-synthetic-fixture')
  assert.equal(h.localStorage.getItem('fft_data'), original)
})
test('synthetic examples have consistent totals, distinct IDs and no real household names', () => {
  const data = syntheticData()
  assert.equal(getTotalCorpus(data), 267500)
  assert.equal(getMonthlyIncome(data), 70000)
  assert.equal(data.expenses.reduce((sum, row) => sum + row.amount, 0), 23580)
  assert.equal(new Set(data.expenses.map(row => row.id)).size, data.expenses.length)
  assert.ok(data.users.every(user => user.name.startsWith('Demo ')))
  assert.ok(data.expenses.every(row => row.id.startsWith('demo-')))
})
test('demo reset restores only synthetic collections; no private data or PIN key is accessed', async () => {
  const storage = memoryStorage({ fft_data: 'private sentinel', fft_pin_v1_mother: 'private pin sentinel' })
  const h = await browserHarness({ demo: true, localStorage: storage })
  const before = syntheticData()
  h.store.getState().addExpense({ id: 'demo-extra', date: '2026-10-02', amount: 11, category: 'other', userId: 'mother' })
  // The actual exported reset is exercised in the same isolated module as the real store.
  h.resetDemoWorkspace()
  assert.equal(JSON.stringify(h.store.getState().expenses), JSON.stringify(before.expenses))
  assert.equal(storage.getItem('fft_data'), 'private sentinel')
  assert.equal(storage.getItem('fft_pin_v1_mother'), 'private pin sentinel')
})
test('personal mode cannot invoke the demo reset', async () => {
  const h = await browserHarness()
  assert.throws(() => h.resetDemoWorkspace(), /unavailable in personal/)
})
