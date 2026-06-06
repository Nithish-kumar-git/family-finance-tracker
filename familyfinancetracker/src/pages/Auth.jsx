import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import useStore from '../store/useStore.js'

const USER_ROLES = {
  mother:   'Head of Household',
  nithish:  'Job Hunting',
  abeerami: 'Govt Employee',
}

export default function Auth() {
  const navigate = useNavigate()
  const users = useStore(s => s.users)
  const setCurrentUser = useStore(s => s.setCurrentUser)

  const [selectedUser, setSelectedUser] = useState(null)
  const [pin, setPin] = useState('')
  const [shake, setShake] = useState(false)
  const inputRef = useRef(null)

  // Focus hidden input when modal opens
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
    setSelectedUser(userId)
    setPin('')
  }

  const closeModal = () => {
    setSelectedUser(null)
    setPin('')
  }

  const selectedUserObj = users.find(u => u.id === selectedUser)

  return (
    <div className="min-h-screen bg-violet-50 flex flex-col items-center justify-center px-4 py-8">
      {/* App title */}
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-violet-700">FamilyFinanceTracker</h1>
        <p className="text-sm text-slate-500 mt-1">Chennai Family · Since 2026</p>
      </div>

      {/* User cards */}
      <div className="flex flex-col gap-4 w-full max-w-xs">
        {users.map(user => (
          <button
            key={user.id}
            onClick={() => handleCardClick(user.id)}
            className="rounded-2xl border-2 border-slate-200 bg-white p-6 cursor-pointer
                       hover:border-violet-400 transition-colors text-left w-full
                       active:scale-[0.98] transition-transform"
          >
            <div className="flex items-center gap-4">
              {/* Avatar */}
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: user.color }}
              >
                <span className="text-2xl font-bold text-white">
                  {user.name[0].toUpperCase()}
                </span>
              </div>
              {/* Info */}
              <div>
                <p className="text-xl font-semibold text-slate-800">{user.name}</p>
                <p className="text-sm text-slate-500">{USER_ROLES[user.id]}</p>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* PIN modal */}
      {selectedUser && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4"
          onClick={(e) => { if (e.target === e.currentTarget) closeModal() }}
        >
          <div className="bg-white rounded-2xl p-6 w-full max-w-xs shadow-xl">
            <h2 className="text-lg font-semibold text-slate-800 text-center mb-1">
              Enter PIN
            </h2>
            <p className="text-sm text-slate-500 text-center mb-6">
              {selectedUserObj?.name}
            </p>

            {/* 4 dot circles */}
            <div
              className={`flex justify-center gap-3 mb-6 transition-transform
                ${shake ? 'animate-[shake_0.5s_ease-in-out]' : ''}`}
              style={shake ? { animation: 'shake 0.5s ease-in-out' } : {}}
            >
              {[0, 1, 2, 3].map(i => (
                <div
                  key={i}
                  className={`w-6 h-6 rounded-full border-2 transition-colors
                    ${i < pin.length
                      ? 'bg-violet-600 border-violet-600'
                      : 'bg-slate-200 border-slate-300'}`}
                />
              ))}
            </div>

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
              className="opacity-0 absolute w-0 h-0 pointer-events-none"
              aria-label="Enter PIN"
              autoComplete="off"
            />

            {/* Visible number pad for mobile (tap-to-focus) */}
            <button
              onClick={() => inputRef.current?.focus()}
              className="w-full py-3 rounded-xl bg-violet-50 text-violet-600 text-sm font-medium
                         border border-violet-200 hover:bg-violet-100 transition-colors"
            >
              Tap to enter PIN
            </button>

            <button
              onClick={closeModal}
              className="w-full mt-3 py-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Shake keyframe injection */}
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
