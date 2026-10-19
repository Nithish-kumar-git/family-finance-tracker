import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'
import { GoTrueClient } from '@supabase/auth-js'

async function load(env, { auth = {}, window, createClientImpl } = {}) {
  const calls = [], context = vm.createContext({ URL, ...(window ? { window } : {}) })
  const client = { auth: { getSession: async () => ({ data: { session: { access_token: 'synthetic-token' } } }), ...auth } }
  const module = new vm.SourceTextModule(readFileSync(new URL('../src/utils/authClient.js', import.meta.url), 'utf8'), {
    context, initializeImportMeta: meta => { meta.env = env },
  })
  await module.link(() => new vm.SyntheticModule(['createClient'], function () {
    this.setExport('createClient', (...args) => { calls.push(args); return createClientImpl ? createClientImpl(...args) : client })
  }, { context }))
  await module.evaluate()
  return { calls, exports: module.namespace }
}

test('missing, invalid, or secret-key frontend configuration fails closed without constructing a client', async () => {
  for (const env of [{}, { VITE_SUPABASE_URL: 'invalid', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_synthetic' },
    { VITE_SUPABASE_URL: 'https://synthetic.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_synthetic' }]) {
    const result = await load(env)
    assert.equal(result.exports.authClient, null)
    assert.equal(await result.exports.getAccessToken(), null)
    assert.equal(result.calls.length, 0)
  }
})

test('valid public configuration uses PKCE and retrieves the SDK-managed session token', async () => {
  const result = await load({ VITE_SUPABASE_URL: 'https://synthetic.supabase.co',
    VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_synthetic' })
  assert.equal(result.calls.length, 1)
  assert.equal(result.calls[0][2].auth.flowType, 'pkce')
  assert.equal(result.calls[0][2].auth.detectSessionInUrl, false)
  assert.equal(result.calls[0][2].auth.persistSession, true)
  assert.equal(result.calls[0][2].auth.autoRefreshToken, true)
  assert.equal(await result.exports.getAccessToken(), 'synthetic-token')
})

const publicConfig = { VITE_SUPABASE_URL: 'https://synthetic.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_synthetic' }
const browser = (query = '?code=synthetic-code') => {
  const replacements = []
  return { replacements, location: { href: 'https://scintillating-donut-a597ff.netlify.app/' + query },
    history: { state: { synthetic: true }, replaceState: (...args) => replacements.push(args) } }
}

test('one callback exchange is shared by concurrent consumers and remounts; successful code is removed', async () => {
  const window = browser('?code=synthetic-code&keep=1#section'), requests = []
  const result = await load(publicConfig, { window, auth: { exchangeCodeForSession: async code => {
    requests.push(code); return { data: { session: { access_token: 'synthetic-token' } }, error: null }
  } } })
  const sessions = await Promise.all([result.exports.initializeAuthSession(), result.exports.initializeAuthSession(), result.exports.getAccessToken()])
  await result.exports.initializeAuthSession()
  assert.deepEqual(requests, ['synthetic-code'])
  assert.equal(sessions[0].data.session.access_token, 'synthetic-token')
  assert.equal(sessions[2], 'synthetic-token')
  assert.equal(window.replacements.length, 1)
  assert.equal(window.replacements[0][2], '/?keep=1#section')
})

test('returning users and refreshes restore current stored sessions without exchanging a code', async () => {
  let token = 'synthetic-original', exchanges = 0
  const result = await load(publicConfig, { window: browser(''), auth: {
    exchangeCodeForSession: async () => { exchanges++ },
    getSession: async () => ({ data: { session: token ? { access_token: token } : null }, error: null }),
  } })
  assert.equal(await result.exports.getAccessToken(), token)
  token = 'synthetic-refreshed'
  assert.equal(await result.exports.getAccessToken(), token)
  token = null
  assert.equal(await result.exports.getAccessToken(), null)
  assert.equal(exchanges, 0)
})

test('expired, reused, missing-verifier and rejected callback codes fail visibly without retry or stale-session fallback', async () => {
  for (const code of ['otp_expired', 'flow_state_not_found', 'pkce_code_verifier_not_found']) {
    let exchanges = 0, reads = 0
    const window = browser()
    const result = await load(publicConfig, { window, auth: {
      exchangeCodeForSession: async () => { exchanges++; return { data: { session: null }, error: { code, message: 'Synthetic private error' } } },
      getSession: async () => { reads++; return { data: { session: { access_token: 'stale-token' } } } },
    } })
    for (let i = 0; i < 2; i++) await assert.rejects(result.exports.initializeAuthSession(), error => {
      assert.match(error.message, /invalid, expired, or already used/)
      assert.match(error.message, /same browser/)
      assert.doesNotMatch(error.message, /private/)
      return true
    })
    assert.equal(exchanges, 1); assert.equal(reads, 0); assert.equal(window.replacements.length, 0)
  }
})

test('provider error callbacks and empty codes fail without exchanging or leaking URL error details', async () => {
  for (const query of ['?error=access_denied&error_description=private', '?error_code=otp_expired', '?code=']) {
    let exchanges = 0
    const result = await load(publicConfig, { window: browser(query), auth: {
      exchangeCodeForSession: async () => { exchanges++ },
    } })
    await assert.rejects(result.exports.initializeAuthSession(), /This sign-in link is invalid/)
    assert.equal(exchanges, 0)
  }
})

test('session restoration exceptions are sanitized', async () => {
  const result = await load(publicConfig, { auth: { getSession: async () => { throw Error('Synthetic private details') } } })
  await assert.rejects(result.exports.initializeAuthSession(), { message: 'Your session could not be restored. Please sign in again.' })
})

test('installed Supabase SDK exchanges the callback once, persists it, and restores it after a fresh app load with mocked transport', async () => {
  const stored = new Map([['synthetic-auth-code-verifier', JSON.stringify('synthetic-verifier')]])
  const storage = { getItem: key => stored.get(key) ?? null, setItem: (key, value) => stored.set(key, value), removeItem: key => stored.delete(key) }
  let exchanges = 0
  const clients = []
  const makeClient = (url, key, options) => {
    const client = { auth: new GoTrueClient({ ...options.auth, url: url + '/auth/v1', headers: { apikey: key },
      storageKey: 'synthetic-auth', storage, autoRefreshToken: false,
      fetch: async (url, config) => {
        assert.match(String(url), /\/auth\/v1\/token\?grant_type=pkce$/)
        const body = JSON.parse(config.body)
        assert.equal(body.auth_code, 'synthetic-code')
        assert.equal(body.code_verifier, 'synthetic-verifier')
        exchanges++
        return { ok: true, status: 200, headers: { get: () => null }, json: async () => ({
          access_token: 'synthetic-token', refresh_token: 'synthetic-refresh', token_type: 'bearer', expires_in: 3600,
          user: { id: 'synthetic-user', email: 'synthetic@example.invalid', email_confirmed_at: '2026-01-01', aud: 'authenticated' },
        }) }
      },
    }) }
    clients.push(client)
    return client
  }
  try {
    const callback = await load(publicConfig, { window: browser(), createClientImpl: makeClient })
    const [first, duplicate] = await Promise.all([callback.exports.initializeAuthSession(), callback.exports.initializeAuthSession()])
    assert.equal(first.data.session.user.email, 'synthetic@example.invalid')
    assert.equal(duplicate.data.session.access_token, 'synthetic-token')
    const refresh = await load(publicConfig, { window: browser(''), createClientImpl: makeClient })
    assert.equal((await refresh.exports.initializeAuthSession()).data.session.access_token, 'synthetic-token')
    assert.equal(exchanges, 1)
    await clients.at(-1).auth.signOut({ scope: 'local' })
    assert.equal((await refresh.exports.initializeAuthSession()).data.session, null)
  } finally { for (const client of clients) client.auth.stopAutoRefresh() }
})
