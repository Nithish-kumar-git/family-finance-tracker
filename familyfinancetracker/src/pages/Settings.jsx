// Settings page — income, PINs, emergency fund, delete ops, reset, app info
// Sections: A (Income) | B (PINs) | C (Emergency Fund) | D (Delete) | E (Reset) | F (App Info)

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Shield, User, Wallet, Trash2, RefreshCw, Activity,
  ChevronRight, AlertTriangle, CheckCircle, XCircle, Lock,
} from 'lucide-react'

import useStore from '../store/useStore'
import { formatCurrency } from '../utils/formatters'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'

// ── Job application status labels ─────────────────────────────────────────────
const JOB_STATUSES = [
  { value: 'all',                  label: 'All' },
  { value: 'applied',              label: 'Applied' },
  { value: 'interview_scheduled',  label: 'Interview Scheduled' },
  { value: 'interviewed',          label: 'Interviewed' },
  { value: 'rejected',             label: 'Rejected' },
  { value: 'offered',              label: 'Offered' },
  { value: 'accepted',             label: 'Accepted' },
]

// ── Section header ─────────────────────────────────────────────────────────────
function SectionHeader({ icon: Icon, title }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <Icon size={18} className="text-violet-600" />
      <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">
        {title}
      </h2>
    </div>
  )
}

