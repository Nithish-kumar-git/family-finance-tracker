// Run: node --experimental-vm-modules --test tests/expenseHistory.test.mjs
// No application/store imports or real network. All records are synthetic.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import vm from 'node:vm'
import * as history from '../src/utils/expenseHistory.js'

globalThis.fetch = () => { throw new Error('External network blocked in tests') }
const month = '2026-06'
const row = overrides => ({
  id: 'synthetic-one', userId: 'synthetic-person', date: '2026-06-01',
  category: 'other', amount: 1, description: 'Synthetic fixture', ...overrides,
})
const response = payload => ({ ok: true, json: async () => payload })
const read = (fetchResponse, local = [], period = month) => history.readHistoryMonth({
  month: period, url: '/synthetic-only', fetchResponse, getLocalExpenses: () => local,
})
const success = (period = month, rows = [row()]) => ({
  ...history.initialHistoryState(period), ...history.validateHistoryResponse(rows, period),
  status: rows.length ? 'success' : 'empty', source: 'response',
})
const failure = (period = month) => ({ ...history.initialHistoryState(period), status: 'error', error: 'NETWORK' })
const deferred = () => {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve }
}

// Virtual time only: no sleeps, real requests, or reliance on wall-clock speed.
const fakeClock = () => {
  let now = 0, nextId = 0
  const timers = new Map()
  return {
    scheduleTimeout(callback, delay) {
      const id = ++nextId
      timers.set(id, { callback, at: now + delay })
      return id
    },
    cancelTimeout(id) { timers.delete(id) },
    advance(ms) {
      const end = now + ms
      while (true) {
        const next = [...timers].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0]
        if (!next) break
        now = next[1].at
        timers.delete(next[0])
        next[1].callback()
      }
      now = end
    },
    get pendingCount() { return timers.size },
  }
}
const timedLoader = (reader, states, clock) => history.createHistoryLoader(reader, state => states.push(state), {
  timeoutMs: 100, scheduleTimeout: clock.scheduleTimeout, cancelTimeout: clock.cancelTimeout,
})

test('valid populated wrapper; totals computed from validated rows; freshness unknown', async () => {
  const result = await read(async () => response({ expenses: [row()], category_totals: { other: 999 } }))
  assert.equal(result.status, 'success')
  assert.equal(result.categoryTotals.other, 1)
  assert.equal(result.freshness, 'unverified')
})

test('valid empty wrapper is distinct from fallback and failure', async () => {
  const result = await read(async () => response({ expenses: [] }))
  assert.equal(result.status, 'empty')
  assert.equal(result.source, 'response')
  assert.equal(result.error, null)
})

test('valid bare arrays remain supported', async () => {
  assert.equal((await read(async () => response([row()]))).status, 'success')
})

for (const [name, code, mock] of [
  ['network rejection', 'NETWORK', async () => { throw new Error('Synthetic sensitive detail must not escape') }],
  ['HTTP failure', 'HTTP', async () => ({ ok: false, status: 503, json: () => { throw new Error('Must not read body') } })],
  ['JSON parsing failure', 'JSON', async () => ({ ok: true, json: async () => { throw new SyntaxError('Synthetic detail') } })],
]) {
  test(`${name} yields visibly distinct empty fallback with sanitized error`, async () => {
    const result = await read(mock)
    assert.equal(result.status, 'fallback')
    assert.equal(result.error, code)
    assert.equal(result.source, 'local-fallback')
    assert.equal(result.expenses.length, 0)
    assert.ok(!JSON.stringify(result).includes('Synthetic sensitive'))
  })
}

for (const [name, payload] of [
  ['unknown wrapper', { data: [row()] }], ['null body', null],
  ['null expenses', { expenses: null }], ['non-array expenses', { expenses: {} }],
]) {
  test(`${name} is an error, never successful empty or substituted local data`, async () => {
    const result = await read(async () => response(payload), [row()])
    assert.equal(result.status, 'error')
    assert.equal(result.error, 'SHAPE')
  })
}

test('malformed records fail the whole response without silently dropping rows', async () => {
  const invalid = [
    null, {}, row({ date: null }),
    row({ id: '' }), row({ id: 1 }), row({ userId: null }),
    row({ amount: '1' }), row({ amount: NaN }), row({ amount: Infinity }),
    row({ category: null }), row({ description: {} }), row({ isRecurring: 'yes' }),
  ]
  for (const item of invalid) {
    const result = await read(async () => response({ expenses: [row(), item] }))
    assert.equal(result.status, 'error')
    assert.equal(result.error, 'RECORD')
    assert.equal(result.expenses.length, 0)
  }
})

