import { BrowserRouter, Routes, Route, Navigate, NavLink } from 'react-router-dom'
import useStore from './store/useStore.js'
import Header from './components/layout/Header.jsx'
import BottomNav from './components/layout/BottomNav.jsx'
import PageWrapper from './components/layout/PageWrapper.jsx'
import Auth from './pages/Auth.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Expenses from './pages/Expenses.jsx'
import Budgets from './pages/Budgets.jsx'
import Assets from './pages/Assets.jsx'
import Milestones from './pages/Milestones.jsx'
import Employment from './pages/Employment.jsx'
import Report from './pages/Report.jsx'
import Settings from './pages/Settings.jsx'
import { Home, CreditCard, PieChart, Calendar, Briefcase, FileText, Settings as SettingsIcon } from 'lucide-react'

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
    <div className="min-h-screen bg-slate-50">
      {/* Desktop sidebar — hidden on mobile */}
      <aside className="hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:left-0 lg:w-56 lg:bg-white lg:border-r lg:border-slate-100 lg:z-40 lg:shadow-sm">
        {/* Sidebar logo */}
        <div className="flex items-center gap-2 px-6 py-5 border-b border-slate-100">
          <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold text-sm">
            ₹
          </div>
          <span className="text-sm font-semibold text-slate-800">FFTracker</span>
        </div>

        {/* Sidebar nav links */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {[
            { path: '/dashboard', label: 'Dashboard', icon: Home },
            { path: '/expenses', label: 'Expenses', icon: CreditCard },
            { path: '/assets', label: 'Assets', icon: PieChart },
            { path: '/milestones', label: 'Goals', icon: Calendar },
            { path: '/employment', label: 'Employment', icon: Briefcase },
            { path: '/report', label: 'Report', icon: FileText },
            { path: '/settings', label: 'Settings', icon: SettingsIcon },
          ].map(item => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-600'
                      : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                  }`
                }
              >
                <Icon size={16} />
                {item.label}
              </NavLink>
            )
          })}
        </nav>

        {/* Sidebar user info */}
        <div className="px-4 py-4 border-t border-slate-100">
          <p className="text-xs text-slate-400 truncate">Signed in as</p>
          <p className="text-sm font-medium text-slate-700">{user?.name ?? 'User'}</p>
        </div>
      </aside>

      {/* Main area — shifts right on desktop */}
      <div className="lg:ml-56">
        <Header />
        <PageWrapper>{children}</PageWrapper>
        {/* BottomNav hidden on desktop */}
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
