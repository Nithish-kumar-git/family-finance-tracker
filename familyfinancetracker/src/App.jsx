import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
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

// Placeholder for pages not yet built (Conversations 2–10)
const PlaceholderPage = ({ name }) => (
  <div className="flex items-center justify-center h-64">
    <p className="text-slate-400 text-sm">{name} — coming soon</p>
  </div>
)

// Protected layout — redirects to Auth if no user is selected
function ProtectedLayout({ children }) {
  const currentUser = useStore(s => s.currentUser)
  if (!currentUser) return <Navigate to="/" replace />
  return (
    <>
      <Header />
      <PageWrapper>{children}</PageWrapper>
      <BottomNav />
    </>
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