test('duplicate IDs and overflowing totals are rejected', () => {
  assert.equal(history.validateHistoryResponse([row(), row()], month).error, 'RECORD')
  assert.equal(history.validateHistoryResponse([row({ amount: Number.MAX_VALUE }), row({ id: 'synthetic-two', amount: Number.MAX_VALUE })], month).error, 'RECORD')
})

test('optional description, unknown categories, and refunds remain compatible', () => {
  const result = history.validateHistoryResponse([row({ category: 'synthetic-category', description: null, amount: -1 })], month)
  assert.equal(result.categoryTotals.other, -1)
})

test('exact userId matching and All retain their meaning; IDs are never rewritten', () => {
  const rows = [row(), row({ id: 'synthetic-two', userId: 'synthetic-person ' })]
  assert.equal(history.filterHistoryExpenses(rows, 'synthetic-person').length, 1)
  assert.equal(history.filterHistoryExpenses(rows, 'SYNTHETIC-PERSON').length, 0)
  assert.equal(history.filterHistoryExpenses(rows, 'all').length, 2)
  assert.equal(history.validateHistoryResponse(rows, month).expenses[1].userId, 'synthetic-person ')
})

test('month boundaries, year boundaries and leap days are validated', () => {
  assert.ok(!history.validateHistoryResponse([row({ date: '2026-06-30' })], month).error)
  assert.equal(history.validateHistoryResponse([row({ date: '2026-07-01' })], month).error, 'MONTH')
  assert.equal(history.validateHistoryResponse([row({ date: '2025-12-31' })], '2026-01').error, 'MONTH')
  assert.ok(!history.validateHistoryResponse([row({ date: '2024-02-29' })], '2024-02').error)
  assert.equal(history.validateHistoryResponse([row({ date: '2026-02-29' })], '2026-02').error, 'DATE')
  assert.equal(history.validateHistoryResponse([], '2026-13').error, 'MONTH')
})

test('fallback is validated and limited to the requested month without modifying stored rows', async () => {
  const local = Object.freeze([Object.freeze(row()), Object.freeze(row({ id: 'synthetic-two', date: '2026-07-01' }))])
  const snapshot = JSON.stringify(local)
  const result = await read(async () => { throw new Error('Synthetic offline') }, local)
  assert.equal(result.status, 'fallback')
  assert.equal(result.expenses.length, 1)
  assert.notEqual(result.expenses[0], local[0])
  result.expenses[0].description = 'Changed test display copy'
  assert.equal(JSON.stringify(local), snapshot)
})

test('malformed or unavailable local fallback is explicit and preserves the original failure', async () => {
  const result = await read(async () => { throw new Error('Synthetic offline') }, [row({ date: null })])
  assert.equal(result.status, 'error')
  assert.equal(result.error, 'NETWORK')
  assert.equal(result.fallbackError, 'LOCAL')
})

test('older completion cannot overwrite newer month results', async () => {
  const a = deferred(), b = deferred(), states = []
  const loader = history.createHistoryLoader(period => period === month ? a.promise : b.promise, state => states.push(state))
  const first = loader.load(month), second = loader.load('2026-07')
  b.resolve(success('2026-07', [row({ date: '2026-07-01' })])); await second
  const count = states.length
  a.resolve(success()); await first
  assert.equal(states.length, count)
  assert.equal(states.at(-1).month, '2026-07')
})

test('completion A does not clear loading while B remains pending, even for same month', async () => {
  const a = deferred(), b = deferred(), states = []
  let call = 0
  const loader = history.createHistoryLoader(() => (++call === 1 ? a.promise : b.promise), state => states.push(state))
  const first = loader.load(month), second = loader.load(month)
  a.resolve(success()); await first
  assert.equal(states.at(-1).status, 'loading')
  b.resolve(success()); await second
  assert.equal(states.at(-1).status, 'success')
})

test('unmount invalidates pending requests and subsequent loads', async () => {
  const pending = deferred(), states = []
  const loader = history.createHistoryLoader(() => pending.promise, state => states.push(state))
  const loading = loader.load(month)
  loader.invalidate()
  pending.resolve(success()); await loading; await loader.load(month)
  assert.equal(states.length, 1)
})

