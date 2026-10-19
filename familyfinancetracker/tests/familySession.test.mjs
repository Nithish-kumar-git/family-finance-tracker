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
        previous?.cleanup?.(); slots[index] = { deps, callback, cleanup: callback() }
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
    replayEffects() { for (const slot of slots) if (slot?.callback) { slot.cleanup?.(); slot.cleanup = slot.callback() } },
  }
}

async function sessionHarness(fetchImpl, initialize) {
  const writes = [], listeners = new Map()
  const auth = { getSession: async () => ({ data: { session: { access_token: 'synthetic-token' } } }),
    onAuthStateChange: callback => { auth.changed = callback; return { data: { subscription: { unsubscribe() {} } } } },
    signOut: async () => {},
  }
  const h = await componentHarness('../src/components/FamilySession.jsx', {
    '../utils/authClient.js': { authClient: { auth }, initializeAuthSession: initialize ?? (() => auth.getSession()) },
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
    assert.match(value.error, /not authorized for this household/)
    assert.deepEqual(h.writes, [null])
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
    assert.deepEqual(h.writes, [null])
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
    assert.deepEqual(h.writes, [null])
  } finally { h.unmount() }
})

function formNodes(tree) {
  const result = []
  const visit = node => {
    if (Array.isArray(node)) node.forEach(visit)
    else if (node?.props) { result.push(node); visit(node.props.children) }
  }
  visit(tree)
  return result
}

async function loginHarness(signInWithOtp) {
  return componentHarness('../src/pages/Auth.jsx', {
    'react-router-dom': { Navigate: () => null },
    '../utils/authClient.js': { authClient: { auth: { signInWithOtp } } },
    '../components/FamilySession.jsx': { useFamilySession: () => ({ member: null, configured: true }) },
  }, { window: { location: { origin: 'https://scintillating-donut-a597ff.netlify.app' } } })
}

test('production email links target the deployed frontend root without enabling account creation', async () => {
  const requests = []
  const h = await loginHarness(async body => { requests.push(body); return { error: null } })
  formNodes(h.render()).find(node => node.type === 'input').props.onChange({ target: { value: ' synthetic@example.invalid ' } })
  await formNodes(h.render()).find(node => node.type === 'form').props.onSubmit({ preventDefault() {} })
  assert.equal(requests.length, 1)
  assert.equal(requests[0].email, 'synthetic@example.invalid')
  assert.equal(requests[0].options.shouldCreateUser, false)
  assert.equal(requests[0].options.emailRedirectTo, 'https://scintillating-donut-a597ff.netlify.app/')
  assert.ok(formNodes(h.render()).some(node => node.props.role === 'status'))
})

test('OTP enrollment errors explain administrator enrollment without leaking provider details', async () => {
  const h = await loginHarness(async () => ({ error: { code: 'otp_disabled', message: 'Synthetic private provider details' } }))
  await formNodes(h.render()).find(node => node.type === 'form').props.onSubmit({ preventDefault() {} })
  const message = formNodes(h.render()).find(node => node.props.role === 'alert').props.children.join('')
  assert.match(message, /enroll your approved email/)
  assert.doesNotMatch(message, /private/)
})

test('provider rate limits stop subsequent email sends without automatic retries or a guessed reset time', async () => {
  for (const failure of [{ status: 429 }, { code: 'over_email_send_rate_limit' }, { code: 'over_request_rate_limit' }]) {
    let requests = 0
    const h = await loginHarness(async () => { requests++; return { error: { ...failure, message: 'Synthetic private details' } } })
    const submit = formNodes(h.render()).find(node => node.type === 'form').props.onSubmit
    await submit({ preventDefault() {} })
    await submit({ preventDefault() {} })
    await formNodes(h.render()).find(node => node.type === 'form').props.onSubmit({ preventDefault() {} })
    await flush()
    assert.equal(requests, 1)
    const nodes = formNodes(h.render())
    assert.equal(nodes.find(node => node.type === 'button').props.disabled, true)
    const message = nodes.find(node => node.props.role === 'alert').props.children.join('')
    assert.match(message, /rate limited/)
    assert.match(message, /reload this page/)
    assert.doesNotMatch(message, /private|minute|60/)
  }
})

