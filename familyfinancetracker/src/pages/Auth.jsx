import { useState, useRef, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import useStore from '../store/useStore.js'
import { useFamilySession } from '../components/FamilySession.jsx'
import { hasPin } from '../utils/localLogin.js'
import { workspaceMode, switchWorkspace } from '../utils/workspace.js'

export default function Auth() {
  const session = useFamilySession(), users = useStore(s => s.users)
  const [selected, setSelected] = useState(null), [pin, setPin] = useState(''), [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const inFlight = useRef(false), input = useRef(null)
  const user = users.find(u => u.id === selected)
  const setup = user && workspaceMode !== 'demo' && !hasPin(user)
  async function unlock(id, value, confirm) {
    if (inFlight.current) return
    inFlight.current = true; setBusy(true); setError('')
    try { await session.signIn(id, value, confirm) }
    catch (failure) { setError(failure.message || 'Could not unlock this browser.'); setPin(''); setConfirmation('') }
    finally { inFlight.current = false; setBusy(false) }
  }
  useEffect(() => { input.current?.focus() }, [selected])
  useEffect(() => { if (selected && pin.length === 4 && !setup && workspaceMode !== 'demo') unlock(selected, pin) }, [selected, pin, setup])
  if (session.member) return <Navigate to="/dashboard" replace />
  return <div className="min-h-screen bg-slate-900">
    <div className="max-w-sm mx-auto px-6 py-10 flex flex-col justify-center min-h-screen">
      <div className="w-16 h-16 rounded-2xl bg-indigo-600 flex items-center justify-center mx-auto mb-6"><span className="text-2xl font-bold text-white">₹</span></div>
      <h1 className="text-2xl font-bold text-white text-center">FamilyFinanceTracker</h1>
      <p className="text-sm text-slate-400 text-center mt-1 mb-6">Family finances, in one place.</p>
      <div className="rounded-xl border border-slate-700 p-3 mb-5 text-xs leading-relaxed text-slate-300">
        {workspaceMode === 'demo' ? 'Recruiter demo · synthetic data only. Edits stay in a separate demo workspace on this browser.' : 'Personal workspace · saved on this device only. Your PIN is a browser convenience lock, not server authentication. Private cloud records remain protected and disconnected.'}
      </div>
      {users.map(profile => <div key={profile.id}>
        <button disabled={busy} onClick={() => {
          setSelected(profile.id); setPin(''); setConfirmation(''); setError('')
          if (workspaceMode === 'demo') unlock(profile.id)
        }} className={`w-full flex items-center justify-between rounded-2xl p-4 mb-3 border transition-colors ${selected === profile.id ? 'border-indigo-500 bg-slate-800' : 'bg-slate-800 border-slate-700 hover:border-indigo-500'}`}>
          <div className="text-left"><p className="text-base font-semibold text-white">{profile.name}</p><p className="text-xs text-slate-400">{profile.role || (workspaceMode === 'demo' ? 'Explore the demo' : 'Household member')}</p></div><ChevronRight size={18} className="text-slate-500" />
        </button>
        {selected === profile.id && workspaceMode !== 'demo' && <form onSubmit={event => { event.preventDefault(); unlock(selected, pin, confirmation) }} className="space-y-3 mb-5 text-white">
          <p className="text-sm text-slate-300">{setup ? 'Create your own four-digit PIN for this browser.' : 'Enter your four-digit PIN.'}</p>
          <input ref={input} aria-label="Enter PIN" type="password" inputMode="numeric" autoComplete="off" maxLength={4} value={pin} disabled={busy} onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))} className="w-full rounded-xl bg-slate-800 border border-slate-600 p-3 text-center tracking-[1em]" />
          {setup && <><input aria-label="Confirm PIN" type="password" inputMode="numeric" autoComplete="off" maxLength={4} value={confirmation} disabled={busy} onChange={e => setConfirmation(e.target.value.replace(/\D/g, '').slice(0, 4))} className="w-full rounded-xl bg-slate-800 border border-slate-600 p-3 text-center tracking-[1em]" /><button disabled={busy || pin.length !== 4 || confirmation.length !== 4} className="w-full rounded-xl bg-indigo-600 p-3 disabled:opacity-50">Set PIN & open workspace</button></>}
        </form>}
      </div>)}
      {error && <p role="alert" className="text-sm text-red-300 mb-4">{error}</p>}
      <button onClick={() => switchWorkspace(workspaceMode === 'demo' ? 'personal' : 'demo')} className="mt-4 rounded-xl border border-indigo-400 p-3 text-sm text-indigo-200 hover:bg-slate-800">{workspaceMode === 'demo' ? 'Back to personal workspace' : 'Explore recruiter demo — synthetic data'}</button>
      <p className="text-xs text-slate-500 text-center mt-5">No emails. No public registration. No cloud writes.</p>
    </div>
  </div>
}