test('failed refresh retains successful same-month display with a warning', async () => {
  const states = []; let call = 0
  const loader = history.createHistoryLoader(async () => ++call === 1 ? success() : failure(), state => states.push(state))
  await loader.load(month); await loader.load(month)
  assert.equal(states.at(-1).status, 'error')
  assert.equal(states.at(-1).retained, true)
  assert.equal(states.at(-1).expenses.length, 1)
})

test('fallback does not replace an already successful same-month display', async () => {
  const states = []; let call = 0
  const loader = history.createHistoryLoader(async () => ++call === 1 ? success() : { ...failure(), status: 'fallback', source: 'local-fallback' }, state => states.push(state))
  await loader.load(month); await loader.load(month)
  assert.equal(states.at(-1).source, 'previous-response')
  assert.equal(states.at(-1).expenses.length, 1)
})

test('new month clears previous rows immediately and cannot retain another month on failure', async () => {
  const states = []
  const loader = history.createHistoryLoader(async period => period === month ? success() : failure(period), state => states.push(state))
  await loader.load(month)
  const loading = loader.load('2026-07')
  assert.equal(states.at(-1).month, '2026-07')
  assert.equal(states.at(-1).expenses.length, 0)
  await loading
  assert.equal(states.at(-1).retained, false)
  assert.equal(states.at(-1).expenses.length, 0)
})

test('unexpected reader exceptions and wrong-period results are sanitized', async () => {
  for (const reader of [async () => { throw new Error('Synthetic hidden detail') }, async () => success('2026-07', [])]) {
    const states = []; const loader = history.createHistoryLoader(reader, state => states.push(state))
    await loader.load(month)
    assert.equal(states.at(-1).status, 'error')
    assert.ok(!JSON.stringify(states.at(-1)).includes('Synthetic hidden detail'))
  }
})

test('post-delete local display update cannot resurrect a row during failed refresh', async () => {
  const pending = deferred(), states = []; let call = 0
  const loader = history.createHistoryLoader(() => ++call === 1 ? Promise.resolve(success()) : pending.promise, state => states.push(state))
  await loader.load(month)
  const refresh = loader.load(month)
  loader.removeExpense('synthetic-one')
  pending.resolve(failure()); await refresh
  assert.equal(states.at(-1).expenses.length, 0)
})

test('History API has no store writes; legacy Dashboard contract and body are unchanged', async () => {
  const source = readFileSync(new URL('../src/utils/api.js', import.meta.url), 'utf8')
  const original = execFileSync('git', ['--no-optional-locks', 'show', 'HEAD:familyfinancetracker/src/utils/api.js'], { encoding: 'utf8' })
  const legacy = text => text.slice(text.indexOf('    async getByMonth'), text.indexOf('    async add(expense)')).replace(/\r\n/g, '\n')
  assert.ok(legacy(source) === legacy(original), 'Legacy method must remain unchanged')
  let writes = 0, requested
  const local = Object.freeze([Object.freeze(row())])
  const store = { expenses: local, setIsOffline: () => { writes++ } }
  const context = vm.createContext({
    URLSearchParams,
    fetch: async url => { requested = url; return response({ expenses: [row()], category_totals: { other: 1 } }) },
  })
  const module = new vm.SourceTextModule(source, { context, initializeImportMeta: meta => { meta.env = { VITE_API_URL: 'https://synthetic.invalid' } } })
  await module.link(specifier => {
    if (specifier.includes('useStore')) return new vm.SyntheticModule(['default'], function () { this.setExport('default', { getState: () => store }) }, { context })
    if (specifier.includes('expenseHistory')) return new vm.SyntheticModule(['readHistoryMonth'], function () { this.setExport('readHistoryMonth', history.readHistoryMonth) }, { context })
    throw new Error('Unexpected application import blocked')
  })
  await module.evaluate()
  const api = module.namespace.api
  assert.equal((await api.expenses.getForHistory(2026, 6)).status, 'success')
  assert.equal(writes, 0)
  assert.ok(requested.endsWith('/api/expenses?month=2026-06'))
  const legacyResult = await api.expenses.getByMonth(2026, 6, 'synthetic-person')
  assert.equal(legacyResult.expenses.length, 1)
  assert.equal(legacyResult.category_totals.other, 1)
  assert.ok(requested.includes('userId=synthetic-person'))
  context.fetch = async () => { throw new Error('Synthetic offline') }
  writes = 0
  assert.equal((await api.expenses.getForHistory(2026, 6)).status, 'fallback')
  assert.equal(writes, 0)
  assert.equal((await api.expenses.getByMonth(2026, 6)).expenses.length, 1)
  assert.equal(local[0].amount, 1)
})

