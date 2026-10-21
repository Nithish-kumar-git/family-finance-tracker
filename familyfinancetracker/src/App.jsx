import FamilySession, { useFamilySession } from './components/FamilySession.jsx'
import { BrowserRouter, Routes, Route, Navigate, NavLink } from 'react-router-dom'
import useStore from './store/useStore.js'
import { workspaceMode, switchWorkspace } from './utils/workspace.js'
import Header from './components/layout/Header.jsx'
import BottomNav from './components/layout/BottomNav.jsx'
import Auth from './pages/Auth.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Expenses from './pages/Expenses.jsx'
import Budgets from './pages/Budgets.jsx'
import Assets from './pages/Assets.jsx'
import Milestones from './pages/Milestones.jsx'
import Employment from './pages/Employment.jsx'
import Report from './pages/Report.jsx'
import Settings from './pages/Settings.jsx'
import {
  Home, CreditCard, PieChart, Calendar, Briefcase,
  FileText, Settings as SettingsIcon
} from 'lucide-react'

// Protected layout — redirects to Auth if no user is selected
function ProtectedLayout({ children }) {
  const session = useFamilySession()
  const currentUser = useStore(s => s.currentUser)
  const users = useStore(s => s.users)
  const hasRecords = useStore(s => s.expenses.length + s.fixedDeposits.length + s.mutualFunds.length + s.milestones.length > 0)
  const persistenceError = useStore(s => s.persistenceError)

  if (!session?.member || !currentUser) return <Navigate to="/" replace />

  const user = users.find(u => u.id === currentUser)

  return (
    <div className="min-h-screen bg-canvas">
      <style>{`
        .scrollbar-none::-webkit-scrollbar { display: none; }
      `}</style>

      {/* ── DESKTOP SIDEBAR ── */}
      <aside className="hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:left-0 lg:w-56 lg:bg-white lg:border-r lg:border-line lg:z-40">
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 h-16 border-b border-line">
          <img src="/icons/finora.svg" alt="" aria-hidden="true" className="w-9 h-9 flex-shrink-0" />
          <div>
            <p className="text-sm font-bold text-[#12263A] leading-tight">Finora</p>
            <p className="text-xs text-muted">Personal finance</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 space-y-0.5">
          {[
            { to: '/dashboard',  label: 'Dashboard',  Icon: Home },
            { to: '/expenses',   label: 'Expenses',   Icon: CreditCard },
            { to: '/budgets',    label: 'Budgets',    Icon: PieChart },
            { to: '/assets',     label: 'Assets',     Icon: PieChart },
            { to: '/milestones', label: 'Goals',      Icon: Calendar },
            { to: '/employment', label: 'Employment', Icon: Briefcase },
            { to: '/report',     label: 'Report',     Icon: FileText },
            { to: '/settings',   label: 'Settings',   Icon: SettingsIcon },
          ].map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-accent-soft text-accent'
                    : 'text-muted hover:bg-canvas hover:text-ink'
                }`
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* User */}
        <div className="px-4 py-4 border-t border-line">
          {workspaceMode === 'demo' ? <div><p className="text-sm font-medium">Explore freely</p><p className="text-xs text-muted mt-1">Synthetic records · Browser only</p></div> : <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
              style={{ backgroundColor: user?.color ?? '#245C46' }}
            >
              {user?.name?.[0] ?? 'N'}
            </div>
            <div>
              <p className="text-sm font-semibold text-ink">{user?.name ?? 'User'}</p>
              <p className="text-xs text-muted">Active</p>
            </div>
          </div>}
        </div>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <div className="lg:ml-56 flex flex-col min-h-screen lg:border-l lg:border-line bg-canvas">
        <Header />
        <div className="bg-accent-soft border-b border-line px-4 py-2 text-xs text-accent flex flex-wrap gap-2 justify-between">
          <span>{workspaceMode === 'demo' ? 'INTERACTIVE DEMO · Synthetic data · Edits stay in this browser' : 'PERSONAL · This device only · Cloud sync disconnected'}</span>
          {workspaceMode === 'personal' && <button className="underline font-semibold" onClick={() => switchWorkspace('demo')}>Return to public demo</button>}
        </div>
        {persistenceError && <p role="alert" className="bg-red-50 p-3 text-sm text-red-800">{persistenceError}</p>}

        {/* Page content */}
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-6 pb-28 sm:px-6 lg:px-10 lg:py-8 lg:pb-8">
          {workspaceMode === 'personal' && !hasRecords && <div className="surface mb-6 text-sm"><h2>No financial records loaded on this device</h2><p className="text-muted mt-2">This is not a confirmed zero balance. Existing cloud records remain separate.</p><NavLink to="/settings" className="text-accent underline inline-block mt-2">Recover your records in Settings</NavLink></div>}
          {children}
        </main>

        {/* Custom scrollable mobile bottom nav */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40
                        bg-white border-t border-line px-2">
          <div className="flex overflow-x-auto scrollbar-none
                          gap-1 py-2"
               style={{ WebkitOverflowScrolling: 'touch',
                        scrollbarWidth: 'none',
                        msOverflowStyle: 'none' }}>
            {[
              { to: '/dashboard',  label: 'Home',       Icon: Home },
              { to: '/expenses',   label: 'Expenses',   Icon: CreditCard },
              { to: '/budgets',    label: 'Budgets',    Icon: PieChart },
              { to: '/assets',     label: 'Assets',     Icon: PieChart },
              { to: '/milestones', label: 'Goals',      Icon: Calendar },
              { to: '/report',     label: 'Report',     Icon: FileText },
              { to: '/employment', label: 'Employment', Icon: Briefcase },
              { to: '/settings',   label: 'Settings',   Icon: SettingsIcon },
            ].map(({ to, label, Icon }) => (
              <NavLink key={to} to={to}
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center gap-0.5
                   min-w-[64px] px-2 py-1.5 rounded-lg transition-colors
                   flex-shrink-0 ${isActive
                     ? 'text-accent bg-accent-soft'
                     : 'text-muted'
                   }`
                }>
                <Icon size={20} strokeWidth={1.75} />
                <span className="text-xs font-medium whitespace-nowrap">
                  {label}
                </span>
              </NavLink>
            ))}
          </div>
        </nav>

        {/* BottomNav — hidden */}
        <div className="hidden"><BottomNav /></div>
      </div>
    </div>
  )
}

