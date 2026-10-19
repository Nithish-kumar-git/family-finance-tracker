import { authorizedFetch } from '../utils/authorizedFetch.js'
// Settings page — income, sign-in, emergency fund, delete ops, reset, app info

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Shield, User, Wallet, Trash2, RefreshCw, Activity,
  ChevronRight, AlertTriangle, CheckCircle, XCircle, Lock,
} from 'lucide-react'

import useStore, { saveLocalChanges } from '../store/useStore'
import RecoveryPanel from '../components/RecoveryPanel.jsx'
import WorkspaceEditor from '../components/WorkspaceEditor.jsx'
import { formatCurrency } from '../utils/formatters'
import { RESTORE_UNAVAILABLE_MESSAGE } from '../utils/dataRecovery'
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
      <Icon size={18} className="text-accent" />
      <h2 className="text-xs font-medium text-muted uppercase tracking-widest">
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
          className="absolute top-4 right-4 text-muted hover:text-muted text-xl font-bold leading-none"
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

  async function handleSaveIncome() {
    const body = {
      pension:  parseFloat(pension)  || 0,
      nithish:  parseFloat(nithish)  || 0,
      abeerami: parseFloat(abeerami) || 0,
    }
    // UNCERTAIN: api.js has no settings.updateIncome — using direct fetch as documented fallback
    const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'
    try {
      const response = await authorizedFetch(`${BASE_URL}/api/settings/income`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!response.ok) throw Error('Save failed')
    } catch {
      showToast('Income was not saved. Your form is unchanged.', 'error'); return
    }
    showToast('Income saved on this device')
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
    saveLocalChanges(state => ({
      emergencyFund: { ...state.emergencyFund, target: val },
    }))
  }

  function handleEfIsolatedChange(e) {
    const checked = e.target.checked
    setEfIsolated(checked)
    saveLocalChanges(state => ({
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
      const response = await authorizedFetch(`${BASE_URL}/api/expenses/bulk?month=${encodeURIComponent(month)}`, { method: 'DELETE' })
      if (!response.ok || (await response.json())?.deleted !== true) throw Error('Delete unconfirmed')
    } catch {
      showToast('Deletion failed. Your expenses are unchanged.', 'error'); return
    }
    saveLocalChanges(state => ({
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
      const response = await authorizedFetch(`${BASE_URL}/api/employment/bulk?status=${encodeURIComponent(status)}`, { method: 'DELETE' })
      if (!response.ok || (await response.json())?.deleted !== true) throw Error('Delete unconfirmed')
    } catch {
      showToast('Deletion failed. Your applications are unchanged.', 'error'); return
    }
    saveLocalChanges(state => ({
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
    showToast('Full reset is disabled. Your records are unchanged.', 'error')
  }

  // ── Section F: App Info / Connection ─────────────────────────────────────
  async function handleCheckConnection() {
    const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'
    try {
      const res = await authorizedFetch(`${BASE_URL}/health`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setIsOffline(false)
      showToast('Browser workspace is available. Cloud database was not contacted.')
    } catch {
      setIsOffline(true)
      showToast('Backend unreachable.', 'error')
    }
  }

  // ═════════════════════════════════════════════════════════════════════════════
  return (
    <div className="px-4 py-4 pb-28 lg:pb-8 lg:max-w-3xl lg:mx-auto lg:px-6">

      {/* ── Hero ── */}
      <div className="-mx-4 -mt-4 px-4 pt-4 pb-6 bg-surface mb-6">
        <div className="flex justify-between items-end">
          <div>
            <p className="text-3xl font-bold tracking-tight text-ink">Settings</p>
            <p className="text-xs font-medium uppercase tracking-widest text-muted mt-0.5">Preferences & Data</p>
          </div>
          <span className="text-sm font-medium text-muted mb-1">v1.0.0</span>
        </div>
      </div>

      {/* ── Section A: Monthly Income ──────────────────────────────────────── */}
      <div className="mb-8">
        <SectionHeader icon={Wallet} title="Monthly Income" />

        <div className="space-y-3">
          <Input
            id="income-pension"
            label={`${users.find(u => u.id === 'mother')?.name ?? 'Parent'} — pension`}
            prefix="₹"
            inputMode="numeric"
            value={pension}
            onChange={e => setPension(e.target.value)}
          />
          <Input
            id="income-nithish"
            label={`${users.find(u => u.id === 'nithish')?.name ?? 'Member'} — salary`}
            prefix="₹"
            inputMode="numeric"
            value={nithish}
            onChange={e => setNithish(e.target.value)}
          />
          <Input
            id="income-abeerami"
            label={`${users.find(u => u.id === 'abeerami')?.name ?? 'Member'} — contribution`}
            prefix="₹"
            inputMode="numeric"
            value={abeerami}
            onChange={e => setAbeerami(e.target.value)}
          />
        </div>

        {/* Running total */}
        <div className="mt-3 text-sm text-muted">
          Total household income:{' '}
          <span className="font-semibold text-ink">{formatCurrency(totalIncome)}</span>
        </div>

        <Button
          variant="primary"
          className="mt-4 w-full"
          onClick={handleSaveIncome}
          id="btn-save-income"
        >
          Save Income
        </Button>
      </div>
      <hr className="border-line mb-8" />

      <div className="mb-8">
        <SectionHeader icon={User} title="Family sign-in" />
        <p className="text-sm text-muted">Choose a profile and enter its browser PIN. PINs do not authorize cloud access. Existing personal records on this device are retained; the recruiter demo uses separate synthetic records.</p>
      </div>
      <RecoveryPanel />
      <WorkspaceEditor />
      <hr className="border-line mb-8" />

      {/* ── Section C: Emergency Fund ──────────────────────────────────────── */}
      <div className="mb-8">
        <SectionHeader icon={Shield} title="Emergency Fund" />

        <div className="space-y-4">
          <div className="w-full">
            <label htmlFor="ef-target" className="block text-sm font-medium text-ink mb-1">
              Target Amount
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm select-none">₹</span>
              <input
                id="ef-target"
                type="text"
                inputMode="numeric"
                value={efTarget}
                onChange={e => setEfTarget(e.target.value)}
                onBlur={handleEfTargetBlur}
                className="w-full rounded-lg border border-line px-3 py-2 pl-7 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
              />
            </div>
          </div>

          <div className="w-full">
            <label htmlFor="ef-cash"
              className="block text-sm font-medium text-ink mb-1">
              Bank savings balance
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm select-none">₹</span>
              <input
                id="ef-cash"
                type="text"
                inputMode="numeric"
                value={String(emergencyFund.cashInBank ?? 0)}
                onChange={e => {
                  const val = parseFloat(e.target.value) || 0
                  saveLocalChanges(state => ({
                    emergencyFund: { ...state.emergencyFund, cashInBank: val }
                  }))
                }}
                className="w-full rounded-lg border border-line px-3 py-2 pl-7 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
              />
            </div>
            <p className="text-xs text-muted mt-1">
              Update this from your latest bank balance.
            </p>
          </div>

          <label className="flex items-center justify-between bg-white rounded-lg border border-line  px-4 py-3 cursor-pointer select-none">
            <span className="text-sm font-medium text-ink">Fund is isolated</span>
            <input
              id="ef-isolated-toggle"
              type="checkbox"
              checked={efIsolated}
              onChange={handleEfIsolatedChange}
              className="w-5 h-5 rounded accent-accent cursor-pointer"
            />
          </label>

          {/* Non-editable rule card */}
          <div className="flex items-start gap-3 bg-canvas border border-line rounded-lg px-4 py-3">
            <Lock size={16} className="text-ink flex-shrink-0 mt-0.5" />
            <p className="text-xs text-ink leading-relaxed">
              {emergencyFund.rule}
            </p>
          </div>
        </div>
      </div>
      <hr className="border-line mb-8" />

      {/* ── Section D: Delete Data ─────────────────────────────────────────── */}
      <div className="mb-8">
        <SectionHeader icon={Trash2} title="Delete Data" />

        {/* D1 — Delete expenses by month */}
        <div className="mb-6">
          <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">
            Expenses by Month
          </p>
          {expenseMonths.length === 0 ? (
            <p className="text-sm text-muted">No expense records to delete.</p>
          ) : (
            <>
              <select
                id="select-expense-month"
                value={selectedExpMonth}
                onChange={e => setSelectedExpMonth(e.target.value)}
                className="w-full rounded-lg border border-line px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-accent mb-3"
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
          <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">
            Job Applications by Status
          </p>
          {jobApplications.length === 0 ? (
            <p className="text-sm text-muted">No job applications to delete.</p>
          ) : (
            <>
              <select
                id="select-app-status"
                value={selectedAppStatus}
                onChange={e => setSelectedAppStatus(e.target.value)}
                className="w-full rounded-lg border border-line px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-accent mb-3"
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
          <p className="text-sm text-muted leading-relaxed pr-2">
            To delete a specific FD, LIC policy, mutual fund, or chit fund,{' '}
            <span className="text-accent font-medium">go to Assets → tap the item → Delete.</span>
          </p>
          <ChevronRight size={18} className="text-muted flex-shrink-0" />
        </Card>
      </div>
      <hr className="border-line mb-8" />

      {/* ── Section E-1: Data Recovery ────────────────────────────────────── */}
      <div className="mb-8">
        <div className="rounded-lg border border-line border-l-4 border-l-accent bg-accent-soft p-4">
          <div className="flex items-center gap-2 mb-3">
            <Activity size={18} className="text-accent" />
            <h2 className="text-xs font-medium text-accent uppercase tracking-widest">
              Data Recovery
            </h2>
          </div>
          <p className="text-sm text-muted mb-4 leading-relaxed">
            {RESTORE_UNAVAILABLE_MESSAGE}
          </p>
          <Button
            variant="primary"
            className="w-full h-12 bg-accent hover:bg-accent"
            disabled
            id="btn-recover-data"
          >
            <Activity size={16} className="mr-2" />
            Restore Data — temporarily unavailable
          </Button>
        </div>
      </div>
      <hr className="border-line mb-8" />

      {/* ── Section E-2: Full Data Reset ───────────────────────────────────── */}
      <div className="mb-8">
        <div className="rounded-lg border border-red-200 border-l-4 border-l-red-500 bg-red-50 p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={18} className="text-red-700" />
            <h2 className="text-xs font-medium text-red-700 uppercase tracking-widest">
              Danger Zone — Full Reset
            </h2>
          </div>
          <p className="text-sm text-muted mb-4 leading-relaxed">
            Full reset is disabled to protect your existing records. Use reviewed, individual changes instead.
          </p>
          <Button
            variant="danger"
            className="w-full h-12"
            disabled
            id="btn-reset-all-data"
          >
            Full reset disabled
          </Button>
        </div>
      </div>
      <hr className="border-line mb-8" />

      {/* ── Section F: App Info ────────────────────────────────────────────── */}
      <div className="mb-8">
        <SectionHeader icon={Activity} title="App Info" />

        <div className="bg-white rounded-lg border border-line  divide-y divide-line">
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-muted">App version</span>
            <span className="text-sm font-medium text-ink">v1.0.0</span>
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-muted">Built by</span>
            <span className="text-sm font-medium text-ink">
              Nithish —{' '}
              <a href="#" className="text-accent underline">GitHub</a>
            </span>
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-muted">Backend</span>
            {isOffline ? (
              <span className="text-sm font-medium text-red-600 flex items-center gap-1">
                <XCircle size={14} /> Offline
              </span>
            ) : (
              <span className="text-sm font-medium text-accent flex items-center gap-1">
                <CheckCircle size={14} /> Browser storage
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
        <p className="mt-4 text-xs text-muted text-center">
          Settings accessible at <span className="font-mono text-muted">/settings</span>
        </p>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* MODAL: Delete Expenses by Month                                        */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <Modal show={deleteExpModal} onClose={() => setDeleteExpModal(false)}>
        <h3 className="text-lg font-semibold text-ink mb-2 pr-6">
          Delete {formatYYYYMM(selectedExpMonth)} expenses?
        </h3>
        <p className="text-sm text-muted mb-5">
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
        <h3 className="text-lg font-semibold text-ink mb-2 pr-6">
          Delete {labelForStatus(selectedAppStatus)} applications?
        </h3>
        <p className="text-sm text-muted mb-5">
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
        <h3 className="text-lg font-semibold text-ink mb-2 pr-6">
          Are you absolutely sure?
        </h3>
        <p className="text-sm text-muted mb-5 leading-relaxed">
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
            flex items-center gap-2 px-5 py-3
            w-auto rounded-lg  text-white text-sm font-medium whitespace-nowrap
            ${toast.type === 'error' ? 'bg-red-600' : 'bg-accent'}
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
