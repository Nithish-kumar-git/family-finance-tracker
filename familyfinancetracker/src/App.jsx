import { BrowserRouter, Routes, Route, Navigate, NavLink } from 'react-router-dom'
import { useState } from 'react'
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
  FileText, Settings as SettingsIcon, MoreHorizontal, X
} from 'lucide-react'

// Protected layout — redirects to Auth if no user is selected
function ProtectedLayout({ children }) {
  const currentUser = useStore(s => s.currentUser)
  const users = useStore(s => s.users)
  const [moreOpen, setMoreOpen] = useState(false)
  
  if (!currentUser) return <Navigate to="/" replace />
  
  const user = users.find(u => u.id === currentUser)
  
  return (
    <div className="min-h-screen bg-slate-100">
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
      <div className="lg:ml-56 flex flex-col min-h-screen">
        <Header />
        
        {/* Page content */}
        <main className="flex-1 px-4 py-5 pb-28 lg:px-8 lg:py-6 lg:pb-8">
          {children}
        </main>

        {/* BottomNav — mobile only */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-30">
          <BottomNav />
        </div>
      </div>

      {/* ── MOBILE MORE BUTTON (Employment + Settings) ── */}
      <button
        onClick={() => setMoreOpen(true)}
        className="lg:hidden fixed bottom-20 left-4 z-40 w-10 h-10 rounded-full bg-white border border-slate-200 shadow-md flex items-center justify-center text-slate-500"
      >
        <MoreHorizontal size={18} />
      </button>

      {/* ── MOBILE MORE DRAWER ── */}
      {moreOpen && (
        <>
          <div
            className="lg:hidden fixed inset-0 bg-black/40 z-50"
            onClick={() => setMoreOpen(false)}
          />
          <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between mb-5">
              <p className="text-base font-semibold text-slate-900">More</p>
              <button
                onClick={() => setMoreOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>
            <div className="space-y-2">
              {[
                { to: '/employment', label: 'Employment', Icon: Briefcase, sub: 'Job search tracker' },
                { to: '/settings',   label: 'Settings',   Icon: SettingsIcon, sub: 'Income, PINs, reset' },
              ].map(({ to, label, Icon, sub }) => (
                <NavLink
                  key={to}
                  to={to}
                  onClick={() => setMoreOpen(false)}
                  className="flex items-center gap-4 p-3 rounded-xl hover:bg-slate-50 transition-colors"
                >
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
                    <Icon size={18} className="text-indigo-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{label}</p>
                    <p className="text-xs text-slate-400">{sub}</p>
                  </div>
                </NavLink>
              ))}
            </div>
          </div>
        </>
      )}
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
