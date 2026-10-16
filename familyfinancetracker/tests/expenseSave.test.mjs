// Synthetic only: actual API, hook and form handler; no real store, seeds or network.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { addMonths, format, startOfMonth } from 'date-fns'

globalThis.fetch = () => { throw Error('External network blocked') }
const source = file => readFileSync(new URL(file, import.meta.url), 'utf8')
const fixture = extra => ({ userId: 'synthetic-profile', amount: 1, category: 'other',
  description: 'Synthetic', date: '2026-07-14', isRecurring: false, ...extra })
const clone = value => JSON.parse(JSON.stringify(value))

async function harness(reply) {
  const rows = [fixture({ id: 'synthetic-existing' })], requests = [], toasts = [], setters = []
  const initial = clone(rows)
  let nextId = 0
  const store = { expenses: rows, setIsOffline() {}, addExpense(row) { rows.push(row) } }
  const context = vm.createContext({ URLSearchParams,
    crypto: { randomUUID: () => `synthetic-client-${++nextId}` },
    fetch: async (url, options) => {
      assert.equal(url, 'https://synthetic.invalid/api/expenses')
      assert.equal(options.method, 'POST')
      const body = JSON.parse(options.body)
      requests.push(body)
      return reply(body, requests.length)
    },
    localStorage: { getItem() { throw Error('Storage blocked') }, setItem() { throw Error('Storage blocked') } },
  })
  const stub = values => new vm.SyntheticModule(Object.keys(values), function () {
    for (const [key, value] of Object.entries(values)) this.setExport(key, value)
  }, { context })
  const api = new vm.SourceTextModule(source('../src/utils/api.js'), { context,
    initializeImportMeta: meta => { meta.env = { VITE_API_URL: 'https://synthetic.invalid' } } })
  await api.link(name => {
    if (name.includes('useStore')) return stub({ default: { getState: () => store } })
    if (name.includes('expenseHistory')) return stub({ readHistoryMonth() { throw Error('History blocked') } })
    if (name.includes('ammaChat')) return stub({ readChat() { throw Error('Chat blocked') } })
    throw Error('Unexpected API dependency')
  })
  await api.evaluate()
  const hook = new vm.SourceTextModule(source('../src/hooks/useExpenses.js'), { context })
  await hook.link(name => {
    if (name === 'date-fns') return stub({ addMonths, format, startOfMonth })
    if (name.includes('api.js')) return api
    if (name.includes('useStore')) return stub({ default: { getState: () => store } })
    throw Error('Unexpected hook dependency')
  })
  await hook.evaluate()
  const actualHook = hook.namespace.useExpenses()
  Object.assign(context, { addLoading: false, addInFlight: { current: false }, addAttempt: { current: null }, amount: '1', category: 'other', description: 'Synthetic',
    date: '2026-07-14', selectedUserId: null, currentUser: 'synthetic-profile', isRecurring: false,
    todayStr: () => '2026-10-11', hookAddExpense: actualHook.addExpense,
    loadData: () => setters.push('loadData'), showToast: (message, type) => toasts.push({ message, type }) })
  for (const [setter, field] of Object.entries({ setFormError: 'formError', setAddLoading: 'addLoading',
    setAmount: 'amount', setDescription: 'description', setCategory: 'category', setDate: 'date',
    setIsRecurring: 'isRecurring', setParsedByAI: 'parsedByAI' })) {
    context[setter] = value => { context[field] = value; setters.push(setter) }
  }
  const page = source('../src/pages/Expenses.jsx')
  const handler = page.slice(page.indexOf('  const handleAddExpense ='), page.indexOf('  const handleParseTransaction ='))
  vm.runInContext(handler.replace('const handleAddExpense =', 'globalThis.submit ='), context)
  return { rows, initial, requests, toasts, setters, context, hook: actualHook }
}
const acknowledged = (body, index) => ({ ok: true, json: async () => ({ ...body, id: `synthetic-server-${index}` }) })

test('confirmed server response is cached exactly once with server identifier', async () => {
  const h = await harness(acknowledged)
  const saved = await h.hook.addExpense(fixture())
  assert.equal(h.requests.length, 1)
  assert.equal(h.rows.length, 2)
  assert.equal(h.rows[1].id, 'synthetic-server-1')
  assert.equal(saved.id, h.rows[1].id)
  assert.equal('recurringSave' in h.rows[1], false)
  assert.deepEqual(clone(h.rows[0]), h.initial[0])
})