test('backend-compatible nullable optional fields and opaque string profile IDs are preserved', () => {
  const fixture = row({ userId: '', description: null, isRecurring: false, created_at: null, updated_at: '2026-06-01T00:00:00Z' })
  const result = history.validateHistoryResponse({ expenses: [fixture], category_totals: {} }, month)
  assert.equal(result.expenses[0].userId, '')
  assert.equal(history.filterHistoryExpenses(result.expenses, '').length, 1)
  assert.equal(history.filterHistoryExpenses(result.expenses, 'synthetic-person').length, 0)
  const opaque = row({ id: ' opaque/identifier ', userId: ' synthetic-person ' })
  assert.equal(history.validateHistoryResponse([opaque], month).expenses[0].id, opaque.id)
  assert.equal(history.validateHistoryResponse([row({ description: undefined, created_at: undefined })], month).expenses.length, 1)
})

test('ambiguous dates and unusable expense IDs error explicitly without rewriting raw fixtures', () => {
  for (const date of ['2026-6-01', '2026-06-01T00:00:00Z', '2026-06-01T23:00:00-05:00', '2026-02-30', '06/01/2026']) {
    const fixture = Object.freeze(row({ date }))
    assert.equal(history.validateHistoryResponse([fixture], month).error, 'DATE')
    assert.equal(fixture.date, date)
  }
  assert.equal(history.validateHistoryResponse([row({ id: '' })], month).error, 'RECORD')
})

test('local duplicate copies remain separate, unchanged and visibly limited; server duplicates still error', async () => {
  for (const conflicting of [false, true]) {
    const local = Object.freeze([Object.freeze(row()), Object.freeze(row({ amount: conflicting ? 2 : 1 }))])
    const before = JSON.stringify(local)
    const result = await read(async () => { throw Error('Synthetic offline') }, local)
    assert.equal(result.status, 'fallback')
    assert.equal(result.expenses.length, 2)
    assert.equal(result.expenses[0].id, result.expenses[1].id)
    assert.equal(result.limited, true)
    assert.deepEqual(result.limitations.duplicateIds, ['synthetic-one'])
    assert.deepEqual(result.categoryTotals, {})
    assert.ok(history.localHistoryWarnings(result.limitations).some(message => message.includes('without deduplication')))
    assert.ok(history.localHistoryWarnings(result.limitations).some(message => message.includes('not verified complete')))
    assert.equal(JSON.stringify(local), before)
    assert.equal(history.validateHistoryResponse({ expenses: local }, month).error, 'RECORD')
  }
})

test('malformed known other-month rows do not block the requested month', async () => {
  const local = Object.freeze([Object.freeze(row()), Object.freeze(row({ id: 'synthetic-may', date: '2026-05-01', amount: 'invalid' }))])
  const before = JSON.stringify(local)
  const result = await read(async () => { throw Error('Synthetic offline') }, local)
  assert.equal(result.status, 'fallback')
  assert.equal(result.expenses.length, 1)
  assert.equal(result.limited, false)
  assert.equal(result.categoryTotals.other, 1)
  assert.equal(JSON.stringify(local), before)
})

test('unknown-month and malformed selected-month rows give explicit partial-view limitations', async () => {
  const local = Object.freeze([
    Object.freeze(row()), Object.freeze(row({ id: 'synthetic-unknown', date: 'unparseable' })),
    Object.freeze(row({ id: 'synthetic-invalid', amount: 'invalid' })),
  ])
  const before = JSON.stringify(local)
  const result = await read(async () => { throw Error('Synthetic offline') }, local)
  assert.equal(result.status, 'fallback')
  assert.equal(result.expenses.length, 1)
  assert.equal(result.limited, true)
  assert.equal(result.limitations.unknownMonthCount, 1)
  assert.equal(result.limitations.invalidMonthCount, 1)
  assert.deepEqual(result.categoryTotals, {})
  assert.equal(history.localHistoryWarnings(result.limitations).length, 3)
  assert.equal(JSON.stringify(local), before)
})

