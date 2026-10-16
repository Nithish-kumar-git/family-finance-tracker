// Actual API, hook and page handler with synthetic rows and mocked transport.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { addMonths, format, startOfMonth } from 'date-fns'

const source = file => readFileSync(new URL(file, import.meta.url), 'utf8')
async function harness(reply) {
  const rows = [{ id: 'synthetic-one', amount: 1 }], removed = [], toasts = []
  const store = { expenses: rows, setIsOffline() {}, deleteExpense(id) { rows.splice(rows.findIndex(row => row.id === id), 1) } }
  const context = vm.createContext({ URLSearchParams, fetch: async (url, config) => {
    assert.equal(url, 'https://synthetic.invalid/api/expenses/synthetic-one')
    assert.equal(config.method, 'DELETE')
    return reply()
  } })
  const stub = values => new vm.SyntheticModule(Object.keys(values), function () {
    for (const [key, value] of Object.entries(values)) this.setExport(key, value)
  }, { context })
  const storeModule = stub({ default: { getState: () => store } })
  const api = new vm.SourceTextModule(source('../src/utils/api.js'), { context,
    initializeImportMeta: meta => { meta.env = { VITE_API_URL: 'https://synthetic.invalid' } } })
  await api.link(name => {
    if (name.includes('useStore')) return storeModule
    if (name.includes('expenseHistory')) return stub({ readHistoryMonth() {} })
    if (name.includes('ammaChat')) return stub({ readChat() {} })
    throw Error('Unexpected import')
  })
  await api.evaluate()
  const hook = new vm.SourceTextModule(source('../src/hooks/useExpenses.js'), { context })
  await hook.link(name => name === 'date-fns' ? stub({ addMonths, format, startOfMonth }) : name.includes('api.js') ? api : storeModule)
  await hook.evaluate()
  Object.assign(context, { hookDeleteExpense: hook.namespace.useExpenses().deleteExpense,
    deletionBlockedIds: new Set(), findLocalIdCollisions: () => [], useStore: { getState: () => store },
    setDeletingId() {}, setDeleteConfirmId() {},
    historyLoader: { current: { removeExpense: id => removed.push(id) } },
    showToast: (message, type) => toasts.push({ message, type }) })
  const page = source('../src/pages/Expenses.jsx')
  const handler = page.slice(page.indexOf('  const handleDeleteExpense ='), page.indexOf('  // ── Filtered + grouped history'))
  vm.runInContext(handler.replace('const handleDeleteExpense =', 'globalThis.remove ='), context)
  return { rows, removed, toasts, remove: () => context.remove('synthetic-one') }
}

for (const [name, reply] of [
  ['network', () => { throw Error('Synthetic connection failure') }],
  ['HTTP', () => ({ ok: false, status: 500 })],
  ['invalid JSON', () => ({ ok: true, json: async () => { throw SyntaxError('Synthetic') } })],
  ...[false, {}, null, { deleted: false }, { deleted: 1 }, { deleted: 'true' }].map(body =>
    [JSON.stringify(body), () => ({ ok: true, json: async () => body })]),
]) {
  test(`failed deletion (${name}) preserves cached and displayed row and shows recovery action`, async () => {
    const h = await harness(reply)
    await h.remove()
    assert.equal(h.rows.length, 1)
    assert.deepEqual(h.removed, [])
    assert.equal(h.toasts.length, 1)
    assert.equal(h.toasts[0].type, 'error')
    assert.match(h.toasts[0].message, /check.*connection|refresh History/i)
  })
}
test('only explicit server acknowledgement removes the cached and displayed row', async () => {
  const h = await harness(() => ({ ok: true, json: async () => ({ deleted: true }) }))
  await h.remove()
  assert.equal(h.rows.length, 0)
  assert.deepEqual(h.removed, ['synthetic-one'])
  assert.equal(h.toasts[0].type, 'success')
})
