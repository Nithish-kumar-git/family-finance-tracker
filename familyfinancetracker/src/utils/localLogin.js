import { workspaceMode, loginKey } from './workspace.js'

const credentialKey = id => `fft_pin_v1_${id}`
export function unlockedProfile() {
  try { return sessionStorage.getItem(loginKey) || null } catch { return null }
}
export function lockWorkspace() { sessionStorage.removeItem(loginKey) }
export function hasPin(user) { try { return Boolean(localStorage.getItem(credentialKey(user.id)) || user.pin) } catch { return false } }
async function digest(pin, salt) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits'])
  const bytes = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: Uint8Array.from(salt), iterations: 100000, hash: 'SHA-256' }, key, 256)
  return Array.from(new Uint8Array(bytes))
}
// A convenience lock for this browser, never a credential for FastAPI/PostgreSQL.
export async function unlockProfile(user, pin, confirmation) {
  if (!user || !['mother', 'nithish', 'abeerami'].includes(user.id)) throw Error('Choose a household profile.')
  if (workspaceMode !== 'demo') {
    if (!/^\d{4}$/.test(pin)) throw Error('Enter a four-digit PIN.')
    const raw = localStorage.getItem(credentialKey(user.id))
    if (raw) {
      const saved = JSON.parse(raw), actual = await digest(pin, saved.salt)
      if (actual.length !== saved.hash.length || actual.some((byte, i) => byte !== saved.hash[i])) throw Error('Incorrect PIN. Try again.')
    } else if (user.pin) {
      if (pin !== user.pin) throw Error('Incorrect PIN. Try again.')
    } else {
      if (pin !== confirmation) throw Error('Enter the same PIN twice to set up this browser.')
      const salt = Array.from(crypto.getRandomValues(new Uint8Array(16)))
      localStorage.setItem(credentialKey(user.id), JSON.stringify({ salt, hash: await digest(pin, salt) }))
    }
  }
  sessionStorage.setItem(loginKey, user.id)
  return user.id
}
