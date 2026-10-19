import { useFamilySession } from '../FamilySession.jsx'
import { useLocation, useNavigate } from 'react-router-dom'
import useStore from '../../store/useStore.js'
import { PWAInstallButton } from '../ui/PWAInstallButton'

const ROUTE_TITLES = {
  '/dashboard':  'Dashboard',
  '/expenses':   'Expenses',
  '/budgets': 'Budgets',
  '/assets':     'Assets',
  '/milestones': 'Milestones',
  '/report':     'Report',
  '/employment': 'Job Tracker',
  '/settings':   'Settings',
  '/':           'FamilyFinanceTracker',
}

export default function Header() {
  const session = useFamilySession()
  const location = useLocation()
  const navigate = useNavigate()
  const currentUser = useStore(s => s.currentUser)
  const users = useStore(s => s.users)
  const isOffline = useStore(s => s.isOffline)

  const user = users.find(u => u.id === currentUser)
  const title = ROUTE_TITLES[location.pathname] ?? 'FamilyFinanceTracker'
  const initial = user ? user.name[0].toUpperCase() : '?'
  const color = user?.color ?? '#94A3B8'

  return (
    <header className="bg-white border-b border-line h-14 flex-shrink-0">
      <div className="flex items-center justify-between h-full px-4">
        <h1 className="text-lg font-semibold text-ink">{title}</h1>

        {/* Install button + user avatar */}
        <div className="flex items-center gap-2">
          <PWAInstallButton />
          <button
            onClick={async () => { await session.signOut(); navigate('/') }}
            className="relative w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: color }}
            aria-label="Sign out"
          >
            <span className="text-sm font-bold text-white">{initial}</span>
            {isOffline && (
              <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 rounded-full border border-white" />
            )}
          </button>
        </div>
      </div>
    </header>
  )
}
