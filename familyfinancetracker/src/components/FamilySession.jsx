import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { authClient } from '../utils/authClient.js'
import useStore from '../store/useStore.js'

const SessionContext = createContext(null)
export const useFamilySession = () => useContext(SessionContext)
const base = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

export default function FamilySession({ children }) {
  const [session, setSession] = useState(null)
  const [member, setMember] = useState(null)
  const [loading, setLoading] = useState(Boolean(authClient))
  const [error, setError] = useState('')
  const authorization = useRef(null)
  useEffect(() => {
    if (!authClient) return
    let active = true
    let authChanged = false
    authClient.auth.getSession().then(({ data, error: failure }) => {
      if (!active || authChanged) return
      setSession(data?.session ?? null)
      if (failure || !data?.session) setLoading(false)
    }).catch(() => { if (active) setLoading(false) })
    const { data: { subscription } } = authClient.auth.onAuthStateChange((_event, next) => {
      authChanged = true
      authorization.current?.abort()
      if (active) { setMember(null); setSession(next); setLoading(Boolean(next)) }
    })
    const invalidate = () => {
      authChanged = true; authorization.current?.abort()
      setSession(null); setMember(null); setLoading(false)
      setError('Your session needs verification. Please sign in again.')
    }
    window.addEventListener('fft-auth-required', invalidate)
    return () => { active = false; subscription.unsubscribe(); window.removeEventListener('fft-auth-required', invalidate) }
  }, [])
  useEffect(() => {
    if (!session) { setMember(null); return }
    const controller = new AbortController()
    authorization.current = controller
    const timer = setTimeout(() => {
      controller.abort(); setMember(null); setLoading(false)
      setError('Sign-in verification timed out. Please try signing in again.')
    }, 10_000)
    setLoading(true)
    fetch(base + '/api/auth/me', { headers: { Authorization: `Bearer ${session.access_token}` },
      cache: 'no-store', signal: controller.signal }).then(async response => {
      if (!response.ok) throw Error('denied')
      const data = await response.json()
      if (!['mother', 'nithish', 'abeerami'].includes(data.profileId)) throw Error('invalid')
      if (!controller.signal.aborted) {
        setMember(data); setError(''); useStore.getState().setCurrentUser(data.profileId)
      }
    }).catch(() => {
      if (!controller.signal.aborted) { setMember(null); setError('Access could not be verified. Check your connection or contact the app administrator.') }
    }).finally(() => { clearTimeout(timer); if (!controller.signal.aborted) setLoading(false) })
    return () => { clearTimeout(timer); controller.abort() }
  }, [session])
  return <SessionContext.Provider value={{ member, loading, error, configured: Boolean(authClient),
    signOut: async () => {
      authorization.current?.abort(); setMember(null); setSession(null); setLoading(false)
      await authClient?.auth.signOut({ scope: 'local' })
    },
  }}>{children}</SessionContext.Provider>
}
