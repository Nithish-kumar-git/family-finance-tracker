import { workspaceMode } from '../utils/workspace.js'
import { createContext, useContext, useEffect, useState } from 'react'
import useStore from '../store/useStore.js'
import { unlockedProfile, unlockProfile, lockWorkspace } from '../utils/localLogin.js'

const SessionContext = createContext(null)
export const useFamilySession = () => useContext(SessionContext)

export default function FamilySession({ children }) {
  const [member, setMember] = useState(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    if (workspaceMode === 'demo') {
      let active = true
      const user = useStore.getState().users[0]
      if (!user) { setLoading(false); return }
      unlockProfile(user).then(() => {
        if (active) { useStore.getState().setCurrentUser(user.id); setMember({ profileId: user.id, local: true, demo: true }) }
      }).finally(() => { if (active) setLoading(false) }).catch(() => { /* Auth shows a recoverable storage error. */ })
      return () => { active = false }
    }
    const id = unlockedProfile(), user = useStore.getState().users.find(u => u.id === id)
    if (user) { useStore.getState().setCurrentUser(id); setMember({ profileId: id, local: true }) }
    setLoading(false)
  }, [])
  return <SessionContext.Provider value={{ member, loading, error: '', configured: true,
    signIn: async (id, pin, confirmation) => {
      const user = useStore.getState().users.find(u => u.id === id)
      await unlockProfile(user, pin, confirmation)
      useStore.getState().setCurrentUser(id); setMember({ profileId: id, local: true })
    },
    signOut: async () => { lockWorkspace(); useStore.getState().setCurrentUser(null); setMember(null) },
  }}>{children}</SessionContext.Provider>
}