function AuthenticatedApp() {
  const session = useFamilySession()
  if (session.loading) return <p role="status" className="p-8 text-center">{workspaceMode === 'demo' ? 'Opening the interactive demo…' : 'Verifying family access…'}</p>
  return (
    <BrowserRouter basename={workspaceMode === 'personal' ? '/personal' : undefined}>
      <Routes>
        {/* Public route */}
        <Route path="/" element={<Auth />} />

        {/* Protected routes */}
        <Route
          path="/dashboard"
          element={
            <ProtectedLayout>
              <Dashboard />
            </ProtectedLayout>
          }
        />
        <Route
          path="/expenses"
          element={
            <ProtectedLayout>
              <Expenses />
            </ProtectedLayout>
          }
        />
        <Route
          path="/assets"
          element={
            <ProtectedLayout>
              <Assets />
            </ProtectedLayout>
          }
        />
        <Route
          path="/milestones"
          element={
            <ProtectedLayout>
              <Milestones />
            </ProtectedLayout>
          }
        />
        <Route
          path="/report"
          element={
            <ProtectedLayout>
              <Report />
            </ProtectedLayout>
          }
        />
        <Route
          path="/employment"
          element={
            <ProtectedLayout>
              <Employment />
            </ProtectedLayout>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedLayout>
              <Settings />
            </ProtectedLayout>
          }
        />
        <Route
          path="/budgets"
          element={
            <ProtectedLayout>
              <Budgets />
            </ProtectedLayout>
          }
        />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default function App() {
  return <FamilySession><AuthenticatedApp /></FamilySession>
}
