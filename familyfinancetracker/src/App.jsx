import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import useStore from './store/useStore.js'
import Header from './components/layout/Header.jsx'
import BottomNav from './components/layout/BottomNav.jsx'
import PageWrapper from './components/layout/PageWrapper.jsx'
import Auth from './pages/Auth.jsx'

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
              <PlaceholderPage name="Dashboard" />
            </ProtectedLayout>
          }
        />
        <Route
          path="/expenses"
          element={
            <ProtectedLayout>
              <PlaceholderPage name="Expenses" />
            </ProtectedLayout>
          }
        />
        <Route
          path="/assets"
          element={
            <ProtectedLayout>
              <PlaceholderPage name="Assets" />
            </ProtectedLayout>
          }
        />
        <Route
          path="/milestones"
          element={
            <ProtectedLayout>
              <PlaceholderPage name="Milestones" />
            </ProtectedLayout>
          }
        />
        <Route
          path="/report"
          element={
            <ProtectedLayout>
              <PlaceholderPage name="Report" />
            </ProtectedLayout>
          }
        />
        <Route
          path="/employment"
          element={
            <ProtectedLayout>
              <PlaceholderPage name="Employment" />
            </ProtectedLayout>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedLayout>
              <PlaceholderPage name="Settings" />
            </ProtectedLayout>
          }
        />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
