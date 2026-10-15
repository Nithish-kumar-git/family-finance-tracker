import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { transformSync } from 'esbuild'
import { demoRequest, validateFile, createOperationGate, DEMO_BASE } from '../src/ragDemo/client.js'

globalThis.fetch = () => { throw Error('External network forbidden in synthetic tests') }
const ok = value => ({ ok: true, json: async () => value })

test('separate loopback destination, memory token and no cache/cookies', async () => {
  let observed
  const result = await demoRequest('/rag/documents', { token: 'synthetic-session', fetchImpl: async (...args) => { observed = args; return ok({ documents: [] }) } })
  assert.deepEqual(result, { documents: [] })
  assert.equal(observed[0], `${DEMO_BASE}/rag/documents`)
  assert.equal(observed[1].headers.Authorization, 'Bearer synthetic-session')
  assert.equal(observed[1].cache, 'no-store'); assert.equal(observed[1].credentials, 'omit')
})
test('upload sends raw synthetic bytes, not family state', async () => {
  let observed
  await demoRequest('/rag/documents', { method: 'POST', filename: 'synthetic sample.txt', body: 'synthetic savings', token: 'synthetic-session', fetchImpl: async (...args) => { observed = args; return ok({ id: 'sample' }) } })
  assert.match(observed[0], /filename=synthetic%20sample.txt$/)
  assert.equal(observed[1].body, 'synthetic savings'); assert.equal(observed[1].headers['X-Synthetic-Document'], 'true')
})
test('network failure, HTTP failure and malformed JSON are explicit', async () => {
  await assert.rejects(demoRequest('/rag/ask', { fetchImpl: async () => { throw TypeError('synthetic network') } }), /could not be reached/)
  await assert.rejects(demoRequest('/rag/ask', { fetchImpl: async () => ({ ok: false, status: 503, json: async () => ({ detail: 'Demo provider unavailable' }) }) }), /provider unavailable/)
  await assert.rejects(demoRequest('/rag/ask', { fetchImpl: async () => ({ ok: true, json: async () => { throw Error('bad JSON') } }) }), /invalid response/)
})
test('expired session asks for separate demo login', async () => {
  await assert.rejects(demoRequest('/rag/documents', { fetchImpl: async () => ({ ok: false, status: 401, json: async () => ({}) }) }), /expired/)
})
test('timeout bounded even if transport ignores AbortSignal; late completion cannot publish', async () => {
  let resolve
  const request = demoRequest('/rag/ask', { deadlineMs: 10, fetchImpl: () => new Promise(r => { resolve = r }) })
  await assert.rejects(request, /timed out/)
  resolve(ok({ answer: 'late synthetic answer' }))
  const fresh = await demoRequest('/rag/ask', { fetchImpl: async () => ok({ answer: 'new synthetic answer' }) })
  assert.equal(fresh.answer, 'new synthetic answer')
})
test('operation gate blocks overlaps and invalidates after logout/unmount', () => {
  const gate = createOperationGate(), first = gate.start()
  assert.equal(gate.start(), null); assert.equal(gate.current(first), true)
  gate.invalidate(); const second = gate.start()
  assert.equal(gate.current(first), false); gate.finish(first); assert.equal(gate.current(second), true)
  gate.finish(second); assert.notEqual(gate.start(), null)
})
test('file boundaries and unrelated endpoints rejected before network', async () => {
  validateFile({ name: 'sample.PDF', size: 100 })
  for (const file of [null, { name: 'x.exe', size: 10 }, { name: 'x.txt', size: 0 }, { name: 'x.txt', size: 3 * 1024 * 1024 }]) assert.throws(() => validateFile(file))
  await assert.rejects(demoRequest('/api/expenses'), /Invalid demo endpoint/)
})

