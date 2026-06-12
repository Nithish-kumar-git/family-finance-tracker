import { BrowserRouter, Routes, Route, Navigate, NavLink } from 'react-router-dom'
import useStore from './store/useStore.js'
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
import { Home, CreditCard, PieChart, Calendar, Briefcase, FileText, Settings as Settings2 } from 'lucide-react'

// Placeholder for pages not yet built (Conversations 2–10)
const PlaceholderPage = ({ name }) => (
  <div className="flex items-center justify-center h-64">
    <p className="text-slate-400 text-sm">{name} — coming soon</p>
  </div>
)

// Protected layout — redirects to Auth if no user is selected
function ProtectedLayout({ children }) {
  const currentUser = useStore(s => s.currentUser)
  const users = useStore(s => s.users)
  
  if (!currentUser) return <Navigate to="/" replace />
  
  const user = users.find(u => u.id === currentUser)
  
  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* ── Desktop Sidebar ── */}
      <aside className="hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:left-0 lg:w-56 lg:bg-white lg:border-r lg:border-slate-200 lg:z-40">
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-5 py-4 border-b border-slate-100">
          <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-sm">₹</span>
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900 leading-none">FFTracker</p>
            <p className="text-xs text-slate-400 mt-0.5">Family Finance</p>
          </div>
        </div>

        {/* Nav Links */}
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {[
            { to: '/dashboard',  label: 'Dashboard',  Icon: Home },
            { to: '/expenses',   label: 'Expenses',   Icon: CreditCard },
            { to: '/assets',     label: 'Assets',     Icon: PieChart },
            { to: '/milestones', label: 'Goals',      Icon: Calendar },
            { to: '/employment', label: 'Employment', Icon: Briefcase },
            { to: '/report',     label: 'Report',     Icon: FileText },
            { to: '/settings',   label: 'Settings',   Icon: Settings2 },
          ].map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-600 font-semibold'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                }`
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* User Info */}
        <div className="px-4 py-3 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
              style={{ backgroundColor: user?.color ?? '#6366f1' }}
            >
              {user?.name?.[0] ?? 'N'}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-800 truncate">
                {user?.name ?? 'User'}
              </p>
              <p className="text-xs text-slate-400">Active</p>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main content — full width minus sidebar ── */}
      <div className="flex-1 lg:ml-56 min-w-0">
        <Header />
        
        {/* Page content — FULL WIDTH, proper padding */}
        <div className="pt-14 pb-20 lg:pb-8 min-h-screen">
          <div className="px-4 py-4 lg:px-8 lg:py-6">
            {children}
          </div>
        </div>
        
        {/* Bottom nav — mobile only */}
        <div className="lg:hidden">
          <BottomNav />
        </div>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
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