test('no safe local rows is a specific limitation, never verified empty; unavailable storage stays error', async () => {
  for (const local of [[null], [row({ date: null })], [row({ id: '' })], undefined, {}]) {
    const result = await read(async () => { throw Error('Synthetic offline') }, local === undefined ? null : local)
    assert.equal(result.status, 'error')
    assert.equal(result.error, 'NETWORK')
    assert.equal(result.fallbackError, 'LOCAL')
  }
})

test('overflowing local totals preserve rows but disable ambiguous summaries', async () => {
  const result = await read(async () => { throw Error('Synthetic offline') }, [row({ amount: Number.MAX_VALUE }), row({ id: 'synthetic-two', amount: Number.MAX_VALUE })])
  assert.equal(result.expenses.length, 2)
  assert.equal(result.limited, true)
  assert.equal(result.limitations.totalsOverflow, true)
  assert.deepEqual(result.categoryTotals, {})
})

test('successful pending read cannot undo a confirmed delete; a subsequent fresh read is allowed', async () => {
  const pending = deferred(), states = []; let call = 0
  const loader = history.createHistoryLoader(() => ++call === 1 ? pending.promise : Promise.resolve(success()), state => states.push(state))
  const readPending = loader.load(month)
  loader.removeExpense('synthetic-one')
  assert.equal(states.at(-1).status, 'loading')
  pending.resolve(success()); await readPending
  assert.equal(states.at(-1).status, 'empty')
  assert.equal(states.at(-1).expenses.length, 0)
  assert.equal(states.at(-1).categoryTotals.other, 0)
  await loader.load(month)
  assert.equal(states.at(-1).status, 'success')
  assert.equal(states.at(-1).expenses.length, 1)
})

test('delete guard keeps latest request loading ownership and same-month retention', async () => {
  const older = deferred(), latest = deferred(), states = []; let call = 0
  const loader = history.createHistoryLoader(() => ++call === 1 ? older.promise : latest.promise, state => states.push(state))
  const a = loader.load(month), b = loader.load(month)
  loader.removeExpense('synthetic-one')
  older.resolve(success()); await a
  assert.equal(states.at(-1).status, 'loading')
  latest.resolve(success(month, [row(), row({ id: 'synthetic-two' })])); await b
  assert.deepEqual(states.at(-1).expenses.map(item => item.id), ['synthetic-two'])
  assert.equal(states.at(-1).categoryTotals.other, 1)
})

test('a read started after deletion can finish before the obsolete pre-deletion read', async () => {
  const obsolete = deferred(), fresh = deferred(), states = []; let call = 0
  const loader = history.createHistoryLoader(() => ++call === 1 ? obsolete.promise : fresh.promise, state => states.push(state))
  const a = loader.load(month)
  loader.removeExpense('synthetic-one')
  const b = loader.load(month)
  fresh.resolve(success(month, [row({ description: 'Synthetic fresh response' })])); await b
  assert.equal(states.at(-1).expenses[0].description, 'Synthetic fresh response')
  const count = states.length
  obsolete.resolve(success()); await a
  assert.equal(states.length, count)
  assert.equal(states.at(-1).expenses[0].description, 'Synthetic fresh response')
})

test('successful refresh after deletion updates the retained snapshot without restoring deleted rows', async () => {
  const pending = deferred(), states = []; let call = 0
  const rows = [row(), row({ id: 'synthetic-two' })]
  const loader = history.createHistoryLoader(() => ++call === 1 ? Promise.resolve(success(month, rows)) : call === 2 ? pending.promise : Promise.resolve(failure()), state => states.push(state))
  await loader.load(month)
  const refresh = loader.load(month)
  loader.removeExpense('synthetic-one')
  pending.resolve(success(month, rows)); await refresh
  assert.deepEqual(states.at(-1).expenses.map(item => item.id), ['synthetic-two'])
  await loader.load(month)
  assert.equal(states.at(-1).retained, true)
  assert.deepEqual(states.at(-1).expenses.map(item => item.id), ['synthetic-two'])
})