for (const [name, reply] of [
  ['network', () => { throw Error('Synthetic offline') }],
  ['HTTP', () => ({ ok: false, status: 422 })],
  ['JSON parsing', () => ({ ok: true, json: async () => { throw Error('Synthetic malformed JSON') } })],
  ['missing acknowledgement', () => ({ ok: true, json: async () => ({}) })],
  ['mismatched acknowledgement', body => ({ ok: true, json: async () => ({ ...body, id: 'synthetic-server', date: '2026-06-01' }) })],
]) {
  test(`${name} failure preserves draft and existing rows, reports no success, and never retries`, async () => {
    const h = await harness(reply)
    const draft = { amount: h.context.amount, date: h.context.date, description: h.context.description,
      category: h.context.category, isRecurring: h.context.isRecurring }
    await h.context.submit()
    assert.deepEqual(clone(h.rows), h.initial)
    for (const [key, value] of Object.entries(draft)) assert.equal(h.context[key], value)
    assert.equal(h.requests.length, 1)
    assert.equal(h.context.addLoading, false)
    assert.match(h.context.formError, /could not be confirmed.*form is unchanged.*Check History/)
    assert.equal(h.toasts.some(toast => toast.type === 'success'), false)
    assert.equal(h.setters.includes('loadData'), false)
  })
}

test('successful form reports server save and clears draft only after acknowledgement', async () => {
  const h = await harness(acknowledged)
  await h.context.submit()
  assert.equal(h.rows.length, 2)
  assert.equal(h.context.amount, '')
  assert.equal(h.context.addLoading, false)
  assert.deepEqual(h.toasts, [{ message: 'Expense saved to server', type: 'success' }])
})

test('recurring partial failure preserves primary and confirmed children, exposes unconfirmed count', async () => {
  const h = await harness((body, index) => index === 3 ? { ok: false, status: 500 } : acknowledged(body, index))
  h.context.isRecurring = true
  await h.context.submit()
  assert.equal(h.requests.length, 4)
  assert.deepEqual(h.requests.map(row => row.date), ['2026-07-14', '2026-08-01', '2026-09-01', '2026-10-01'])
  assert.equal(h.rows.length, 4)
  assert.equal(new Set(h.rows.map(row => row.id)).size, h.rows.length)
  assert.match(h.context.formError, /Main expense saved to server.*1 of 3.*Check History/)
  assert.equal(h.toasts.some(toast => toast.type === 'success'), false)
  assert.equal(h.context.addLoading, false)
})

test('all recurring child failures are explicit; primary is not resubmitted', async () => {
  const h = await harness((body, index) => index === 1 ? acknowledged(body, index) : Promise.reject(Error('Synthetic offline')))
  const result = await h.hook.addExpense(fixture({ isRecurring: true }))
  assert.deepEqual(clone(result.recurringSave), { requested: 3, confirmed: 0, unconfirmed: 3 })
  assert.equal(h.rows.length, 2)
  assert.equal(h.requests.length, 4)
})

test('failed primary stops recurring creation without local insertion', async () => {
  const h = await harness(() => { throw Error('Synthetic offline') })
  await assert.rejects(h.hook.addExpense(fixture({ isRecurring: true })), /Network error/)
  assert.equal(h.requests.length, 1)
  assert.deepEqual(clone(h.rows), h.initial)
})

test('all recurring acknowledgements are stored once and report completion', async () => {
  const h = await harness(acknowledged)
  const result = await h.hook.addExpense(fixture({ isRecurring: true }))
  assert.deepEqual(clone(result.recurringSave), { requested: 3, confirmed: 3, unconfirmed: 0 })
  assert.equal(h.rows.length, 5)
})

test('pending form submission blocks a second handler call; form controls stay disabled', async () => {
  let finish
  const h = await harness(body => new Promise(resolve => { finish = () => resolve(acknowledged(body, 1)) }))
  const first = h.context.submit()
  await h.context.submit()
  assert.equal(h.requests.length, 1)
  finish()
  await first
  assert.equal(h.rows.length, 2)
  const page = source('../src/pages/Expenses.jsx')
  assert.match(page, /<fieldset disabled=\{addLoading\}/)
  assert.match(page, /<p role="alert"/)
})

test('retry after a lost acknowledgement reuses the submission ID and clears the draft once', async () => {
  const h = await harness((body, index) => {
    if (index === 1) throw Error('Synthetic lost response after commit')
    return { ok: true, json: async () => body }
  })
  await h.context.submit()
  assert.equal(h.rows.length, 1)
  await h.context.submit()
  assert.equal(h.requests.length, 2)
  assert.equal(h.requests[0].id, h.requests[1].id)
  assert.equal(h.rows.length, 2)
  assert.equal(h.context.amount, '')
})

test('editing a failed draft gives the new operation a distinct submission ID', async () => {
  const h = await harness(() => { throw Error('Synthetic offline') })
  await h.context.submit()
  h.context.amount = '2'
  await h.context.submit()
  assert.notEqual(h.requests[0].id, h.requests[1].id)
  assert.equal(h.rows.length, 1)
})