test('callback initialization and server verification finish before any unauthenticated routing decision', async () => {
  const callback = deferred(), verified = deferred()
  let requests = 0
  const h = await sessionHarness(() => { requests++; return verified.promise }, () => callback.promise)
  try {
    assert.equal(h.render().props.value.loading, true)
    h.auth.changed('INITIAL_SESSION', null)
    // Restoring an expired old session may emit this before exchanging a new link.
    h.auth.changed('SIGNED_OUT', null)
    h.auth.changed('SIGNED_IN', { access_token: 'synthetic-token' })
    assert.equal(h.render().props.value.loading, true)
    assert.equal(requests, 0)
    // React StrictMode repeats setup/cleanup; the shared initializer is pending.
    h.replayEffects()
    callback.resolve({ data: { session: { access_token: 'synthetic-token' } } }); await flush()
    assert.equal(h.render().props.value.loading, true)
    assert.equal(requests, 1)
    assert.equal(h.render().props.value.member, null)
    verified.resolve({ ok: true, json: async () => ({ profileId: 'nithish' }) }); await flush()
    const value = h.render().props.value
    assert.equal(value.loading, false); assert.equal(value.member.profileId, 'nithish')
    assert.deepEqual(h.writes, ['nithish'])
  } finally { h.unmount() }
})

test('callback failure shows a useful error without sending household requests', async () => {
  let requests = 0
  const h = await sessionHarness(async () => { requests++ }, async () => { throw Error('This sign-in link is invalid, expired, or already used.') })
  try {
    h.render(); await flush()
    const value = h.render().props.value
    assert.equal(value.loading, false); assert.equal(value.member, null)
    assert.match(value.error, /invalid, expired/); assert.equal(requests, 0)
  } finally { h.unmount() }
})

test('explicit sign-out during callback processing cannot be undone by its late result', async () => {
  const callback = deferred()
  let requests = 0
  const h = await sessionHarness(async () => { requests++ }, () => callback.promise)
  try {
    h.render()
    await h.render().props.value.signOut()
    callback.resolve({ data: { session: { access_token: 'synthetic-token' } } }); await flush()
    const value = h.render().props.value
    assert.equal(value.loading, false); assert.equal(value.member, null)
    assert.equal(requests, 0); assert.deepEqual(h.writes, [null])
  } finally { h.unmount() }
})

test('session events revalidate refreshed tokens, ignore duplicate sign-ins, and clear identity on sign-out', async () => {
  const tokens = []
  const h = await sessionHarness(async (_url, config) => {
    tokens.push(config.headers.Authorization)
    return { ok: true, json: async () => ({ profileId: 'mother' }) }
  })
  try {
    h.render(); await flush(); h.render(); await flush()
    h.auth.changed('INITIAL_SESSION', null)
    h.auth.changed('SIGNED_IN', { access_token: 'synthetic-token' })
    h.render(); await flush()
    assert.equal(tokens.length, 1)
    h.auth.changed('TOKEN_REFRESHED', { access_token: 'synthetic-refreshed' })
    assert.equal(h.render().props.value.member, null)
    await flush()
    assert.equal(h.render().props.value.member.profileId, 'mother')
    assert.deepEqual(tokens, ['Bearer synthetic-token', 'Bearer synthetic-refreshed'])
    await h.render().props.value.signOut()
    h.auth.changed('SIGNED_OUT', null)
    assert.equal(h.render().props.value.member, null)
    assert.equal(h.writes.at(-1), null)
    h.auth.changed('SIGNED_IN', { access_token: 'synthetic-returning' })
    h.render(); await flush()
    assert.equal(h.render().props.value.member.profileId, 'mother')
  } finally { h.unmount() }
})

test('expired server sessions and unrecognized profiles never activate the dashboard', async () => {
  for (const response of [{ ok: false, status: 401 }, { ok: true, json: async () => ({ profileId: 'outsider' }) }]) {
    const h = await sessionHarness(async () => response)
    try {
      h.render(); await flush(); h.render(); await flush()
      assert.equal(h.render().props.value.member, null)
      assert.equal(h.render().props.value.loading, false)
      assert.ok(h.render().props.value.error)
      assert.equal(h.writes.some(Boolean), false)
    } finally { h.unmount() }
  }
})

test('verified membership navigates to the existing dashboard route', async () => {
  const Navigate = () => null
  const h = await componentHarness('../src/pages/Auth.jsx', {
    'react-router-dom': { Navigate },
    '../utils/authClient.js': { authClient: { auth: {} } },
    '../components/FamilySession.jsx': { useFamilySession: () => ({ member: { profileId: 'nithish' }, configured: true }) },
  })
  const result = h.render()
  assert.equal(result.type, Navigate)
  assert.equal(result.props.to, '/dashboard')
  assert.equal(result.props.replace, true)
})