async function componentHarness(fetchImpl) {
  const slots = [], effects = []
  let cursor = 0, mounted = true, lateUpdates = 0
  const react = {
    Fragment: Symbol('fragment'),
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState(initial) {
      const index = cursor++
      if (!(index in slots)) slots[index] = initial
      return [slots[index], next => {
        if (!mounted) { lateUpdates++; return }
        slots[index] = typeof next === 'function' ? next(slots[index]) : next
      }]
    },
    useRef(initial) {
      const index = cursor++
      if (!(index in slots)) slots[index] = { current: initial }
      return slots[index]
    },
    useEffect(callback) {
      const index = cursor++
      if (!(index in slots)) { slots[index] = {}; effects.push(() => { slots[index].cleanup = callback() }) }
    },
  }
  const context = vm.createContext({ document: { getElementById: () => ({}) }, window: { confirm: () => true } })
  const source = readFileSync(new URL('../src/ragDemo/main.jsx', import.meta.url), 'utf8')
  const component = new vm.SourceTextModule(transformSync(source, { loader: 'jsx', format: 'esm', jsx: 'transform' }).code, { context })
  const modules = {
    react: { default: react, useState: react.useState, useRef: react.useRef, useEffect: react.useEffect },
    'react-dom/client': { createRoot: () => ({ render() {} }) },
    './client.js': { demoRequest: (path, options) => demoRequest(path, { ...options, fetchImpl }), validateFile, createOperationGate },
    './style.css': {},
  }
  await component.link(name => {
    assert.ok(modules[name], 'Only isolated demo imports are allowed')
    return new vm.SyntheticModule(Object.keys(modules[name]), function () {
      for (const [key, value] of Object.entries(modules[name])) this.setExport(key, value)
    }, { context })
  })
  await component.evaluate()
  function render() {
    cursor = 0
    const nodes = []
    function visit(node) {
      if (Array.isArray(node)) return node.forEach(visit)
      if (node?.props) { nodes.push(node); visit(node.props.children) }
    }
    visit(component.namespace.RagDemo())
    while (effects.length) effects.shift()()
    return nodes
  }
  const find = predicate => {
    const node = render().find(predicate)
    assert.ok(node, 'Expected actual RAG demo control')
    return node
  }
  const button = text => find(n => n.type === 'button' && n.props.children.includes(text))
  const flush = async () => { for (let i = 0; i < 40; i++) await Promise.resolve() }
  render()
  return {
    render, find, button, flush,
    text: () => render().flatMap(n => n.props.children.filter(c => typeof c === 'string')).join('\n'),
    async login() {
      find(n => n.props.autoComplete === 'username').props.onChange({ target: { value: 'synthetic' } })
      find(n => n.props.autoComplete === 'current-password').props.onChange({ target: { value: 'synthetic-demo-password' } })
      find(n => n.type === 'form').props.onSubmit({ preventDefault() {} })
      await flush()
    },
    ask() {
      find(n => n.type === 'textarea').props.onChange({ target: { value: 'Synthetic insurance question?' } })
      render().filter(n => n.type === 'form')[1].props.onSubmit({ preventDefault() {} })
    },
    unmount() { mounted = false; slots.forEach(slot => slot?.cleanup?.()) },
    lateUpdates: () => lateUpdates,
  }
}
const documentFixture = { id: '00000000-0000-4000-8000-000000000001', filename: 'synthetic.txt', chunks: 1 }
const sessionTransport = async url => url.endsWith('/rag/login') ? ok({ token: 'synthetic-token' }) : ok({ documents: [documentFixture] })

test('actual React demo shows loading, grounded answer and inspectable citation', async () => {
  let resolve
  const h = await componentHarness((url, config) => url.endsWith('/rag/ask')
    ? new Promise(r => { resolve = r }) : sessionTransport(url, config))
  await h.login(); h.ask()
  assert.ok(h.text().includes('Retrieving evidence and generating answer'))
  assert.equal(h.find(n => n.type === 'fieldset').props.disabled, true)
  resolve(ok({ answer: 'Synthetic thirty-day window.', abstained: false, citations: [{ source: 1, filename: 'synthetic.txt', page: 1, quote: 'Synthetic supporting quote.', passage: 'Synthetic supporting quote.' }] }))
  await h.flush()
  assert.ok(h.text().includes('Synthetic thirty-day window.'))
  assert.ok(h.render().some(n => n.type === 'details'))
  assert.equal(h.find(n => n.type === 'fieldset').props.disabled, false)
})
test('actual React demo reports AI failure and allows retry without inventing an answer', async () => {
  let calls = 0
  const h = await componentHarness((url, config) => url.endsWith('/rag/ask')
    ? Promise.resolve(++calls === 1 ? { ok: false, status: 503, json: async () => ({ detail: 'Demo AI unavailable' }) } : ok({ answer: 'Insufficient evidence.', abstained: true, citations: [] }))
    : sessionTransport(url, config))
  await h.login(); h.ask(); await h.flush()
  assert.ok(h.text().includes('Demo AI unavailable'))
  assert.equal(h.find(n => n.type === 'fieldset').props.disabled, false)
  h.ask(); await h.flush()
  assert.ok(h.text().includes('Insufficient evidence'))
  assert.equal(calls, 2)
})
test('actual React logout and unmount prevent late answer publication', async () => {
  let resolve
  const h = await componentHarness((url, config) => url.endsWith('/rag/ask')
    ? new Promise(r => { resolve = r }) : sessionTransport(url, config))
  await h.login(); h.ask(); h.button('Sign out').props.onClick()
  resolve(ok({ answer: 'Obsolete synthetic answer', abstained: false, citations: [] }))
  await h.flush()
  assert.ok(!h.text().includes('Obsolete synthetic answer'))
  assert.ok(h.text().includes('Separate demo account'))
  await h.login(); h.ask(); h.unmount()
  resolve(ok({ answer: 'Unmounted synthetic answer', abstained: false, citations: [] }))
  await h.flush(); assert.equal(h.lateUpdates(), 0)
})
