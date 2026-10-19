import { useRef, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { authClient } from '../utils/authClient.js'
import { useFamilySession } from '../components/FamilySession.jsx'

export default function Auth() {
  const session = useFamilySession()
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const inFlight = useRef(false)
  const rateLimited = useRef(false)
  if (session.member) return <Navigate to="/dashboard" replace />
  async function sendLink(event) {
    event.preventDefault()
    if (inFlight.current || rateLimited.current || !authClient) return
    inFlight.current = true; setBusy(true); setError(''); setMessage('')
    try {
      const { error: failure } = await authClient.auth.signInWithOtp({
        email: email.trim(),
        options: { shouldCreateUser: false, emailRedirectTo: window.location.origin + '/' },
      })
      if (failure) throw failure
      setMessage('If your email is enrolled, a sign-in link is on its way. Open it in this browser. Contact the app administrator if it does not arrive.')
    } catch (failure) {
      if (failure?.status === 429 || ['over_email_send_rate_limit', 'over_request_rate_limit'].includes(failure?.code)) {
        // Do not retry automatically or guess the provider's reset interval.
        rateLimited.current = true
        setError('Sign-in email requests are rate limited. Stop retrying and wait for the email service limit to reset, then reload this page.')
      } else if (failure?.code === 'otp_disabled') {
        setError('Email sign-in requires an enrolled family account. Ask the app administrator to enroll your approved email. This app does not create accounts.')
      } else {
        setError('The sign-in email could not be sent. Try again later, or contact the app administrator.')
      }
    } finally { inFlight.current = false; setBusy(false) }
  }
  return <div className="min-h-screen bg-slate-900 flex items-center justify-center px-6">
    <form onSubmit={sendLink} className="w-full max-w-sm space-y-5 text-white">
      <h1 className="text-2xl font-bold text-center">FamilyFinanceTracker</h1>
      <p className="text-sm text-slate-300">Sign in with an enrolled family email to access your household.</p>
      <label className="block text-sm">Family email
        <input type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)}
          disabled={busy || rateLimited.current} className="mt-2 w-full rounded-xl border border-slate-500 bg-slate-800 px-4 py-3 text-white" />
      </label>
      <button type="submit" disabled={busy || rateLimited.current || !session.configured} className="w-full rounded-xl bg-indigo-600 px-4 py-3 font-semibold disabled:opacity-50">
        {busy ? 'Sending…' : 'Email me a sign-in link'}
      </button>
      {!session.configured && <p role="alert" className="text-sm text-amber-200">Email sign-in needs configuration by the app administrator.</p>}
      {(error || session.error) && <p role="alert" className="text-sm text-amber-200">{error || session.error}</p>}
      {message && <p role="status" className="text-sm text-emerald-200">{message}</p>}
    </form>
  </div>
}