test('limited local fallback does not replace a retained response and its limitations remain visible', async () => {
  const localResult = await read(async () => { throw Error('Synthetic offline') }, [row(), row()])
  const states = []; let call = 0
  const loader = history.createHistoryLoader(async () => ++call === 1 ? success() : localResult, state => states.push(state))
  await loader.load(month); await loader.load(month)
  assert.equal(states.at(-1).source, 'previous-response')
  assert.equal(states.at(-1).expenses.length, 1)
  assert.equal(states.at(-1).limited, false)
  const warnings = history.localHistoryWarnings(states.at(-1).limitations, states.at(-1).retained)
  assert.ok(warnings.some(message => message.includes('Duplicate local IDs')))
  assert.ok(warnings.some(message => message.includes('previous response remains displayed')))
  assert.ok(!warnings.some(message => message.includes('Monthly summaries are unavailable')))
})

test('cross-month or undisplayable ID collisions explicitly prevent ambiguous local targeting', async () => {
  for (const extra of [row({ date: '2026-05-01', amount: 'invalid' }), row({ date: null })]) {
    const local = Object.freeze([Object.freeze(row()), Object.freeze(extra)])
    const before = JSON.stringify(local)
    const result = await read(async () => { throw Error('Synthetic offline') }, local)
    assert.equal(result.expenses.length, 1)
    assert.deepEqual(result.limitations.duplicateIds, ['synthetic-one'])
    assert.equal(result.limited, true)
    assert.equal(JSON.stringify(local), before)
  }
})

test('deletions suppress pending fallback copies too, without adding persistent tombstones', async () => {
  const pending = deferred(), states = []
  const loader = history.createHistoryLoader(() => pending.promise, state => states.push(state))
  const loading = loader.load(month)
  loader.removeExpense('synthetic-one')
  const fallback = await read(async () => { throw Error('Synthetic offline') }, [row(), row(), row({ id: 'synthetic-two' })])
  pending.resolve(fallback); await loading
  assert.equal(states.at(-1).status, 'fallback')
  assert.deepEqual(states.at(-1).expenses.map(item => item.id), ['synthetic-two'])
  assert.equal(states.at(-1).limited, false)
  assert.equal(states.at(-1).categoryTotals.other, 1)
})

test('actual existing offline Add reproduces duplicate storage; History reads preserve it without writes', async () => {
  const rows = []; let writes = 0
  const store = { expenses: rows, setIsOffline: () => { writes++ }, addExpense: item => { rows.push(item); writes++ } }
  const context = vm.createContext({ URLSearchParams, crypto: { randomUUID: () => 'synthetic-offline-id' }, fetch: async () => { throw Error('Synthetic offline') } })
  const storeModule = new vm.SyntheticModule(['default'], function () { this.setExport('default', { getState: () => store }) }, { context })
  const historyModule = new vm.SyntheticModule(['readHistoryMonth'], function () { this.setExport('readHistoryMonth', history.readHistoryMonth) }, { context })
  const apiSource = readFileSync(new URL('../src/utils/api.js', import.meta.url), 'utf8')
  const hookSource = readFileSync(new URL('../src/hooks/useExpenses.js', import.meta.url), 'utf8')
  const apiModule = new vm.SourceTextModule(apiSource, { context, initializeImportMeta: meta => { meta.env = { VITE_API_URL: 'https://synthetic.invalid' } } })
  await apiModule.link(specifier => {
    if (specifier.includes('useStore')) return storeModule
    if (specifier.includes('expenseHistory')) return historyModule
    throw Error('Unexpected application import blocked')
  })
  await apiModule.evaluate()
  const dates = new vm.SyntheticModule(['addMonths', 'format', 'startOfMonth'], function () {
    for (const name of ['addMonths', 'format', 'startOfMonth']) this.setExport(name, () => { throw Error('Recurring expansion blocked in this fixture') })
  }, { context })
  const hookModule = new vm.SourceTextModule(hookSource, { context })
  await hookModule.link(specifier => {
    if (specifier === 'date-fns') return dates
    if (specifier.includes('useStore')) return storeModule
    if (specifier.includes('api.js')) return apiModule
    throw Error('Unexpected application import blocked')
  })
  await hookModule.evaluate()
  const hook = hookModule.namespace.useExpenses()
  await hook.addExpense(row())
  assert.equal(rows.length, 2)
  assert.equal(rows[0].id, rows[1].id)
  const snapshot = JSON.stringify(rows), previousWrites = writes
  const result = await hook.getHistoryForMonth(month)
  assert.equal(result.status, 'fallback')
  assert.equal(result.expenses.length, 2)
  assert.equal(result.limited, true)
  assert.equal(writes, previousWrites)
  assert.equal(JSON.stringify(rows), snapshot)
})

