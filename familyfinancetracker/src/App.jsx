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
import {
  Home, CreditCard, PieChart, Calendar, Briefcase,
  FileText, Settings as SettingsIcon
} from 'lucide-react'

// Protected layout — redirects to Auth if no user is selected
function ProtectedLayout({ children }) {
  const currentUser = useStore(s => s.currentUser)
  const users = useStore(s => s.users)
  
  if (!currentUser) return <Navigate to="/" replace />
  
  const user = users.find(u => u.id === currentUser)
  
  return (
    <div className="min-h-screen bg-slate-100">
      <style>{`
        .scrollbar-none::-webkit-scrollbar { display: none; }
      `}</style>
      
      {/* ── DESKTOP SIDEBAR ── */}
      <aside className="hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:left-0 lg:w-56 lg:bg-white lg:border-r lg:border-slate-200 lg:z-40">
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 h-16 border-b border-slate-100">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-base">₹</span>
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900 leading-tight">FFTracker</p>
            <p className="text-xs text-slate-400">Family Finance</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 space-y-0.5">
          {[
            { to: '/dashboard',  label: 'Dashboard',  Icon: Home },
            { to: '/expenses',   label: 'Expenses',   Icon: CreditCard },
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
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                }`
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* User */}
        <div className="px-4 py-4 border-t border-slate-100">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
              style={{ backgroundColor: user?.color ?? '#4F46E5' }}
            >
              {user?.name?.[0] ?? 'N'}
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">{user?.name ?? 'User'}</p>
              <p className="text-xs text-slate-400">Active</p>
            </div>
          </div>
        </div>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <div className="lg:ml-56 flex flex-col min-h-screen lg:border-l lg:border-slate-200 bg-slate-100">
        <Header />
        
        {/* Page content */}
        <main className="flex-1 px-4 py-5 pb-28 lg:px-8 lg:py-6 lg:pb-8">
          {children}
        </main>

        {/* Custom scrollable mobile bottom nav */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40
                        bg-white border-t border-slate-200 px-2">
          <div className="flex overflow-x-auto scrollbar-none
                          gap-1 py-2"
               style={{ WebkitOverflowScrolling: 'touch',
                        scrollbarWidth: 'none',
                        msOverflowStyle: 'none' }}>
            {[
              { to: '/dashboard',  label: 'Home',       Icon: Home },
              { to: '/expenses',   label: 'Expenses',   Icon: CreditCard },
              { to: '/assets',     label: 'Assets',     Icon: PieChart },
              { to: '/milestones', label: 'Goals',      Icon: Calendar },
              { to: '/report',     label: 'Report',     Icon: FileText },
              { to: '/employment', label: 'Employment', Icon: Briefcase },
              { to: '/settings',   label: 'Settings',   Icon: SettingsIcon },
            ].map(({ to, label, Icon }) => (
              <NavLink key={to} to={to}
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center gap-0.5
                   min-w-[64px] px-2 py-1.5 rounded-xl transition-colors
                   flex-shrink-0 ${isActive
                     ? 'text-indigo-600 bg-indigo-50'
                     : 'text-slate-400'
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
