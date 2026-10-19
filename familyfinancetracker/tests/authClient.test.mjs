import test from 'node:test'
import assert from 'node:assert/strict'
import { browserHarness, memoryStorage } from './browserHarness.mjs'

test('new personal profiles choose and confirm their own PIN; no plaintext PIN is persisted', async () => {
  const h = await browserHarness(), user = h.store.getState().users[0]
  await assert.rejects(h.login.unlockProfile(user, '1739', '9999'), /same PIN twice/)
  assert.equal(h.login.unlockedProfile(), null)
  await h.login.unlockProfile(user, '1739', '1739')
  assert.equal(h.login.unlockedProfile(), user.id)
  const saved = h.localStorage.getItem('fft_pin_v1_' + user.id)
  assert.doesNotMatch(saved, /1739/)
  assert.equal(JSON.parse(saved).hash.length, 32)
  h.login.lockWorkspace(); assert.equal(h.login.unlockedProfile(), null)
  await assert.rejects(h.login.unlockProfile(user, '9999'), /Incorrect PIN/)
  await h.login.unlockProfile(user, '1739')
  assert.equal(h.login.unlockedProfile(), user.id)
})

test('legacy browser profiles retain their existing PIN; invalid profiles and malformed PINs fail', async () => {
  const h = await browserHarness(), user = { id: 'nithish', pin: '1739' }
  await assert.rejects(h.login.unlockProfile(user, '1234'), /Incorrect PIN/)
  await assert.rejects(h.login.unlockProfile(user, 'abc'), /four-digit/)
  await assert.rejects(h.login.unlockProfile({ id: 'outsider' }, '1739'), /Choose/)
  await h.login.unlockProfile(user, '1739')
  assert.equal(h.login.unlockedProfile(), 'nithish')
})

test('recruiter demo requires no private credential and never loads or overwrites personal records', async () => {
  const original = JSON.stringify({ users: [{ id: 'mother', name: 'Private synthetic fixture' }], expenses: [{ id: 'private-fixture', amount: 17 }] })
  const storage = memoryStorage({ fft_data: original, fft_currentUser: 'mother', fft_nithish_status: 'private-status' })
  const h = await browserHarness({ demo: true, localStorage: storage })
  assert.equal(h.store.getState().expenses.some(e => e.id === 'private-fixture'), false)
  assert.equal(h.store.getState().users.some(u => u.name.includes('Private')), false)
  await h.login.unlockProfile(h.store.getState().users[0])
  h.store.getState().setCurrentUser('mother'); h.store.getState().updateMonthlyIncome('pension', 123)
  assert.equal(storage.getItem('fft_data'), original)
  assert.equal(storage.getItem('fft_currentUser'), 'mother')
  assert.equal(storage.getItem('fft_nithish_status'), 'private-status')
  assert.ok(storage.getItem('fft_demo_data_v1'))
})

test('corrupt personal data is preserved rather than silently replaced by an empty workspace', async () => {
  const storage = memoryStorage({ fft_data: '{broken synthetic fixture' })
  const h = await browserHarness({ localStorage: storage })
  assert.equal(h.store.getState().storageReadError, true)
  assert.throws(() => h.store.getState().updateBudget('groceries', 123), /not been overwritten/)
  assert.equal(storage.getItem('fft_data'), '{broken synthetic fixture')
})

test('the public application has no Supabase email or callback initialization', async () => {
  const { readFileSync } = await import('node:fs')
  for (const file of ['../src/pages/Auth.jsx', '../src/components/FamilySession.jsx', '../src/utils/authClient.js']) {
    assert.doesNotMatch(readFileSync(new URL(file, import.meta.url), 'utf8'), /signInWithOtp|exchangeCodeForSession|createClient|initializeAuthSession/)
  }
})
