import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { authorizedFetch } from '../src/utils/authorizedFetch.js'
import { INITIAL_DATA } from '../src/data/emptyData.js'

test('financial requests require a token before attempting the network', async () => {
  let calls = 0
  await assert.rejects(authorizedFetch('https://synthetic.invalid/api/expenses', {}, {
    getToken: async () => null, fetchImpl: () => { calls++ },
  }), { code: 'AUTH_REQUIRED' })
  assert.equal(calls, 0)
})

test('verified transport attaches the session token and disables shared response caching', async () => {
  const result = await authorizedFetch('https://synthetic.invalid/api/expenses', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"synthetic":true}',
  }, { getToken: async () => 'synthetic-token', fetchImpl: async (_url, config) => {
    assert.equal(config.headers.Authorization, 'Bearer synthetic-token')
    assert.equal(config.headers['Content-Type'], 'application/json')
    assert.equal(config.cache, 'no-store')
    return { status: 201 }
  } })
  assert.equal(result.status, 201)
})

test('session retrieval failures cannot fall back to an unauthenticated save', async () => {
  let calls = 0
  await assert.rejects(authorizedFetch('https://synthetic.invalid/api/expenses', {}, {
    getToken: async () => { throw Error('synthetic private error') }, fetchImpl: () => { calls++ },
  }), { code: 'AUTH_REQUIRED', message: 'Sign in again to continue.' })
  assert.equal(calls, 0)
})

for (const status of [401, 403]) {
  test(`HTTP ${status} invalidates authorization rather than reporting a save`, async () => {
    await assert.rejects(authorizedFetch('https://synthetic.invalid/api/expenses', {}, {
      getToken: async () => 'synthetic-token', fetchImpl: async () => ({ status }),
    }), { code: 'AUTH_REQUIRED' })
  })
}

test('reset denial remains a disabled operation, not a session logout', async () => {
  const result = await authorizedFetch('https://synthetic.invalid/api/reset', {}, {
    getToken: async () => 'synthetic-token', fetchImpl: async () => ({ status: 403 }),
  })
  assert.equal(result.status, 403)
})

test('new browser defaults contain no household records or login PINs', () => {
  for (const field of ['expenses', 'fixedDeposits', 'mutualFunds', 'licPolicies', 'chitFunds', 'milestones']) {
    assert.deepEqual(INITIAL_DATA[field], [])
  }
  assert.equal(INITIAL_DATA.users.some(user => 'pin' in user), false)
  const store = readFileSync(new URL('../src/store/useStore.js', import.meta.url), 'utf8')
  assert.match(store, /emptyData\.js/)
  assert.match(store, /JSON\.parse\(raw\)/, 'Existing financial storage must be preserved')
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
  assert.match(app, /!session\?\.member \|\| !currentUser/)
})
