import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'

async function load(env) {
  const calls = [], context = vm.createContext({})
  const client = { auth: { getSession: async () => ({ data: { session: { access_token: 'synthetic-token' } } }) } }
  const module = new vm.SourceTextModule(readFileSync(new URL('../src/utils/authClient.js', import.meta.url), 'utf8'), {
    context, initializeImportMeta: meta => { meta.env = env },
  })
  await module.link(() => new vm.SyntheticModule(['createClient'], function () {
    this.setExport('createClient', (...args) => { calls.push(args); return client })
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
  assert.equal(await result.exports.getAccessToken(), 'synthetic-token')
})
