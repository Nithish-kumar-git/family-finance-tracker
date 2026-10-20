import { getAccessToken } from './authClient.js'
import { browserRequest } from './browserRepository.js'

export function authRequired() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('fft-auth-required'))
  return Object.assign(new Error('Sign in again to continue.'), { code: 'AUTH_REQUIRED' })
}

// Injectable token/transport dependencies permit isolated synthetic tests.
export async function authorizedFetch(url, options = {}, dependencies = {}) {
  if (!dependencies.getToken && !dependencies.fetchImpl && typeof window !== 'undefined') {
    const result = await browserRequest(url, options)
    if (result.status === 401) throw authRequired()
    return result
  }
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

// AI must reach the guarded server, never the browser's financial repository.
export function serverAuthorizedFetch(url, options) {
  return authorizedFetch(url, options, { getToken: getAccessToken, fetchImpl: fetch })
}
