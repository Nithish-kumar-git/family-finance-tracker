import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import useStore from '../store/useStore.js'
import { ChevronRight } from 'lucide-react'

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

  return (
    <div className="min-h-screen bg-slate-900">
      <div className="max-w-sm mx-auto px-6 flex flex-col justify-center min-h-screen">
        
        {/* Top */}
        <div className="w-16 h-16 rounded-2xl bg-indigo-600 flex items-center justify-center mx-auto mb-6">
          <span className="text-2xl font-bold text-white">₹</span>
        </div>
        <h1 className="text-2xl font-bold text-white text-center">FamilyFinanceTracker</h1>
        <p className="text-sm text-slate-400 text-center mt-1 mb-8">Family finances, in one place.</p>

        {/* User cards */}
        <div className="flex flex-col">
          {users.map(user => {
            const isSelected = selectedUser === user.id

            return (
              <div key={user.id}>
                <button
                  onClick={() => handleCardClick(user.id)}
                  className={`w-full flex items-center justify-between rounded-2xl p-4 mb-3 cursor-pointer border transition-colors
                    ${isSelected ? 'border-indigo-500 bg-slate-800' : 'bg-slate-800 border-slate-700 hover:border-indigo-500'}
                  `}
                >
                  <div className="text-left">
                    <p className="text-base font-semibold text-white">{user.name}</p>
                    <p className="text-xs text-slate-400">{USER_ROLES[user.id]}</p>
                  </div>
                  <ChevronRight size={18} className="text-slate-500" />
                </button>

                {isSelected && (
                  <div className="mb-4">
                    <div className={`mt-4 flex justify-center gap-3 ${shake ? 'animate-[shake_0.5s_ease-in-out]' : ''}`}>
                      {[0, 1, 2, 3].map(i => (
                        <div
                          key={i}
                          onClick={() => inputRef.current?.focus()}
                          className={`w-3 h-3 rounded-full ${i < pin.length ? (shake ? 'bg-red-500' : 'bg-indigo-500') : 'bg-slate-600'}`}
                        />
                      ))}
                    </div>

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
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Version */}
        <p className="text-xs text-slate-600 text-center mt-8">v1.0.0</p>

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
    </div>
  )
}
