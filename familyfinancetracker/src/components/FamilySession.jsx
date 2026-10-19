import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { authClient, initializeAuthSession } from '../utils/authClient.js'
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
  const sessionToken = useRef(undefined)
  const sessionRevision = useRef(0)
  useEffect(() => {
    if (!authClient) return
    let active = true
    let initialized = false
    let invalidated = false
    const revision = sessionRevision.current
    const accept = next => {
      if (sessionToken.current === (next?.access_token ?? null)) return
      sessionToken.current = next?.access_token ?? null
      authorization.current?.abort()
      setMember(null); setSession(next); setLoading(Boolean(next))
      if (!next) useStore.getState().setCurrentUser(null)
    }
    const { data: { subscription } } = authClient.auth.onAuthStateChange((event, next) => {
      if (!active) return
      // INITIAL_SESSION can be null before our explicit exchange completes.
      // Never let it decide routing or call SDK methods inside its auth lock.
      if (!initialized || event === 'INITIAL_SESSION') return
      if (event === 'SIGNED_OUT') { accept(null); return }
      if (['SIGNED_IN', 'TOKEN_REFRESHED', 'USER_UPDATED'].includes(event)) accept(next)
    })
    initializeAuthSession().then(({ data }) => {
      if (active && !invalidated && revision === sessionRevision.current) { initialized = true; accept(data?.session ?? null) }
    }).catch(failure => {
      if (active && !invalidated && revision === sessionRevision.current) {
        accept(null)
        setError(failure.message || 'Your session could not be restored. Please sign in again.')
      }
    })
    const invalidate = () => {
      invalidated = true; sessionRevision.current++; authorization.current?.abort()
      sessionToken.current = null
      setSession(null); setMember(null); setLoading(false); useStore.getState().setCurrentUser(null)
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
      if (!response.ok) throw Error(response.status === 403 ? 'unauthorized' : response.status === 401 ? 'expired' : 'unavailable')
      const data = await response.json()
      if (!['mother', 'nithish', 'abeerami'].includes(data.profileId)) throw Error('invalid')
      if (!controller.signal.aborted) {
        setMember(data); setError(''); useStore.getState().setCurrentUser(data.profileId)
      }
    }).catch(failure => {
      if (!controller.signal.aborted) {
        setMember(null); useStore.getState().setCurrentUser(null)
        setError(failure.message === 'unauthorized'
          ? 'This email is not authorized for this household. Contact the app administrator.'
          : failure.message === 'expired' ? 'Your session has expired. Please sign in again.'
            : 'Access could not be verified. Check your connection or contact the app administrator.')
      }
    }).finally(() => { clearTimeout(timer); if (!controller.signal.aborted) setLoading(false) })
    return () => { clearTimeout(timer); controller.abort() }
  }, [session])
  return <SessionContext.Provider value={{ member, loading, error, configured: Boolean(authClient),
    signOut: async () => {
      sessionRevision.current++; authorization.current?.abort(); sessionToken.current = null
      setMember(null); setSession(null); setLoading(false); useStore.getState().setCurrentUser(null)
      await authClient?.auth.signOut({ scope: 'local' })
    },
  }}>{children}</SessionContext.Provider>
}
