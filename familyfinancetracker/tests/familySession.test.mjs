import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'
import { transformSync } from 'esbuild'

const read = file => readFileSync(new URL(file, import.meta.url), 'utf8')
const flush = async () => { for (let i = 0; i < 25; i++) await Promise.resolve() }
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }

async function componentHarness(file, dependencies, globals = {}) {
  const slots = [], effects = []
  let cursor = 0
  const context = vm.createContext({ AbortController, setTimeout, clearTimeout, ...globals })
  context.React = { createElement: (type, props, ...children) => ({ type, props: { ...props, children } }) }
  const hooks = {
    createContext: () => ({ Provider: 'context-provider' }), useContext: () => null,
    useState(value) {
      const index = cursor++
      if (!(index in slots)) slots[index] = typeof value === 'function' ? value() : value
      return [slots[index], next => { slots[index] = typeof next === 'function' ? next(slots[index]) : next }]
    },
    useRef(value) { const index = cursor++; return slots[index] ?? (slots[index] = { current: value }) },
    useEffect(callback, deps) {
      const index = cursor++, previous = slots[index]
      if (!previous || deps.some((value, i) => value !== previous.deps[i])) effects.push(() => {
        previous?.cleanup?.(); slots[index] = { deps, cleanup: callback() }
      })
    },
  }
  const module = new vm.SourceTextModule(transformSync(read(file), { loader: 'jsx', format: 'esm' }).code, {
    context, initializeImportMeta: meta => { meta.env = { VITE_API_URL: 'https://synthetic.invalid' } },
  })
  await module.link(name => {
    const exports = name === 'react' ? hooks : dependencies[name]
    assert.ok(exports, `Unexpected import ${name}`)
    return new vm.SyntheticModule(Object.keys(exports), function () {
      for (const [key, value] of Object.entries(exports)) this.setExport(key, value)
    }, { context })
  })
  await module.evaluate()
  return {
    render() { cursor = 0; const tree = module.namespace.default({ children: 'synthetic-child' }); while (effects.length) effects.shift()(); return tree },
    unmount() { slots.forEach(slot => slot?.cleanup?.()) },
  }
}

async function sessionHarness(fetchImpl) {
  const writes = [], listeners = new Map()
  const auth = { getSession: async () => ({ data: { session: { access_token: 'synthetic-token' } } }),
    onAuthStateChange: callback => { auth.changed = callback; return { data: { subscription: { unsubscribe() {} } } } },
    signOut: async () => {},
  }
  const h = await componentHarness('../src/components/FamilySession.jsx', {
    '../utils/authClient.js': { authClient: { auth } },
    '../store/useStore.js': { default: { getState: () => ({ setCurrentUser: id => writes.push(id) }) } },
  }, { fetch: fetchImpl, window: { addEventListener: (name, callback) => listeners.set(name, callback), removeEventListener() {} } })
  return { ...h, auth, writes, listeners }
}

test('cached local identity cannot grant household access when the server denies the session', async () => {
  const h = await sessionHarness(async () => ({ ok: false, status: 403 }))
  try {
    h.render(); await flush(); h.render(); await flush()
    const value = h.render().props.value
    assert.equal(value.member, null)
    assert.equal(value.loading, false)
    assert.match(value.error, /Access could not be verified/)
    assert.deepEqual(h.writes, [])
  } finally { h.unmount() }
})

test('only the verified server profile activates the household UI', async () => {
  const h = await sessionHarness(async (url, config) => {
    assert.equal(url, 'https://synthetic.invalid/api/auth/me')
    assert.equal(config.headers.Authorization, 'Bearer synthetic-token')
    assert.equal(config.cache, 'no-store')
    return { ok: true, json: async () => ({ profileId: 'nithish' }) }
  })
  try {
    h.render(); await flush(); h.render(); await flush()
    assert.equal(h.render().props.value.member.profileId, 'nithish')
    assert.deepEqual(h.writes, ['nithish'])
    h.listeners.get('fft-auth-required')()
    assert.equal(h.render().props.value.member, null)
  } finally { h.unmount() }
})

test('sign-out invalidates a pending authorization response so it cannot reopen the UI', async () => {
  const pending = deferred()
  const h = await sessionHarness(() => pending.promise)
  try {
    h.render(); await flush(); h.render()
    h.auth.changed('SIGNED_OUT', null); h.render()
    pending.resolve({ ok: true, json: async () => ({ profileId: 'nithish' }) }); await flush()
    assert.equal(h.render().props.value.member, null)
    assert.deepEqual(h.writes, [])
  } finally { h.unmount() }
})

test('email-link login blocks duplicate sends and sanitizes failures', async () => {
  const pending = deferred(), requests = []
  const h = await componentHarness('../src/pages/Auth.jsx', {
    'react-router-dom': { Navigate: () => null },
    '../utils/authClient.js': { authClient: { auth: { signInWithOtp: body => { requests.push(body); return pending.promise } } } },
    '../components/FamilySession.jsx': { useFamilySession: () => ({ member: null, configured: true }) },
  }, { window: { location: { origin: 'https://synthetic.invalid' } } })
  const nodes = tree => {
    const result = []
    const visit = node => { if (Array.isArray(node)) node.forEach(visit); else if (node?.props) { result.push(node); visit(node.props.children) } }
    visit(tree); return result
  }
  const input = nodes(h.render()).find(node => node.type === 'input')
  input.props.onChange({ target: { value: 'synthetic@example.invalid' } })
  const submit = nodes(h.render()).find(node => node.type === 'form').props.onSubmit
  const first = submit({ preventDefault() {} }); await submit({ preventDefault() {} })
  assert.equal(requests.length, 1)
  assert.equal(requests[0].options.shouldCreateUser, false)
  pending.resolve({ error: { message: 'Synthetic private provider error' } }); await first
  const alert = nodes(h.render()).find(node => node.props.role === 'alert')
  assert.match(alert.props.children.join(''), /could not be sent/)
  assert.doesNotMatch(alert.props.children.join(''), /private/)
})

test('authorization failure cancels an outstanding response before the next render', async () => {
  const pending = deferred()
  const h = await sessionHarness(() => pending.promise)
  try {
    h.render(); await flush(); h.render()
    h.listeners.get('fft-auth-required')()
    pending.resolve({ ok: true, json: async () => ({ profileId: 'nithish' }) }); await flush()
    assert.equal(h.render().props.value.member, null)
    assert.deepEqual(h.writes, [])
  } finally { h.unmount() }
})
