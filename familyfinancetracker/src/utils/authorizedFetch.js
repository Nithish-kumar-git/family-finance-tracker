import { getAccessToken } from './authClient.js'

export function authRequired() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('fft-auth-required'))
  return Object.assign(new Error('Sign in again to continue.'), { code: 'AUTH_REQUIRED' })
}

// Injectable token/transport dependencies permit isolated synthetic tests.
export async function authorizedFetch(url, options = {}, dependencies = {}) {
  let token
  try { token = await (dependencies.getToken ?? getAccessToken)() }
  catch { throw authRequired() }
  if (!token) throw authRequired()
  const response = await (dependencies.fetchImpl ?? fetch)(url, {
    ...options, cache: 'no-store',
    headers: { ...options.headers, Authorization: `Bearer ${token}` },
  })
  if (response.status === 401 || (response.status === 403 && !String(url).endsWith('/api/reset'))) {
    throw authRequired()
  }
  return response
}