test('Workstream A controls retain native labelled month selection and non-sticky wrapping layout', () => {
  const source = readFileSync(new URL('../src/pages/Expenses.jsx', import.meta.url), 'utf8')
  const controls = source.slice(source.indexOf('      {/* ── Tab bar'), source.indexOf('      <div className="px-4 py-4 max-w-7xl'))
  assert.ok(!/\bsticky\b|\bfixed\b|\boverflow-hidden\b/.test(controls))
  assert.ok(controls.includes('flex flex-wrap items-center'))
  assert.ok(controls.includes('basis-20 min-w-0 break-words'))
  assert.ok(controls.includes('activeTab !== \'add\''))
  assert.ok(controls.includes('<label htmlFor="expense-month"'))
  assert.ok(controls.includes('<select') && controls.includes('id="expense-month"'))
})

test('retained server row remains collision-protected when every matching local copy has an unknown month', async () => {
  const local = Object.freeze([Object.freeze(row({ date: null })), Object.freeze(row({ date: 'unparseable' }))])
  const before = JSON.stringify(local)
  const fallback = await read(async () => { throw Error('Synthetic offline') }, local)
  assert.equal(fallback.status, 'error')
  assert.equal(fallback.expenses.length, 0)
  assert.deepEqual(fallback.collisionIds, ['synthetic-one'])
  const states = []; let call = 0
  const loader = history.createHistoryLoader(async () => ++call === 1 ? success() : fallback, state => states.push(state))
  await loader.load(month); await loader.load(month)
  const retained = states.at(-1)
  assert.equal(retained.retained, true)
  assert.equal(retained.expenses.length, 1)
  assert.deepEqual(retained.limitations.duplicateIds, ['synthetic-one'])
  assert.ok(retained.collisionIds.includes(retained.expenses[0].id))
  assert.ok(history.localHistoryWarnings(retained.limitations, true).some(message => message.includes('Affected Delete controls are unavailable')))
  assert.equal(JSON.stringify(local), before)
})

test('collision scan preserves exact IDs and ignores record display eligibility without mutating data', () => {
  const local = Object.freeze([
    Object.freeze(row({ date: null })), Object.freeze(row({ amount: 'invalid' })),
    Object.freeze(row({ id: 'synthetic-one ', date: null })), Object.freeze(row({ id: 'SYNTHETIC-ONE' })),
    Object.freeze(row({ id: 1 })), null,
  ])
  const before = JSON.stringify(local)
  assert.deepEqual(history.findLocalIdCollisions(local), ['synthetic-one'])
  assert.equal(JSON.stringify(local), before)
})

test('unrelated collisions remain available for Delete protection without limiting valid requested-month data', async () => {
  const local = [row(), row({ id: 'synthetic-may', date: '2026-05-01' }), row({ id: 'synthetic-may', date: '2026-05-01', amount: 'invalid' })]
  const result = await read(async () => { throw Error('Synthetic offline') }, local)
  assert.deepEqual(result.collisionIds, ['synthetic-may'])
  assert.deepEqual(result.limitations.duplicateIds, [])
  assert.equal(result.expenses.length, 1)
  assert.equal(result.limited, false)
  assert.equal(result.categoryTotals.other, 1)
})

test('hung read reaches explicit timeout instead of verified empty and releases its timer', async () => {
  const clock = fakeClock(), states = []
  const loader = timedLoader(() => new Promise(() => {}), states, clock)
  const pending = loader.load(month)
  clock.advance(99)
  assert.equal(states.at(-1).status, 'loading')
  clock.advance(1); await pending
  assert.equal(states.at(-1).status, 'error')
  assert.equal(states.at(-1).error, 'TIMEOUT')
  assert.equal(states.at(-1).retained, false)
  assert.equal(states.at(-1).expenses.length, 0)
  assert.ok(history.historyErrorMessage('TIMEOUT').includes('Retry'))
  assert.equal(clock.pendingCount, 0)
})