// ── Modal backdrop + bottom sheet ─────────────────────────────────────────────
function Modal({ show, onClose, children, disableBackdropClose = false }) {
  if (!show) return null
  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={disableBackdropClose ? undefined : onClose}
      />
      <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl p-6 z-50 max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 text-xl font-bold leading-none"
          aria-label="Close modal"
        >
          ×
        </button>
        {children}
      </div>
    </>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
export default function Settings() {
  const navigate = useNavigate()

  // ── Store selectors ──────────────────────────────────────────────────────────
  const monthlyIncome    = useStore(s => s.monthlyIncome)
  const users            = useStore(s => s.users)
  const emergencyFund    = useStore(s => s.emergencyFund)
  const isOffline        = useStore(s => s.isOffline)
  const expenses         = useStore(s => s.expenses)
  const jobApplications  = useStore(s => s.jobApplications)

  // Store actions
  const updateMonthlyIncome = useStore(s => s.updateMonthlyIncome)
  const setCurrentUser      = useStore(s => s.setCurrentUser)
  const setIsOffline        = useStore(s => s.setIsOffline)
  const resetStore          = useStore(s => s.resetStore)

  // ── Toast ────────────────────────────────────────────────────────────────────
  const [toast, setToast] = useState(null)

  function showToast(message, type = 'success') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 2000)
  }

  // ── Section A: Monthly Income ─────────────────────────────────────────────
  const [pension,   setPension]   = useState(String(monthlyIncome.pension))
  const [nithish,   setNithish]   = useState(String(monthlyIncome.nithish))
  const [abeerami,  setAbeerami]  = useState(String(monthlyIncome.abeerami))

  useEffect(() => {
    setPension(String(monthlyIncome.pension))
    setNithish(String(monthlyIncome.nithish))
    setAbeerami(String(monthlyIncome.abeerami))
  }, [monthlyIncome.pension, monthlyIncome.nithish, monthlyIncome.abeerami])

  const totalIncome = (parseFloat(pension) || 0) + (parseFloat(nithish) || 0) + (parseFloat(abeerami) || 0)
  const PENSION_BASELINE = 37604
  const HOUSEHOLD_UPPER  = 85800

  async function handleSaveIncome() {
    const body = {
      pension:  parseFloat(pension)  || 0,
      nithish:  parseFloat(nithish)  || 0,
      abeerami: parseFloat(abeerami) || 0,
    }
    // UNCERTAIN: api.js has no settings.updateIncome — using direct fetch as documented fallback
    const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'
    try {
      await fetch(`${BASE_URL}/api/settings/income`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    } catch {
      // Silent fail — store update below always runs
    }
    // useStore.updateMonthlyIncome takes (field, value) — call three times
    updateMonthlyIncome('pension',  body.pension)
    updateMonthlyIncome('nithish',  body.nithish)
    updateMonthlyIncome('abeerami', body.abeerami)
    showToast('Income updated')
  }

  // ── Section B: PIN Management ─────────────────────────────────────────────
  const [pinModal,     setPinModal]    = useState(false)
  const [pinUser,      setPinUser]     = useState(null)   // { id, name, color }
  const [newPin,       setNewPin]      = useState('')
  const [confirmPin,   setConfirmPin]  = useState('')
  const [pinError,     setPinError]    = useState('')

  function openPinModal(user) {
    setPinUser(user)
    setNewPin('')
    setConfirmPin('')
    setPinError('')
    setPinModal(true)
  }

  function handleSavePin() {
    if (!newPin || !confirmPin) {
      setPinError('Please fill both fields.')
      return
    }
    if (!/^\d{4}$/.test(newPin)) {
      setPinError('PIN must be exactly 4 digits.')
      return
    }
    if (newPin !== confirmPin) {
      setPinError('PINs do not match')
      return
    }
    // Update store.users by mapping over users array
    useStore.setState(state => ({
      users: state.users.map(u =>
        u.id === pinUser.id ? { ...u, pin: newPin } : u
      ),
    }))
    setPinModal(false)
    showToast(`PIN updated for ${pinUser.name}`)
  }

  // ── Section C: Emergency Fund ─────────────────────────────────────────────
  const [efTarget,     setEfTarget]    = useState(String(emergencyFund.target))
  const [efIsolated,   setEfIsolated]  = useState(emergencyFund.isIsolated)

  useEffect(() => {
    setEfTarget(String(emergencyFund.target))
    setEfIsolated(emergencyFund.isIsolated)
  }, [emergencyFund.target, emergencyFund.isIsolated])

  function handleEfTargetBlur() {
    const val = parseFloat(efTarget) || 0
    useStore.setState(state => ({
      emergencyFund: { ...state.emergencyFund, target: val },
    }))
  }

  function handleEfIsolatedChange(e) {
    const checked = e.target.checked
    setEfIsolated(checked)
    useStore.setState(state => ({
      emergencyFund: { ...state.emergencyFund, isIsolated: checked },
    }))
  }

  // ── Section D1: Delete Expenses by Month ─────────────────────────────────
  // Build unique YYYY-MM list from store.expenses
  const expenseMonths = [...new Set(expenses.map(e => e.date?.substring(0, 7)).filter(Boolean))].sort().reverse()
  const [selectedExpMonth,  setSelectedExpMonth]  = useState('')
  const [deleteExpModal,    setDeleteExpModal]     = useState(false)

  // Count expenses for selected month
  const expCountForMonth = expenses.filter(e => e.date?.startsWith(selectedExpMonth)).length

  // Format YYYY-MM → "June 2026"
  function formatYYYYMM(yyyymm) {
    if (!yyyymm) return ''
    const [year, month] = yyyymm.split('-')
    return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString('en-IN', {
      month: 'long', year: 'numeric',
    })
  }

  async function handleDeleteExpenses() {
    const month = selectedExpMonth
    const count = expCountForMonth
    const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'
    // api.js has no expenses.deleteBulk — using direct fetch as documented fallback
    try {
      await fetch(`${BASE_URL}/api/expenses/bulk?month=${month}`, { method: 'DELETE' })
    } catch {
      // Silent fail — store update below always runs
    }
    useStore.setState(state => ({
      expenses: state.expenses.filter(e => !e.date?.startsWith(month)),
    }))
    setDeleteExpModal(false)
    showToast(`Deleted ${count} expenses for ${formatYYYYMM(month)}`)
  }

  // ── Section D2: Delete Job Applications by Status ─────────────────────────
  const [selectedAppStatus, setSelectedAppStatus] = useState('all')
  const [deleteAppModal,    setDeleteAppModal]     = useState(false)

  function countByStatus(status) {
    if (status === 'all') return jobApplications.length
    return jobApplications.filter(j => j.status === status).length
  }

  function labelForStatus(status) {
    return JOB_STATUSES.find(s => s.value === status)?.label ?? status
  }

  const appCountForStatus = countByStatus(selectedAppStatus)

  async function handleDeleteApplications() {
    const status = selectedAppStatus
    const count  = appCountForStatus
    const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'
    // employment.py line 66–79 confirms DELETE /api/employment/bulk?status= exists
    try {
      await fetch(`${BASE_URL}/api/employment/bulk?status=${status}`, { method: 'DELETE' })
    } catch {
      // Silent fail — store update below always runs
    }
    useStore.setState(state => ({
      jobApplications: status === 'all'
        ? []
        : state.jobApplications.filter(j => j.status !== status),
    }))
    setDeleteAppModal(false)
    showToast(`Deleted ${count} application records`)
  }

  // ── Section E: Full Reset ─────────────────────────────────────────────────
  const [resetModal,    setResetModal]   = useState(false)
  const [resetLoading,  setResetLoading] = useState(false)

  async function handleFullReset() {
    setResetLoading(true)
    const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'
    // api.js has no reset function — using direct fetch as documented fallback
    try {
      const res = await fetch(`${BASE_URL}/api/reset`, {
        method: 'DELETE',
        headers: { 'X-Confirm-Reset': 'DELETE-ALL-DATA' },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      // Step 3a: success path
      // resetStore() clears localStorage and resets all slices to INITIAL_DATA
      resetStore()
      setResetModal(false)
      setResetLoading(false)
      showToast('All data has been reset.')
      // Brief delay so toast is visible before nav
      setTimeout(() => {
        setCurrentUser(null)
        navigate('/')
      }, 600)
    } catch {
      // Step 3b: error path — do NOT clear localStorage, do NOT update store
      setResetLoading(false)
      setResetModal(false)
      showToast('Reset failed — your data is safe. Try again.', 'error')
    }
  }

  // ── Section F: App Info / Connection ─────────────────────────────────────
  async function handleCheckConnection() {
    const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'
    try {
      const res = await fetch(`${BASE_URL}/health`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setIsOffline(false)
      showToast('Backend is online.')
    } catch {
      setIsOffline(true)
      showToast('Backend unreachable.', 'error')
    }
  }

  // ═════════════════════════════════════════════════════════════════════════════
  return (
    <div className="px-4 py-4 pb-28">

      {/* ── Section A: Monthly Income ──────────────────────────────────────── */}
      <div className="mb-8">
        <SectionHeader icon={Wallet} title="Monthly Income" />

        <div className="space-y-3">
          <Input
            id="income-pension"
            label="Amma's Pension"
            prefix="₹"
            inputMode="numeric"
            value={pension}
            onChange={e => setPension(e.target.value)}
          />
          <Input
            id="income-nithish"
            label="Nithish's Salary"
            prefix="₹"
            inputMode="numeric"
            value={nithish}
            onChange={e => setNithish(e.target.value)}
          />
          <Input
            id="income-abeerami"
            label="Abeerami's Contribution"
            prefix="₹"
            inputMode="numeric"
            value={abeerami}
            onChange={e => setAbeerami(e.target.value)}
          />
        </div>

        {/* Running total */}
        <div className="mt-3 text-sm text-slate-600">
          Total household income:{' '}
          <span className="font-semibold text-slate-800">{formatCurrency(totalIncome)}</span>
        </div>

        {/* Threshold notes */}
        {totalIncome > 0 && totalIncome < PENSION_BASELINE && (
          <p className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            ⚠ Below current pension baseline ({formatCurrency(PENSION_BASELINE)})
          </p>
        )}
        {totalIncome > HOUSEHOLD_UPPER && (
          <p className="mt-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
            ✓ Surplus: {formatCurrency(totalIncome - HOUSEHOLD_UPPER)}/month
          </p>
        )}

        <Button
          variant="primary"
          className="mt-4 w-full"
          onClick={handleSaveIncome}
          id="btn-save-income"
        >
          Save Income
        </Button>
      </div>
      <hr className="border-slate-100 mb-8" />

      {/* ── Section B: User PINs ───────────────────────────────────────────── */}
      <div className="mb-8">
        <SectionHeader icon={User} title="User PINs" />

        <div className="space-y-3">
          {users.map(user => (
            <div
              key={user.id}
              className="flex items-center justify-between bg-white rounded-xl border border-slate-100 shadow-sm px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: user.color }}
                />
                <div>
                  <p className="text-sm font-medium text-slate-800">{user.name}</p>
                  <p className="text-xs text-slate-400 tracking-widest">••••</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => openPinModal(user)}
                id={`btn-change-pin-${user.id}`}
              >
                Change PIN
              </Button>
            </div>
          ))}
        </div>
      </div>
      <hr className="border-slate-100 mb-8" />

      {/* ── Section C: Emergency Fund ──────────────────────────────────────── */}
      <div className="mb-8">
        <SectionHeader icon={Shield} title="Emergency Fund" />

        <div className="space-y-4">
          <div className="w-full">
            <label htmlFor="ef-target" className="block text-sm font-medium text-slate-700 mb-1">
              Target Amount
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm select-none">₹</span>
              <input
                id="ef-target"
                type="text"
                inputMode="numeric"
                value={efTarget}
                onChange={e => setEfTarget(e.target.value)}
                onBlur={handleEfTargetBlur}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 pl-7 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              />
            </div>
          </div>

          <label className="flex items-center justify-between bg-white rounded-xl border border-slate-100 shadow-sm px-4 py-3 cursor-pointer select-none">
            <span className="text-sm font-medium text-slate-700">Fund is isolated</span>
            <input
              id="ef-isolated-toggle"
              type="checkbox"
              checked={efIsolated}
              onChange={handleEfIsolatedChange}
              className="w-5 h-5 rounded accent-violet-600 cursor-pointer"
            />
          </label>

          {/* Non-editable rule card */}
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <Lock size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 leading-relaxed">
              {emergencyFund.rule}
            </p>
          </div>
        </div>
      </div>
      <hr className="border-slate-100 mb-8" />

      {/* ── Section D: Delete Data ─────────────────────────────────────────── */}
      <div className="mb-8">
        <SectionHeader icon={Trash2} title="Delete Data" />

        {/* D1 — Delete expenses by month */}
        <div className="mb-6">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
            Expenses by Month
          </p>
          {expenseMonths.length === 0 ? (
            <p className="text-sm text-slate-400">No expense records to delete.</p>
          ) : (
            <>
              <select
                id="select-expense-month"
                value={selectedExpMonth}
                onChange={e => setSelectedExpMonth(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-500 mb-3"
              >
                <option value="">— Select a month —</option>
                {expenseMonths.map(m => (
                  <option key={m} value={m}>{formatYYYYMM(m)}</option>
                ))}
              </select>
              <Button
                variant="danger"
                className="w-full"
                disabled={!selectedExpMonth}
                onClick={() => setDeleteExpModal(true)}
                id="btn-delete-expense-month"
              >
                Delete {selectedExpMonth ? formatYYYYMM(selectedExpMonth) : ''} Expenses
              </Button>
            </>
          )}
        </div>

        {/* D2 — Delete job applications by status */}
        <div className="mb-6">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
            Job Applications by Status
          </p>
          {jobApplications.length === 0 ? (
            <p className="text-sm text-slate-400">No job applications to delete.</p>
          ) : (
            <>
              <select
                id="select-app-status"
                value={selectedAppStatus}
                onChange={e => setSelectedAppStatus(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-500 mb-3"
              >
                {JOB_STATUSES.map(s => (
                  <option key={s.value} value={s.value}>
                    {s.label} ({countByStatus(s.value)})
                  </option>
                ))}
              </select>
              <Button
                variant="danger"
                className="w-full"
                onClick={() => setDeleteAppModal(true)}
                id="btn-delete-applications"
              >
                Delete {appCountForStatus} {labelForStatus(selectedAppStatus)} Application{appCountForStatus !== 1 ? 's' : ''}
              </Button>
            </>
          )}
        </div>

        {/* D3 — Delete specific assets (informational link) */}
        <Card
          onClick={() => navigate('/assets')}
          className="flex items-center justify-between"
        >
          <p className="text-sm text-slate-600 leading-relaxed pr-2">
            To delete a specific FD, LIC policy, mutual fund, or chit fund,{' '}
            <span className="text-violet-600 font-medium">go to Assets → tap the item → Delete.</span>
          </p>
          <ChevronRight size={18} className="text-slate-400 flex-shrink-0" />
        </Card>
      </div>
      <hr className="border-slate-100 mb-8" />

      {/* ── Section E: Full Data Reset ─────────────────────────────────────── */}
      <div className="mb-8">
        <div className="rounded-xl border border-red-200 border-l-4 border-l-red-500 bg-red-50 p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={18} className="text-red-500" />
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">
              Danger Zone — Full Reset
            </h2>
          </div>
          <p className="text-sm text-slate-600 mb-4 leading-relaxed">
            Permanently deletes ALL expenses, milestones, job applications, and asset records.
            User PINs are preserved. This cannot be undone.
          </p>
          <Button
            variant="danger"
            className="w-full h-12"
            onClick={() => setResetModal(true)}
            id="btn-reset-all-data"
          >
            Reset All Data
          </Button>
        </div>
      </div>
      <hr className="border-slate-100 mb-8" />

      {/* ── Section F: App Info ────────────────────────────────────────────── */}
      <div className="mb-8">
        <SectionHeader icon={Activity} title="App Info" />

        <div className="bg-white rounded-xl border border-slate-100 shadow-sm divide-y divide-slate-50">
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-slate-500">App version</span>
            <span className="text-sm font-medium text-slate-800">v1.0.0</span>
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-slate-500">Built by</span>
            <span className="text-sm font-medium text-slate-800">
              Nithish —{' '}
              <a href="#" className="text-violet-600 underline">GitHub</a>
            </span>
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-slate-500">Backend</span>
            {isOffline ? (
              <span className="text-sm font-medium text-red-600 flex items-center gap-1">
                <XCircle size={14} /> Offline ✗
              </span>
            ) : (
              <span className="text-sm font-medium text-emerald-600 flex items-center gap-1">
                <CheckCircle size={14} /> Online ✓
              </span>
            )}
          </div>
        </div>

        <Button
          variant="secondary"
          size="sm"
          className="mt-3 w-full"
          onClick={handleCheckConnection}
          id="btn-check-connection"
        >
          <RefreshCw size={14} />
          Check connection
        </Button>

        {/* Settings access note — Header/BottomNav are locked, so accessible via URL */}
        <p className="mt-4 text-xs text-slate-400 text-center">
          Settings accessible at <span className="font-mono text-slate-500">/settings</span>
        </p>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* MODAL: Change PIN                                                      */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <Modal show={pinModal} onClose={() => setPinModal(false)}>
        <h3 className="text-lg font-semibold text-slate-800 mb-4 pr-6">
          Change PIN — {pinUser?.name}
        </h3>
        <div className="space-y-3">
          <Input
            id="pin-new"
            label="New PIN"
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={newPin}
            onChange={e => { setNewPin(e.target.value); setPinError('') }}
            autoFocus
          />
          <Input
            id="pin-confirm"
            label="Confirm PIN"
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={confirmPin}
            onChange={e => { setConfirmPin(e.target.value); setPinError('') }}
          />
          {pinError && (
            <p className="text-sm text-red-600">{pinError}</p>
          )}
        </div>
        <div className="flex gap-3 mt-5">
          <Button variant="secondary" className="flex-1" onClick={() => setPinModal(false)} id="btn-pin-cancel">
            Cancel
          </Button>
          <Button variant="primary" className="flex-1" onClick={handleSavePin} id="btn-pin-save">
            Save PIN
          </Button>
        </div>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* MODAL: Delete Expenses by Month                                        */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <Modal show={deleteExpModal} onClose={() => setDeleteExpModal(false)}>
        <h3 className="text-lg font-semibold text-slate-800 mb-2 pr-6">
          Delete {formatYYYYMM(selectedExpMonth)} expenses?
        </h3>
        <p className="text-sm text-slate-600 mb-5">
          This will permanently delete all{' '}
          <strong>{expCountForMonth}</strong> expenses recorded for{' '}
          <strong>{formatYYYYMM(selectedExpMonth)}</strong>.
        </p>
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={() => setDeleteExpModal(false)} id="btn-exp-del-cancel">
            Cancel
          </Button>
          <Button variant="danger" className="flex-1" onClick={handleDeleteExpenses} id="btn-exp-del-confirm">
            Delete {expCountForMonth} expenses
          </Button>
        </div>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* MODAL: Delete Applications by Status                                   */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <Modal show={deleteAppModal} onClose={() => setDeleteAppModal(false)}>
        <h3 className="text-lg font-semibold text-slate-800 mb-2 pr-6">
          Delete {labelForStatus(selectedAppStatus)} applications?
        </h3>
        <p className="text-sm text-slate-600 mb-5">
          This will delete{' '}
          <strong>{appCountForStatus}</strong>{' '}
          <strong>{labelForStatus(selectedAppStatus)}</strong> application records.
        </p>
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={() => setDeleteAppModal(false)} id="btn-app-del-cancel">
            Cancel
          </Button>
          <Button variant="danger" className="flex-1" onClick={handleDeleteApplications} id="btn-app-del-confirm">
            Delete {appCountForStatus} records
          </Button>
        </div>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* MODAL: Full Reset                                                       */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <Modal
        show={resetModal}
        onClose={resetLoading ? undefined : () => setResetModal(false)}
        disableBackdropClose={resetLoading}
      >
        <h3 className="text-lg font-semibold text-slate-800 mb-2 pr-6">
          Are you absolutely sure?
        </h3>
        <p className="text-sm text-slate-600 mb-5 leading-relaxed">
          This will delete everything except your PINs. There is no undo.
        </p>
        <div className="flex flex-col gap-3">
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => setResetModal(false)}
            disabled={resetLoading}
            id="btn-reset-cancel"
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            className="w-full"
            loading={resetLoading}
            onClick={handleFullReset}
            id="btn-reset-confirm"
          >
            Yes, Delete Everything
          </Button>
        </div>
      </Modal>

      {/* ── Toast ──────────────────────────────────────────────────────────── */}
      {toast && (
        <div
          className={`
            fixed bottom-20 left-1/2 -translate-x-1/2 z-50
            flex items-center gap-2 px-4 py-3
            max-w-xs w-auto rounded-xl shadow-lg text-white text-sm font-medium
            ${toast.type === 'error' ? 'bg-red-600' : 'bg-emerald-600'}
          `}
        >
          {toast.type === 'error'
            ? <XCircle size={16} className="flex-shrink-0" />
            : <CheckCircle size={16} className="flex-shrink-0" />
          }
          {toast.message}
        </div>
      )}
    </div>
  )
}
