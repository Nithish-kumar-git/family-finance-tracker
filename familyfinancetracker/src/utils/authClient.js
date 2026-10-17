import { createClient } from '@supabase/supabase-js'

const url = import.meta.env?.VITE_SUPABASE_URL
const key = import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY
function configuredClient() {
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(url ?? '')
      || !key?.startsWith('sb_publishable_')) return null
  try {
    return createClient(url, key, {
      auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  } catch { return null }
}
export const authClient = configuredClient()

export async function getAccessToken() {
  if (!authClient) return null
  const { data, error } = await authClient.auth.getSession()
  return error ? null : data.session?.access_token ?? null
}
