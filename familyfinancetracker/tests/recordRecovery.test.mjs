import test from 'node:test'
import assert from 'node:assert/strict'
import { parseRecoveryFile, planRecovery, applyRecovery, ensureOriginalPreserved, listPreservedSources } from '../src/utils/recordRecovery.js'
import { browserHarness, memoryStorage } from './browserHarness.mjs'

const row = { id: 'synthetic-original', amount: 42, date: '2026-10-01', category: 'other', userId: 'mother' }
test('original bytes are preserved before store normalization or login writes', async () => {
  const raw = ' { "expenses": [], "unknownLegacy": "retain", "users": [{"id":"mother","name":"Synthetic owner"}] } '
  const storage = memoryStorage({ fft_data: raw })
  const h = await browserHarness({ localStorage: storage })
  const key = storage.getItem('fft_original_archive_v2')
  assert.equal(JSON.parse(storage.getItem(key)).raw, raw)
  h.store.getState().setCurrentUser('mother')
  assert.equal(JSON.parse(storage.getItem(key)).raw, raw)
  assert.equal(listPreservedSources(storage).length, 1)
})
test('corrupt source is archived intact and cannot be overwritten by ordinary saves', async () => {
  const storage = memoryStorage({ fft_data: '{broken' })
  const h = await browserHarness({ localStorage: storage })
  assert.equal(storage.getItem('fft_data'), '{broken')
  assert.equal(h.store.getState().storageReadError, true)
  assert.throws(() => h.store.getState().addExpense(row))
  assert.equal(storage.getItem('fft_data'), '{broken')
})
test('failure to preserve original blocks initialization writes', async () => {
  const storage = memoryStorage({ fft_data: JSON.stringify({ expenses: [row] }) })
  storage.setItem = () => { throw Error('synthetic full storage') }
  const h = await browserHarness({ localStorage: storage })
  assert.equal(h.store.getState().storageReadError, true)
  assert.throws(() => h.store.getState().addExpense(row))
  assert.equal(JSON.parse(storage.getItem('fft_data')).expenses.length, 1)
})
test('empty and incomplete month responses cannot erase existing expenses', async () => {
  const h = await browserHarness({ localStorage: memoryStorage({ fft_data: JSON.stringify({ expenses: [row] }) }) })
  h.store.getState().setExpensesForMonth('2026-10', [])
  assert.equal(h.store.getState().expenses.length, 1)
  h.store.getState().setExpensesForMonth('2026-10', [{ ...row, amount: 99 }, { ...row, id: 'synthetic-new' }])
  assert.equal(h.store.getState().expenses.length, 2)
  assert.equal(h.store.getState().expenses[0].amount, 42)
  assert.equal(h.store.getState().recoveryConflicts[0].incoming.amount, 99)
})
test('review merge retains duplicate source rows and both conflict versions', () => {
  const current = { expenses: [row, { ...row, amount: 10 }], monthlyIncome: { pension: 0 } }
  const plan = planRecovery(current, { expenses: [{ ...row, amount: 15 }, { ...row, id: 'new' }], monthlyIncome: { pension: 20, nithish: 30 } })
  assert.equal(plan.patch.expenses.length, 3)
  assert.equal(plan.conflicts[0].existing.length, 2)
  assert.equal(plan.conflicts[0].incoming.amount, 15)
  assert.equal(plan.patch.monthlyIncome.pension, 0)
  assert.equal(plan.patch.monthlyIncome.nithish, 30)
  assert.equal(plan.conflicts.length, 2)
})
test('nested changes are conflicts; property order alone is not', () => {
  const current = { fixedDeposits: [{ id: 'fd', details: { rate: 5, bank: 'Synthetic' } }] }
  assert.equal(planRecovery(current, { fixedDeposits: [{ id: 'fd', details: { bank: 'Synthetic', rate: 5 } }] }).conflicts.length, 0)
  assert.equal(planRecovery(current, { fixedDeposits: [{ id: 'fd', details: { rate: 6 } }] }).conflicts.length, 1)
})
test('owner snapshot JSON and CSV normalize database table names and exclude credentials', () => {
  const snapshot = { users: [{ id: 'mother', name: 'Synthetic', pin: '1234', password: 'never-import' }], fixed_deposits: [{ id: 'synthetic-fd', principal: 100 }], monthly_income: [{ id: 'income', pension: 50 }], budgets: [{ category: 'other', monthlyLimit: 30 }] }
  const json = JSON.stringify(snapshot)
  const csv = 'snapshot\r\n"' + json.replaceAll('"', '""') + '"\r\n'
  for (const raw of [json, csv, JSON.stringify([{ snapshot }])]) {
    const parsed = parseRecoveryFile(raw)
    assert.equal(parsed.data.fixedDeposits[0].principal, 100)
    assert.equal(parsed.data.monthlyIncome.pension, 50)
    assert.equal(parsed.data.budgets.other, 30)
    assert.equal(parsed.data.users[0].pin, undefined)
    assert.equal(parsed.data.users[0].password, undefined)
  }
})
for (const invalid of [
  { workspace: 'demo', data: { expenses: [] } }, { expenses: [{ ...row, id: 'demo-expense' }] },
  { expenses: [{ ...row, amount: '42' }] }, { expenses: [{}] }, { expenses: null },
  { emergency_fund: [{ target: 1 }, { target: 2 }] }, { monthlyIncome: { pension: 'invalid' } },
  { budgets: [{ category: 'other', monthlyLimit: 1 }, { category: 'other', monthlyLimit: 2 }] },
]) test('invalid, ambiguous or synthetic import is rejected: ' + JSON.stringify(invalid), () => assert.throws(() => parseRecoveryFile(JSON.stringify(invalid))))
test('prototype keys and oversize imports are rejected', () => {
  assert.throws(() => parseRecoveryFile('{"expenses":[],"__proto__":{}}'))
  assert.throws(() => parseRecoveryFile(' '.repeat(10 * 1024 * 1024 + 1)))
})
test('explicit merge preserves exact originals and imported bytes before active replacement', () => {
  const original = JSON.stringify({ expenses: [row] }), raw = JSON.stringify({ expenses: [{ ...row, id: 'new' }] })
  const storage = memoryStorage({ fft_data: original })
  const next = applyRecovery({ storage, current: { expenses: [row] }, parsed: parseRecoveryFile(raw), rawSource: raw })
  assert.equal(next.expenses.length, 2)
  const originals = listPreservedSources(storage).map(item => JSON.parse(storage.getItem(item.key)).raw)
  assert.ok(originals.includes(original)); assert.ok(originals.includes(raw))
})
test('archive failure leaves active source unchanged', () => {
  const original = JSON.stringify({ expenses: [row] }), storage = memoryStorage({ fft_data: original })
  storage.setItem = () => { throw Error('synthetic quota') }
  assert.throws(() => applyRecovery({ storage, current: {}, parsed: { data: { expenses: [row] } }, rawSource: original }))
  assert.equal(storage.getItem('fft_data'), original)
})
test('demo initialization and edits never inspect personal storage or archives', async () => {
  const storage = memoryStorage({ fft_data: 'private sentinel' }), get = storage.getItem
  storage.getItem = key => { if (key === 'fft_data' || key.startsWith('fft_archive') || key === 'fft_original_archive_v2') throw Error('Personal read forbidden'); return get(key) }
  const h = await browserHarness({ demo: true, localStorage: storage })
  h.store.getState().addExpense({ ...row, id: 'demo-new' })
  assert.equal(storage.values.get('fft_data'), 'private sentinel')
  assert.equal([...storage.values.keys()].some(key => key.startsWith('fft_archive')), false)
})
