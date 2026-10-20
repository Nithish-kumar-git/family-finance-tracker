// Run: node --jitless --experimental-vm-modules --test tests/ammaChat.test.mjs
// --jitless avoids a native Windows Node 22 crash in repeated experimental VM tests.
// Actual chat transport/API/Dashboard; only synthetic state and mocked requests.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { transformSync } from 'esbuild'
import { readChat, getChatErrorMessage, CHAT_TIMEOUT_MS } from '../src/utils/ammaChat.js'

globalThis.fetch = () => { throw Error('External network blocked in tests') }
const source = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const chatSource = source('../src/utils/ammaChat.js')
const apiSource = source('../src/utils/api.js')
const dashboardSource = source('../src/pages/Dashboard.jsx')
const fixture = { mode: 'personal', baseUrl: 'https://synthetic.invalid', question: 'Synthetic question', context: { synthetic: true }, history: [] }
const ok = answer => ({ ok: true, status: 200, json: async () => ({ answer }) })
const deferred = () => {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
const flush = async () => { for (let i = 0; i < 30; i++) await Promise.resolve() }

function fakeClock() {
  let now = 0, nextId = 0
  const pending = new Map()
  return {
    setTimer(callback, delay) { const id = ++nextId; pending.set(id, { at: now + delay, callback }); return id },
    clearTimer(id) { pending.delete(id) },
    advance(ms) {
      now += ms
      for (const [id, task] of [...pending]) {
        if (task.at <= now) { pending.delete(id); task.callback() }
      }
    },
    get size() { return pending.size },
  }
}

test('chat preserves its URL, POST request fields and successful response without rewriting', async () => {
  const before = JSON.stringify(fixture)
  const response = { answer: 'Synthetic answer', extra: 'preserved' }
  const result = await readChat({ ...fixture, fetchImpl: async (url, config) => {
    assert.equal(url, 'https://synthetic.invalid/api/ai/chat')
    assert.equal(config.method, 'POST')
    assert.equal(config.headers['Content-Type'], 'application/json')
    assert.deepEqual(JSON.parse(config.body), { question: fixture.question, context: fixture.context, history: fixture.history })
    return { ok: true, json: async () => response }
  } })
  assert.equal(result, response)
  assert.equal(JSON.stringify(fixture), before)
})

test('transport failures are classified without leaking the underlying exception', async () => {
  await assert.rejects(readChat({ ...fixture, fetchImpl: async () => { throw Error('Synthetic sensitive detail') } }), error => {
    assert.equal(error.code, 'NETWORK')
    assert.equal(error.status, undefined)
    assert.ok(getChatErrorMessage(error).includes('could not reach'))
    assert.ok(!getChatErrorMessage(error).includes('Synthetic sensitive detail'))
    return true
  })
})

for (const status of [401, 403, 429, 503]) {
  test(`HTTP ${status} is not reported as a transport/offline failure`, async () => {
    await assert.rejects(readChat({ ...fixture, fetchImpl: async () => ({
      ok: false, status, json: () => { throw Error('Error bodies must not be read') },
    }) }), error => {
      assert.equal(error.code, 'HTTP')
      assert.equal(error.status, status)
      assert.ok(getChatErrorMessage(error).includes(`HTTP ${status}`))
      assert.ok(!getChatErrorMessage(error).includes('could not reach'))
      return true
    })
  })
}

for (const [name, json] of [
  ['JSON parse failure', () => { throw SyntaxError('Synthetic bad JSON') }],
  ['null', async () => null],
  ['unexpected wrapper', async () => ({ data: { answer: 'Synthetic' } })],
  ['wrong answer type', async () => ({ answer: 123 })],
  ['empty answer', async () => ({ answer: '  ' })],
]) {
  test(`${name} produces an explicit response error instead of a fabricated answer`, async () => {
    await assert.rejects(readChat({ ...fixture, fetchImpl: async () => ({ ok: true, json }) }), { code: 'INVALID_RESPONSE' })
  })
}

test('deadline covers stalled JSON parsing and clears its timer', async () => {
  const clock = fakeClock()
  const parsing = deferred()
  let signal
  const pending = readChat({ ...fixture, ...clock, fetchImpl: async (_, config) => {
    signal = config.signal
    return { ok: true, json: () => parsing.promise }
  } })
  const rejected = assert.rejects(pending, { code: 'TIMEOUT' })
  await flush()
  clock.advance(CHAT_TIMEOUT_MS)
  await rejected
  assert.equal(signal.aborted, true)
  assert.equal(clock.size, 0)
  parsing.resolve({ answer: 'Late synthetic answer' })
  await flush()
})

test('pre-cancelled requests do not call fetch or create a deadline', async () => {
  const controller = new AbortController()
  controller.abort()
  const clock = fakeClock()
  await assert.rejects(readChat({ ...fixture, ...clock, signal: controller.signal,
    fetchImpl: () => { throw Error('Cancelled requests must not fetch') },
  }), { code: 'CANCELLED' })
  assert.equal(clock.size, 0)
})

for (const [code, retryable, message] of [
  ['AI_RATE_LIMITED', true, /Wait a minute/],
  ['AI_UNAVAILABLE', true, /temporarily unavailable/],
  ['AI_TIMEOUT', true, /too long/],
  ['AI_INVALID_RESPONSE', true, /incomplete response/],
  ['AI_NOT_CONFIGURED', false, /administrator/],
  ['AI_CONFIGURATION', false, /administrator/],
]) {
  test(`provider envelope ${code} is recognized without displaying internal text`, async () => {
    await assert.rejects(readChat({ ...fixture, fetchImpl: async () => ({
      ok: false, status: code === 'AI_RATE_LIMITED' ? 429 : 503,
      json: async () => ({ error: { code, retryable: !retryable, message: 'Synthetic sensitive exception' } }),
    }) }), error => {
      assert.equal(error.code, code)
      assert.equal(error.retryable, retryable)
      assert.match(getChatErrorMessage(error), message)
      assert.doesNotMatch(getChatErrorMessage(error), /sensitive/)
      return true
    })
  })
}

test('unrecognized error envelopes use HTTP status and sanitize arbitrary text', async () => {
  await assert.rejects(readChat({ ...fixture, fetchImpl: async () => ({ ok: false, status: 403,
    json: async () => ({ error: { code: 'unknown-secret', message: 'Synthetic sensitive detail', retryable: true } }),
  }) }), error => {
    assert.equal(error.code, 'HTTP')
    assert.equal(error.retryable, false)
    assert.doesNotMatch(getChatErrorMessage(error), /sensitive/)
    return true
  })
})

// Tiny persistent hook renderer executes the real Dashboard handlers and effects.
// JSX is transformed in memory for tests only; no app build or output files.
async function dashboardHarness(fetchImpl) {
  const clock = fakeClock()
  const offlineUpdates = []
  const blocked = () => { throw Error('Unexpected storage, navigation or data mutation') }
  const state = {
    currentUser: 'synthetic-user', users: [{ id: 'synthetic-user', name: 'Synthetic user' }],
    expenses: [], milestones: [], monthlySnapshots: [], budgets: {},
    monthlyIncome: { nithish: 0, pension: 0, abeerami: 0 },
    emergencyFund: { liquidFundBalance: 0, cashInBank: 0, target: 1, isIsolated: true },
    isOffline: false,
    setIsOffline(value) { state.isOffline = value; offlineUpdates.push(value) },
    setExpensesForMonth: blocked,
  }
  const beforeData = JSON.stringify({ ...state, isOffline: undefined })
  const store = selector => selector ? selector(state) : state
  store.getState = () => state
  const context = vm.createContext({
    fetch: fetchImpl, AbortController, URLSearchParams,
    setTimeout: clock.setTimer, clearTimeout: clock.clearTimer,
    localStorage: { getItem: blocked, setItem: blocked, removeItem: blocked, clear: blocked },
    window: { location: { reload: blocked } },
  })
  const stubModule = values => new vm.SyntheticModule(Object.keys(values), function () {
    for (const [key, value] of Object.entries(values)) this.setExport(key, value)
  }, { context })
  const chat = new vm.SourceTextModule(chatSource, { context })
  await chat.link(specifier => specifier.includes('workspace') ? stubModule({ workspaceMode: 'personal' }) : stubModule({ authorizedFetch: (...args) => context.fetch(...args), serverAuthorizedFetch: (...args) => context.fetch(...args) }))
  await chat.evaluate()
  const apiModule = new vm.SourceTextModule(apiSource, { context, initializeImportMeta: meta => { meta.env = { VITE_API_URL: fixture.baseUrl } } })
  await apiModule.link(specifier => {
    if (specifier.includes('workspace')) return stubModule({ workspaceMode: 'personal' })
    if (specifier.includes('authorizedFetch')) return stubModule({ authorizedFetch: (...args) => context.fetch(...args), serverAuthorizedFetch: (...args) => context.fetch(...args) })
    if (specifier === './ammaChat.js') return chat
    if (specifier === '../store/useStore.js') return stubModule({ default: store })
    if (specifier === './expenseHistory.js') return stubModule({ readHistoryMonth: blocked })
    throw Error('Unexpected API import')
  })
  await apiModule.evaluate()
  const actualApi = apiModule.namespace.api
  const dashboardApi = { ...actualApi,
    // No dashboard data loading/persistence in chat tests; actual chat stays intact.
    milestones: { getAll: async () => [] }, employment: { getStats: async () => ({}) },
    expenses: { getByMonth: async () => ({}) },
  }
  const slots = [], effects = []
  let cursor = 0, mounted = true, afterUnmountUpdates = 0
  const React = {
    Fragment: Symbol('test-fragment'),
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
  }
  context.React = React
  const hooks = {
    useState(initial) {
      const index = cursor++
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial
      return [slots[index], next => {
        if (!mounted) { afterUnmountUpdates++; return }
        slots[index] = typeof next === 'function' ? next(slots[index]) : next
      }]
    },
    useRef(initial) {
      const index = cursor++
      if (!(index in slots)) slots[index] = { current: initial }
      return slots[index]
    },
    useEffect(callback, deps) {
      const index = cursor++
      const previous = slots[index]
      if (!previous || deps.some((dep, i) => !Object.is(dep, previous.deps[i]))) {
        effects.push(() => {
          previous?.cleanup?.()
          slots[index] = { deps, cleanup: callback() }
        })
      }
    },
  }
  const stub = () => null
  const exports = {
    react: hooks, 'react-router-dom': { useNavigate: () => blocked },
    '../store/useStore': { default: store }, '../utils/api': { api: dashboardApi },
    '../utils/formatters': Object.fromEntries(['formatCurrency', 'formatDeficit', 'formatDate', 'daysUntil', 'getGreeting', 'formatMonth'].map(key => [key, () => 'Synthetic'])),
    '../utils/calculations': Object.fromEntries(['getTotalCorpus', 'getFDTotal', 'getMFTotal', 'getGoldTotal', 'getMonthlyIncome', 'getMonthlyExpensesTotal', 'getMonthlyDeficit'].map(key => [key, () => 0])),
    'lucide-react': Object.fromEntries(['MessageCircle', 'X', 'Send', 'Sparkles', 'Plus', 'Lock', 'Briefcase', 'AlertCircle', 'ShoppingCart', 'Zap', 'Heart', 'Car', 'Home', 'Shield', 'Users', 'User', 'BookOpen', 'MoreHorizontal'].map(key => [key, stub])),
    '../components/ui/Badge': { default: stub }, '../components/charts/SparkLine': { default: stub },
    '../data/seedData': { EXPENSE_CATEGORIES: {} }, // Never load the real seed file.
  }
  const component = new vm.SourceTextModule(transformSync(dashboardSource, { loader: 'jsx', format: 'esm', jsx: 'transform' }).code, { context })
  await component.link(specifier => {
    if (specifier.includes('workspace')) return stubModule({ workspaceMode: 'personal' })
    if (specifier === '../utils/ammaChat') return chat
    if (!exports[specifier]) throw Error(`Unexpected Dashboard import: ${specifier}`)
    return stubModule(exports[specifier])
  })
  await component.evaluate()
  function render() {
    cursor = 0
    const tree = component.namespace.default()
    const nodes = []
    function visit(node) {
      if (Array.isArray(node)) { node.forEach(visit); return }
      if (node && typeof node === 'object' && node.props) { nodes.push(node); visit(node.props.children) }
    }
    visit(tree)
    while (effects.length) effects.shift()()
    return nodes
  }
  const find = predicate => {
    const match = render().find(predicate)
    assert.ok(match, 'Expected actual Dashboard control')
    return match
  }
  render()
  await flush()
  find(node => node.props['aria-label'] === 'Open finance assistant').props.onClick()
  return {
    clock, actualApi, state, offlineUpdates, render,
    input: () => find(node => node.props['aria-label'] === 'Message finance assistant'),
    send(question = 'Synthetic question') {
      find(node => node.props['aria-label'] === 'Message finance assistant').props.onChange({ target: { value: question } })
      return find(node => node.props['aria-label'] === 'Send message').props.onClick()
    },
    retry: () => find(node => node.type === 'button' && node.props.children.includes('Retry')).props.onClick(),
    alerts: () => render().filter(node => node.props.role === 'alert'),
    text: () => render().flatMap(node => node.props.children.filter(child => typeof child === 'string')).join('\n'),
    unmount() {
      mounted = false
      slots.forEach(slot => slot?.cleanup?.())
    },
    assertPreserved() {
      assert.equal(JSON.stringify({ ...state, isOffline: undefined }), beforeData)
      assert.equal(afterUnmountUpdates, 0)
    },
  }
}

for (const failure of ['network', 'HTTP']) {
  test(`actual unrelated ${failure} failure does not disable the real chat drawer or alter chat status`, async () => {
    const h = await dashboardHarness(async url => {
      if (url.endsWith('/api/ai/chat')) return ok('Synthetic successful answer')
      if (failure === 'network') throw Error('Synthetic network failure')
      return { ok: false, status: 500 }
    })
    await h.actualApi.milestones.getAll()
    assert.equal(h.state.isOffline, true)
    assert.equal(h.input().props.disabled, false)
    assert.equal(h.alerts().length, 0)
    await h.send()
    assert.ok(h.text().includes('Synthetic successful answer'))
    assert.equal(h.state.isOffline, true, 'Chat success must not rewrite other endpoints status')
    assert.deepEqual(h.offlineUpdates, [true])
    h.assertPreserved()
  })
}

for (const [code, retryable] of [['AI_RATE_LIMITED', true], ['AI_CONFIGURATION', false], ['AI_NOT_CONFIGURED', false]]) {
  test(`actual chat renders recovery for ${code} and preserves conversation`, async () => {
    const h = await dashboardHarness(async () => ({ ok: false, status: 503,
      json: async () => ({ error: { code, retryable, message: 'Synthetic sensitive text' } }),
    }))
    await h.send()
    assert.equal(h.alerts().length, 1)
    assert.equal(h.text().includes('Retry'), retryable)
    assert.doesNotMatch(h.text(), /sensitive/)
    assert.ok(h.text().includes('Synthetic question'))
    h.assertPreserved()
  })
}

for (const failure of ['network', 'HTTP', 'response']) {
  test(`actual chat ${failure} failure shows an error and Retry, retaining successful conversation`, async () => {
    const calls = []
    const h = await dashboardHarness(async (_, config) => {
      calls.push(JSON.parse(config.body))
      if (calls.length === 2) {
        if (failure === 'network') throw Error('Synthetic network failure')
        if (failure === 'HTTP') return { ok: false, status: 503 }
        return { ok: true, json: async () => ({ unexpected: true }) }
      }
      return ok(calls.length === 1 ? 'Prior synthetic answer' : 'Retried synthetic answer')
    })
    await h.send('First synthetic question')
    await h.send('Failed synthetic question')
    assert.equal(h.input().props.disabled, false)
    assert.equal(h.alerts().length, 1)
    const text = h.text()
    assert.ok(text.includes('Prior synthetic answer'))
    assert.ok(text.includes(failure === 'network' ? 'could not reach' : failure === 'HTTP' ? 'HTTP 503' : 'unreadable or incomplete'))
    assert.ok(!text.includes("I'm unable to answer"), 'Error is not fabricated as an assistant response')
    await h.retry()
    assert.deepEqual(calls[2], calls[1], 'Retry preserves question, context and preceding history')
    assert.equal(h.alerts().length, 0)
    assert.equal(h.input().props.disabled, false)
    assert.equal(h.text().split('Failed synthetic question').length - 1, 1, 'Retry does not duplicate the user turn')
    assert.ok(h.text().includes('Retried synthetic answer'))
    assert.deepEqual(h.offlineUpdates, [], 'Chat failures and successes never set global offline status')
    h.assertPreserved()
  })
}

test('stalled chat exposes Retry; late completion cannot overwrite a successful retry', async () => {
  const stalled = deferred()
  const calls = []
  let stalledSignal
  const h = await dashboardHarness(async (_, config) => {
    calls.push(JSON.parse(config.body))
    if (calls.length === 1) return ok('Retained synthetic answer')
    if (calls.length === 2) { stalledSignal = config.signal; return stalled.promise }
    return ok('Latest synthetic answer')
  })
  await h.send('First synthetic question')
  const pending = h.send('Stalled synthetic question')
  assert.equal(h.input().props.disabled, true)
  assert.ok(h.render().some(node => node.props.role === 'status'))
  h.clock.advance(CHAT_TIMEOUT_MS - 1)
  await flush()
  assert.equal(h.input().props.disabled, true)
  h.clock.advance(1)
  await pending
  assert.equal(stalledSignal.aborted, true)
  assert.equal(h.input().props.disabled, false)
  assert.ok(h.text().includes('took too long'))
  assert.ok(h.text().includes('Retained synthetic answer'))
  await h.retry()
  assert.deepEqual(calls[2], calls[1])
  stalled.resolve(ok('Obsolete synthetic answer'))
  await flush()
  assert.ok(h.text().includes('Latest synthetic answer'))
  assert.ok(!h.text().includes('Obsolete synthetic answer'))
  assert.equal(h.alerts().length, 0)
  assert.equal(h.clock.size, 0)
  h.assertPreserved()
})

test('rapid repeated sends cannot start overlapping chat requests or duplicate user turns', async () => {
  const pending = deferred()
  let calls = 0
  const h = await dashboardHarness(async () => { calls++; return pending.promise })
  const first = h.send('Synthetic repeated question')
  await h.send('Synthetic repeated question')
  assert.equal(calls, 1)
  assert.equal(h.text().split('Synthetic repeated question').length - 1, 1)
  pending.resolve(ok('Synthetic answer'))
  await first
  assert.equal(h.input().props.disabled, false)
  assert.equal(h.clock.size, 0)
  h.assertPreserved()
})

test('unmount cancels pending chat, clears the deadline and ignores late completion', async () => {
  const pending = deferred()
  let signal
  const h = await dashboardHarness(async (_, config) => { signal = config.signal; return pending.promise })
  const sending = h.send()
  h.unmount()
  await sending
  assert.equal(signal.aborted, true)
  assert.equal(h.clock.size, 0)
  pending.resolve(ok('Late unmounted synthetic answer'))
  await flush()
  h.assertPreserved()
})


test('demo chat reaches the real network contract without serializing financial context', async () => {
  const privateContext = { account: 'PRIVATE-MARKER' }
  const result = await readChat({ ...fixture, mode: 'demo', context: privateContext,
    fetchImpl: async (url, options) => {
      assert.equal(url, 'https://synthetic.invalid/api/demo/ai/chat')
      assert.deepEqual(JSON.parse(options.body), { question: fixture.question, history: [] })
      assert.ok(!options.body.includes('PRIVATE-MARKER'))
      assert.equal(options.cache, 'no-store')
      assert.equal(options.headers.Authorization, undefined)
      return ok('Actual provider-shaped answer')
    } })
  assert.equal(result.answer, 'Actual provider-shaped answer')
})

test('a personal PIN alone never authorizes or sends a private AI request', async () => {
  await assert.rejects(readChat({ ...fixture }), { code: 'AUTH_REQUIRED', retryable: false })
  assert.match(getChatErrorMessage({ code: 'AUTH_REQUIRED' }), /PIN does not authorize/)
})