test('timeout retains only a successful same-month response and remains unverified', async () => {
  const clock = fakeClock(), states = []; let call = 0
  const loader = timedLoader(() => ++call === 1 ? Promise.resolve(success()) : new Promise(() => {}), states, clock)
  await loader.load(month)
  const pending = loader.load(month)
  clock.advance(100); await pending
  assert.equal(states.at(-1).status, 'error')
  assert.equal(states.at(-1).error, 'TIMEOUT')
  assert.equal(states.at(-1).retained, true)
  assert.equal(states.at(-1).source, 'previous-response')
  assert.equal(states.at(-1).freshness, 'unverified')
  assert.equal(states.at(-1).expenses.length, 1)
  const anotherMonth = loader.load('2026-07')
  clock.advance(100); await anotherMonth
  assert.equal(states.at(-1).month, '2026-07')
  assert.equal(states.at(-1).retained, false)
  assert.equal(states.at(-1).expenses.length, 0)
})

test('retry owns loading and ignores the previous reader completing after its timeout', async () => {
  const clock = fakeClock(), a = deferred(), b = deferred(), states = []; let call = 0
  const loader = timedLoader(() => ++call === 1 ? a.promise : b.promise, states, clock)
  const first = loader.load(month)
  clock.advance(100); await first
  const retry = loader.load(month)
  const count = states.length
  a.resolve(success()); await Promise.resolve()
  assert.equal(states.length, count)
  assert.equal(states.at(-1).status, 'loading')
  assert.equal(clock.pendingCount, 1)
  b.resolve(success(month, [row({ id: 'synthetic-retry' })])); await retry
  assert.equal(states.at(-1).expenses[0].id, 'synthetic-retry')
  assert.equal(clock.pendingCount, 0)
})

test('superseded hung request settles without publishing or timing out the newer month', async () => {
  const clock = fakeClock(), a = deferred(), b = deferred(), states = []; let call = 0
  const loader = timedLoader(() => ++call === 1 ? a.promise : b.promise, states, clock)
  const first = loader.load(month)
  clock.advance(50)
  const newer = loader.load('2026-07')
  await first // Cancellation resolves the wrapper even though a has not settled.
  assert.equal(clock.pendingCount, 1)
  clock.advance(50)
  assert.equal(states.at(-1).status, 'loading')
  const count = states.length
  a.resolve(success()); await Promise.resolve()
  assert.equal(states.length, count)
  b.resolve(success('2026-07', [row({ date: '2026-07-01' })])); await newer
  assert.equal(states.at(-1).month, '2026-07')
  assert.equal(states.at(-1).status, 'success')
  clock.advance(500)
  assert.equal(states.at(-1).status, 'success')
})

test('unmount cancels a hung wrapper and removes timers; late resolution cannot publish', async () => {
  const clock = fakeClock(), pendingRead = deferred(), states = []
  const loader = timedLoader(() => pendingRead.promise, states, clock)
  const pending = loader.load(month)
  loader.invalidate(); await pending
  assert.equal(clock.pendingCount, 0)
  clock.advance(500)
  pendingRead.resolve(success()); await Promise.resolve()
  await loader.load(month)
  assert.equal(states.length, 1)
})

test('late reader rejection after timeout is consumed without replacing the timeout state', async () => {
  const clock = fakeClock(), states = []; let rejectRead
  const reader = new Promise((resolve, reject) => { rejectRead = reject })
  const loader = timedLoader(() => reader, states, clock)
  const pending = loader.load(month)
  clock.advance(100); await pending
  const count = states.length
  rejectRead(Error('Synthetic late failure')); await Promise.resolve()
  assert.equal(states.length, count)
  assert.equal(states.at(-1).error, 'TIMEOUT')
})

test('confirmed deletion remains removed from the retained view when refresh times out', async () => {
  const clock = fakeClock(), states = []; let call = 0
  const loader = timedLoader(() => ++call === 1 ? Promise.resolve(success()) : new Promise(() => {}), states, clock)
  await loader.load(month)
  const pending = loader.load(month)
  loader.removeExpense('synthetic-one')
  assert.equal(states.at(-1).status, 'loading')
  clock.advance(100); await pending
  assert.equal(states.at(-1).error, 'TIMEOUT')
  assert.equal(states.at(-1).retained, true)
  assert.equal(states.at(-1).expenses.length, 0)
})

test('History timeout is bounded by default; invalid timeout configuration cannot disable the deadline', () => {
  assert.equal(history.HISTORY_TIMEOUT_MS, 15_000)
  for (const timeoutMs of [0, -1, Infinity, NaN]) {
    assert.throws(() => history.createHistoryLoader(() => {}, () => {}, { timeoutMs }), TypeError)
  }
})
