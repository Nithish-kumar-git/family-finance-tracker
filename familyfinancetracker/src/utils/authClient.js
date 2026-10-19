import { createClient } from '@supabase/supabase-js'

const url = import.meta.env?.VITE_SUPABASE_URL
const key = import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY
function configuredClient() {
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(url ?? '')
      || !key?.startsWith('sb_publishable_')) return null
  try {
    return createClient(url, key, {
      // The shared initializer below owns callback exchange and its errors.
      auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    })
  } catch { return null }
}
export const authClient = configuredClient()

let callbackInitialization
export async function initializeAuthSession() {
  if (!authClient) return { data: { session: null }, error: null }
  // Module scope survives StrictMode effect replays and provider remounts.
  callbackInitialization ??= (async () => {
    if (typeof window === 'undefined') return
    const url = new URL(window.location.href)
    const callbackError = () => new Error('This sign-in link is invalid, expired, or already used. Request a new link and open it in the same browser where you requested it.')
    if (url.searchParams.has('error') || url.searchParams.has('error_code')) throw callbackError()
    if (!url.searchParams.has('code')) return
    const code = url.searchParams.get('code')
    if (!code) throw callbackError()
    try {
      const { data, error } = await authClient.auth.exchangeCodeForSession(code)
      if (error || !data?.session?.access_token) throw callbackError()
    } catch { throw callbackError() }
    url.searchParams.delete('code')
    url.searchParams.delete('sb_flow_id')
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash)
  })()
  await callbackInitialization
  // Read the current session, not a cached initial token (which may be refreshed
  // or signed out by the time another consumer mounts).
  try {
    const result = await authClient.auth.getSession()
    if (result.error) throw result.error
    return result
  } catch { throw new Error('Your session could not be restored. Please sign in again.') }
}

export async function getAccessToken() {
  if (!authClient) return null
  const { data, error } = await initializeAuthSession()
  return error ? null : data.session?.access_token ?? null
}
