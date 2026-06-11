import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import useStore from '../store/useStore.js'
import { ChevronRight } from 'lucide-react'

const USER_ROLES = {
  mother:   'Head of Household',
  nithish:  'Job Hunting',
  abeerami: 'Govt Employee',
}

// Avatar color map — keeps the visual identity without inline styles where possible.
// These are bg- classes, one per user id.
const AVATAR_BG = {
  mother:   'bg-violet-500',
  nithish:  'bg-emerald-500',
  abeerami: 'bg-amber-500',
}

export default function Auth() {
  const navigate = useNavigate()
  const users = useStore(s => s.users)
  const setCurrentUser = useStore(s => s.setCurrentUser)

  const [selectedUser, setSelectedUser] = useState(null)
  const [pin, setPin] = useState('')
  const [shake, setShake] = useState(false)
  const inputRef = useRef(null)

  // Focus hidden input when a user is selected
  useEffect(() => {
    if (selectedUser) {
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [selectedUser])

  // Auto-validate when 4 digits entered
  useEffect(() => {
    if (pin.length === 4 && selectedUser) {
      const user = users.find(u => u.id === selectedUser)
      if (user && pin === user.pin) {
        setCurrentUser(selectedUser)
        navigate('/dashboard')
      } else {
        // Wrong PIN — shake and clear
        setShake(true)
        setTimeout(() => {
          setShake(false)
          setPin('')
          inputRef.current?.focus()
        }, 600)
      }
    }
  }, [pin, selectedUser, users, setCurrentUser, navigate])

  const handleCardClick = (userId) => {
    setSelectedUser(prev => prev === userId ? null : userId)
    setPin('')
  }

  const closeModal = () => {
    setSelectedUser(null)
    setPin('')
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-between px-5 py-10">

      {/* ── TOP THIRD: App identity ──────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-sm">
        <div className="text-center mb-10">
          <p className="text-5xl font-bold text-violet-600 leading-none">₹</p>
          <h1 className="text-xl font-semibold text-slate-800 mt-2">FamilyFinanceTracker</h1>
          <p className="text-sm text-slate-400 mt-1">Family finances, in one place.</p>
        </div>

        {/* ── MIDDLE: User selection cards ─────────────────────── */}
        <div className="flex flex-col gap-3 w-full">
          {users.map(user => {
            const isSelected = selectedUser === user.id
            const avatarBg = AVATAR_BG[user.id] ?? 'bg-slate-400'

            return (
              <div key={user.id}>
                {/* User card */}
                <button
                  onClick={() => handleCardClick(user.id)}
                  className={`w-full flex items-center gap-4 rounded-2xl border p-4 text-left
                    transition-colors cursor-pointer
                    ${isSelected
                      ? 'border-violet-300 bg-violet-50'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                >
                  {/* Avatar circle */}
                  <div
                    className={`w-11 h-11 rounded-full flex items-center justify-center
                      flex-shrink-0 ${avatarBg}`}
                  >
                    <span className="text-lg font-bold text-white">
                      {user.name[0].toUpperCase()}
                    </span>
                  </div>

                  {/* Name + role */}
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-semibold text-slate-800">{user.name}</p>
                    <p className="text-xs text-slate-400">{USER_ROLES[user.id]}</p>
                  </div>

                  {/* Chevron */}
                  <ChevronRight
                    size={18}
                    className={`flex-shrink-0 transition-transform
                      ${isSelected ? 'rotate-90 text-violet-400' : 'text-slate-300'}`}
                  />
                </button>

                {/* ── Inline PIN section — appears below selected card ── */}
                {isSelected && (
                  <div className="mt-2 px-1">
                    {/* 4 dot circles */}
                    <div
                      className={`flex justify-center gap-4 py-4
                        ${shake ? 'animate-[shake_0.5s_ease-in-out]' : ''}`}
                    >
                      {[0, 1, 2, 3].map(i => (
                        <div
                          key={i}
                          onClick={() => inputRef.current?.focus()}
                          className={`w-12 h-12 rounded-full border-2 transition-all cursor-pointer
                            ${i < pin.length
                              ? shake
                                ? 'bg-red-500 border-red-400'
                                : 'bg-violet-600 border-violet-600'
                              : shake
                                ? 'border-red-400 bg-white'
                                : 'border-slate-200 bg-white'
                            }`}
                        />
                      ))}
                    </div>

                    <p className="text-xs text-slate-400 text-center mb-3">
                      {shake ? 'Wrong PIN — try again' : 'Enter your 4-digit PIN'}
                    </p>

                    {/* Hidden numeric input captures keypresses */}
                    <input
                      ref={inputRef}
                      type="password"
                      inputMode="numeric"
                      maxLength={4}
                      value={pin}
                      onChange={e => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 4)
                        setPin(val)
                      }}
                      className="absolute opacity-0 w-0 h-0 pointer-events-none"
                      aria-label="Enter PIN"
                      autoComplete="off"
                    />

                    {/* Tap-to-focus button for mobile */}
                    <button
                      onClick={() => inputRef.current?.focus()}
                      className="w-full py-2.5 rounded-xl bg-violet-50 border border-violet-200
                                 text-violet-600 text-xs font-medium hover:bg-violet-100 transition-colors"
                    >
                      Tap to enter PIN
                    </button>

                    <button
                      onClick={closeModal}
                      className="w-full mt-2 py-2 text-xs text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── BOTTOM: Version string ───────────────────────────────── */}
      <p className="text-xs text-slate-300 text-center mt-8">v1.0.0</p>

      {/* Shake keyframe */}
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          15%       { transform: translateX(-8px); }
          30%       { transform: translateX(8px); }
          45%       { transform: translateX(-8px); }
          60%       { transform: translateX(8px); }
          75%       { transform: translateX(-4px); }
          90%       { transform: translateX(4px); }
        }
      `}</style>
    </div>
  )
}
