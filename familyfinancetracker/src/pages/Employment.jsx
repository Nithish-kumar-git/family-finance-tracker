import { useState, useEffect, useMemo } from 'react'
import useStore from '../store/useStore'
import { api } from '../utils/api'
import { formatCurrency, formatDate } from '../utils/formatters'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import {
  Briefcase,
  TrendingUp,
  Target,
  ChevronDown,
  ChevronRight,
  CheckCircle,
  AlertTriangle,
  Plus,
} from 'lucide-react'

// ─── Constants ───────────────────────────────────────────────────────────────

const BASELINE_DEFICIT = 48196 // family's known deficit at pension-only income
const WEEKLY_TARGET = 25

const PLATFORM_OPTIONS = ['LinkedIn', 'Naukri', 'Indeed', 'Referral', 'Other']

const STATUS_OPTIONS = [
  { value: 'applied', label: 'Applied' },
  { value: 'interview_scheduled', label: 'Interview Scheduled' },
  { value: 'interviewed', label: 'Interviewed' },
  { value: 'offered', label: 'Offer Received' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'accepted', label: 'Accepted' },
]

const STATUS_COLORS = {
  applied: 'slate',
  interview_scheduled: 'indigo',
  interviewed: 'blue',
  rejected: 'red',
  offered: 'green',
  accepted: 'green',
}

const PLATFORM_COLORS = {
  LinkedIn: 'blue',
  Naukri: 'amber',
  Indeed: 'indigo',
  Referral: 'green',
  Other: 'slate',
}

const EMPLOYMENT_STATUS_CYCLE = [
  'searching',
  'interview_stage',
  'offer_received',
  'employed',
]

const EMPLOYMENT_STATUS_DISPLAY = {
  searching: { label: 'Searching', badgeColor: 'amber' },
  interview_stage: { label: 'Interview Stage', badgeColor: 'indigo' },
  offer_received: { label: 'Offer Received', badgeColor: 'blue' },
  employed: { label: 'Employed', badgeColor: 'green' },
}

// ─── Helper: compute this week count from local data ─────────────────────────

function computeThisWeek(apps) {
  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)
  return apps.filter((a) => new Date(a.appliedDate) >= weekAgo).length
}

// ─── Helper: build last 8 weeks of application counts ────────────────────────

function buildWeeklyData(apps) {
  const weeks = []
  const now = new Date()
  for (let i = 7; i >= 0; i--) {
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() - i * 7 - now.getDay())
    weekStart.setHours(0, 0, 0, 0)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 6)
    weekEnd.setHours(23, 59, 59, 999)

    const count = apps.filter((a) => {
      const d = new Date(a.appliedDate)
      return d >= weekStart && d <= weekEnd
    }).length

    const label = i === 0 ? 'This wk' : `${8 - i}w ago`
    weeks.push({ label, count })
  }
  return weeks
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function Employment() {
  // ── Primary data ───────────────────────────────────────────────────────────
  const [applications, setApplications] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  // ── Employment status (persisted to localStorage) ──────────────────────────
  const [employmentStatus, setEmploymentStatus] = useState(() => {
    try {
      return localStorage.getItem('fft_nithish_status') ?? 'searching'
    } catch {
      return 'searching'
    }
  })

  // ── Store reads ────────────────────────────────────────────────────────────
  const state = useStore()

  // ── Salary ─────────────────────────────────────────────────────────────────
  const [salaryInput, setSalaryInput] = useState(
    () => String(state.monthlyIncome?.nithish || '')
  )
  const [salarySaving, setSalarySaving] = useState(false)

  // ── Add application form ───────────────────────────────────────────────────
  const [addForm, setAddForm] = useState({
    company: '',
    role: '',
    platform: 'LinkedIn',
    appliedDate: new Date().toISOString().split('T')[0],
    followUpDate: '',
    notes: '',
  })
  const [addLoading, setAddLoading] = useState(false)
  const [addError, setAddError] = useState('')
  const [addSuccess, setAddSuccess] = useState(false)

  // ── Per-application status loading ─────────────────────────────────────────
  const [updatingStatusId, setUpdatingStatusId] = useState(null)

  // ── Rejected section collapsed ─────────────────────────────────────────────
  const [showRejected, setShowRejected] = useState(false)

  // ── Toast ──────────────────────────────────────────────────────────────────
  const [toast, setToast] = useState(null)

  // ── Load on mount ──────────────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true)
    Promise.allSettled([
      api.employment.getAll(),
      api.employment.getStats(),
    ]).then(([appsResult, statsResult]) => {
      if (appsResult.status === 'fulfilled') {
        const raw = appsResult.value
        const arr = Array.isArray(raw)
          ? raw
          : raw?.applications ?? state.jobApplications ?? []
        setApplications(arr)
      } else {
        setApplications(state.jobApplications ?? [])
      }
      if (statsResult.status === 'fulfilled' && statsResult.value) {
        setStats(statsResult.value)
      }
      setLoading(false)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Toast helper ───────────────────────────────────────────────────────────
  const showToast = (message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 2500)
  }

  // ── Derived values ─────────────────────────────────────────────────────────
  const activeApps = useMemo(
    () =>
      applications
        .filter(
          (a) =>
            a.status === 'applied' || a.status === 'interview_scheduled'
        )
        .sort((a, b) => new Date(b.appliedDate) - new Date(a.appliedDate)),
    [applications]
  )

  const interviewedApps = useMemo(
    () =>
      applications
        .filter((a) => a.status === 'interviewed')
        .sort((a, b) => new Date(b.appliedDate) - new Date(a.appliedDate)),
    [applications]
  )

  const offeredApps = useMemo(
    () =>
      applications
        .filter((a) => a.status === 'offered' || a.status === 'accepted')
        .sort((a, b) => new Date(b.appliedDate) - new Date(a.appliedDate)),
    [applications]
  )

  const rejectedApps = useMemo(
    () =>
      applications
        .filter((a) => a.status === 'rejected')
        .sort((a, b) => new Date(b.appliedDate) - new Date(a.appliedDate)),
    [applications]
  )

  const thisWeek = stats?.this_week ?? computeThisWeek(applications)
  const totalApps = stats?.total ?? applications.length
  const interviewCount =
    stats?.interviews ?? interviewedApps.length + offeredApps.length
  const offerCount = stats?.offers ?? offeredApps.length
  const responseRate =
    totalApps > 0 ? Math.round((interviewCount / totalApps) * 100) : 0

  const nithishSalary = state.monthlyIncome?.nithish ?? 0
  const isEmployed = employmentStatus === 'employed' && nithishSalary > 0
  const inputSalary = parseInt(salaryInput, 10) || 0
  const displaySalary = isEmployed ? nithishSalary : inputSalary
  const newDeficit = BASELINE_DEFICIT - displaySalary
  const isSurplus = newDeficit <= 0

  const weeklyData = useMemo(() => buildWeeklyData(applications), [applications])

  const streak = useMemo(() => {
    let s = 0
    for (let i = weeklyData.length - 1; i >= 0; i--) {
      if (weeklyData[i].count >= WEEKLY_TARGET) s++
      else break
    }
    return s
  }, [weeklyData])

  const weekPct = Math.min((thisWeek / WEEKLY_TARGET) * 100, 100)
  const weekBar =
    weekPct >= 100 ? 'bg-emerald-500' : weekPct >= 40 ? 'bg-amber-500' : 'bg-red-400'
  const weekBadgeColor =
    weekPct >= 100 ? 'green' : weekPct >= 40 ? 'amber' : 'red'

  // ── Employment status handlers ─────────────────────────────────────────────
  const handleCycleStatus = () => {
    const idx = EMPLOYMENT_STATUS_CYCLE.indexOf(employmentStatus)
    const next =
      EMPLOYMENT_STATUS_CYCLE[(idx + 1) % EMPLOYMENT_STATUS_CYCLE.length]
    setEmploymentStatus(next)
    try {
      localStorage.setItem('fft_nithish_status', next)
    } catch {}

    if (employmentStatus === 'employed') {
      useStore.getState().updateMonthlyIncome('nithish', 0)
      setSalaryInput('')
    }
  }

  const handleSaveSalary = async () => {
    const salary = parseInt(salaryInput, 10)
    if (isNaN(salary) || salary <= 0) {
      showToast('Enter a valid monthly salary', 'error')
      return
    }
    setSalarySaving(true)
    useStore.getState().updateMonthlyIncome('nithish', salary)
    await new Promise((r) => setTimeout(r, 300))
    setSalarySaving(false)
    showToast(`Salary of ${formatCurrency(salary)}/month saved ✓`, 'success')
  }

  // ── Add application handler ────────────────────────────────────────────────
  const handleAddApplication = async () => {
    if (!addForm.company.trim() || !addForm.role.trim()) {
      setAddError('Company and role are required.')
      return
    }

    const newApp = {
      company: addForm.company.trim(),
      role: addForm.role.trim(),
      platform: addForm.platform,
      appliedDate:
        addForm.appliedDate || new Date().toISOString().split('T')[0],
      status: 'applied',
      followUpDate: addForm.followUpDate || '',
      notes: addForm.notes.trim(),
    }

    setAddLoading(true)
    try {
      const created = await api.employment.add(newApp)
      const toAdd = created ?? { ...newApp, id: Date.now().toString(36) }
      useStore.getState().addJobApplication(toAdd)
      setApplications((prev) => [toAdd, ...prev])
      setAddForm({
        company: '',
        role: '',
        platform: 'LinkedIn',
        appliedDate: new Date().toISOString().split('T')[0],
        followUpDate: '',
        notes: '',
      })
      setAddError('')
      setAddSuccess(true)
      setTimeout(() => setAddSuccess(false), 1500)
      setStats((prev) =>
        prev
          ? {
              ...prev,
              total: (prev.total ?? 0) + 1,
              this_week: (prev.this_week ?? 0) + 1,
            }
          : prev
      )
      showToast('Application saved ✓', 'success')
    } catch {
      setAddError('Could not save — check connection and try again.')
    }
    setAddLoading(false)
  }

  // ── Status update handler ──────────────────────────────────────────────────
  const handleUpdateStatus = async (id, newStatus) => {
    setUpdatingStatusId(id)
    try {
      await api.employment.updateStatus(id, newStatus)
      useStore.getState().updateJobStatus(id, newStatus)
      setApplications((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: newStatus } : a))
      )
    } catch {
      showToast('Could not update status', 'error')
    }
    setUpdatingStatusId(null)
  }

  // ── Application card renderer ──────────────────────────────────────────────
  const renderApplicationCard = (app) => {
    const days = app.followUpDate
      ? Math.ceil(
          (new Date(app.followUpDate) - new Date()) / 86400000
        )
      : null
    const isFollowUpDue = days !== null && days <= 3 && days >= 0
    const isFollowUpOverdue = days !== null && days < 0

    return (
      <div
        key={app.id}
        className="bg-white rounded-xl border border-slate-200 p-3.5 mb-2"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-800 truncate">
              {app.company}
            </p>
            <p className="text-xs text-slate-500 truncate">{app.role}</p>
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              <Badge color={PLATFORM_COLORS[app.platform] ?? 'slate'}>
                {app.platform}
              </Badge>
              <p className="text-xs text-slate-400">
                {formatDate(app.appliedDate)}
              </p>
              {isFollowUpDue && (
                <Badge color="amber">Follow up in {days}d</Badge>
              )}
              {isFollowUpOverdue && (
                <Badge color="red">Follow up overdue</Badge>
              )}
            </div>
            {app.notes && (
              <p className="text-xs text-slate-400 mt-1 truncate">
                {app.notes}
              </p>
            )}
          </div>

          {/* Status dropdown */}
          <select
            value={app.status}
            disabled={updatingStatusId === app.id}
            onChange={(e) => handleUpdateStatus(app.id, e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-2 py-1.5
                       text-slate-600 focus:outline-none focus:ring-2
                       focus:ring-indigo-500 flex-shrink-0 max-w-[130px]
                       disabled:opacity-50"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-2">
          <Badge color={STATUS_COLORS[app.status] ?? 'slate'}>
            {STATUS_OPTIONS.find((o) => o.value === app.status)?.label ??
              app.status}
          </Badge>
        </div>
      </div>
    )
  }

  // ── Add application form (shared — shown in both loading + loaded states) ──
  const addFormJSX = (
    <Card className={`mb-4 ${addSuccess ? 'border-emerald-300 bg-emerald-50' : ''}`}>
      <p className="text-xs font-medium uppercase tracking-widest text-slate-400 mb-3">
        {addSuccess ? '✓ Saved! Add another:' : 'Log Application'}
      </p>
      <div className="space-y-3">
        {/* Company + Role */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Company <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={addForm.company}
              onChange={(e) =>
                setAddForm((p) => ({ ...p, company: e.target.value }))
              }
              placeholder="Company name"
              className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Role <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={addForm.role}
              onChange={(e) =>
                setAddForm((p) => ({ ...p, role: e.target.value }))
              }
              placeholder="Job title"
              className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Platform + Date */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Platform
            </label>
            <select
              value={addForm.platform}
              onChange={(e) =>
                setAddForm((p) => ({ ...p, platform: e.target.value }))
              }
              className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {PLATFORM_OPTIONS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Date applied
            </label>
            <input
              type="date"
              value={addForm.appliedDate}
              onChange={(e) =>
                setAddForm((p) => ({ ...p, appliedDate: e.target.value }))
              }
              className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Follow-up date */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Follow-up date (optional)
          </label>
          <input
            type="date"
            value={addForm.followUpDate}
            onChange={(e) =>
              setAddForm((p) => ({ ...p, followUpDate: e.target.value }))
            }
            className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm
                       focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Notes (optional)
          </label>
          <input
            type="text"
            value={addForm.notes}
            onChange={(e) =>
              setAddForm((p) => ({ ...p, notes: e.target.value }))
            }
            placeholder="Recruiter name, source, etc."
            maxLength={120}
            className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm
                       focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {addError && (
          <p className="text-xs text-red-600 font-medium">{addError}</p>
        )}

        <Button
          variant="primary"
          size="md"
          className="w-full"
          loading={addLoading}
          onClick={handleAddApplication}
        >
          <Plus size={14} className="mr-1" /> Save Application
        </Button>
      </div>
    </Card>
  )

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Toast ── */}
      {toast && (
        <div
          className={`fixed bottom-20 left-1/2 -translate-x-1/2 z-50 rounded-2xl px-5 py-3
                     shadow-xl flex items-center gap-2 text-sm font-medium
                     text-white whitespace-nowrap
                     ${toast.type === 'error' ? 'bg-red-600' : 'bg-emerald-600'}`}
        >
          {toast.type === 'error' ? (
            <AlertTriangle size={16} />
          ) : (
            <CheckCircle size={16} />
          )}
          {toast.message}
        </div>
      )}

      {loading ? (
        <>
          {/* Skeletons for status + weekly card */}
          <div className="h-40 bg-slate-100 rounded-2xl animate-pulse mb-4" />
          <div className="h-28 bg-slate-100 rounded-2xl animate-pulse mb-4" />
          {/* Add form always visible */}
          {addFormJSX}
          {/* App row skeletons */}
          <div className="h-20 bg-slate-100 rounded-2xl animate-pulse mb-2" />
          <div className="h-20 bg-slate-100 rounded-2xl animate-pulse mb-2" />
          <div className="h-20 bg-slate-100 rounded-2xl animate-pulse mb-2" />
        </>
      ) : (
        <>
          {/* Desktop 2-column layout */}
          <div className="lg:grid lg:grid-cols-5 lg:gap-6">
            <div className="lg:col-span-2">
          {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          {/* SECTION 1 — STATUS CARD                                     */}
          {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          <div className="bg-gradient-to-r from-slate-900 to-slate-800 -mx-4 px-4 pt-4 pb-6 mb-4 lg:mx-0 lg:rounded-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Briefcase size={18} className="text-slate-700" />
                <p className="text-xs font-medium uppercase tracking-widest text-slate-400">
                  Nithish's Job Search
                </p>
              </div>
              <button
                onClick={handleCycleStatus}
                className="flex items-center gap-1 group"
              >
                <Badge
                  color={
                    EMPLOYMENT_STATUS_DISPLAY[employmentStatus].badgeColor
                  }
                >
                  {EMPLOYMENT_STATUS_DISPLAY[employmentStatus].label}
                </Badge>
                <ChevronRight
                  size={14}
                  className="text-slate-400 group-hover:text-indigo-500"
                />
              </button>
            </div>

            {/* When NOT employed: impact calculator preview */}
            {!isEmployed && (
              <>
                {inputSalary > 0 && (
                  <div
                    className={`rounded-xl p-3 mb-4 ${
                      isSurplus
                        ? 'bg-green-50 border border-green-200'
                        : 'bg-blue-50 border border-blue-200'
                    }`}
                  >
                    <p className="text-xs font-medium text-slate-600 mb-1">
                      At {formatCurrency(inputSalary)}/month:
                    </p>
                    {isSurplus ? (
                      <p className="text-sm font-bold text-emerald-700">
                        🎉 Family reaches surplus of{' '}
                        {formatCurrency(Math.abs(newDeficit))}/month
                      </p>
                    ) : (
                      <p className="text-sm font-bold text-blue-700">
                        Deficit reduces from {formatCurrency(BASELINE_DEFICIT)}{' '}
                        to {formatCurrency(newDeficit)}/month
                      </p>
                    )}
                  </div>
                )}
                <div>
                  <p className="text-xs text-slate-500 mb-1.5">
                    Estimate salary to see impact:
                  </p>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                      ₹
                    </span>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={salaryInput}
                      onChange={(e) => setSalaryInput(e.target.value)}
                      placeholder="e.g. 30000"
                      className="w-full rounded-lg border border-slate-200 pl-7 pr-3 py-2 text-sm
                                 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </>
            )}

            {/* When EMPLOYED: show salary + confirmed impact */}
            {isEmployed && (
              <>
                <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 mb-4">
                  <p className="text-xs font-medium uppercase tracking-widest text-slate-400 mb-1">Monthly salary</p>
                  <p className="text-3xl font-bold tracking-tight text-white">
                    {formatCurrency(nithishSalary)}
                  </p>
                  {newDeficit <= 0 ? (
                    <p className="text-xs font-semibold text-emerald-600 mt-1">
                      🎉 Family surplus:{' '}
                      {formatCurrency(Math.abs(newDeficit))}/month
                    </p>
                  ) : (
                    <p className="text-xs text-emerald-600 mt-1">
                      Deficit reduced to {formatCurrency(newDeficit)}/month
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                      ₹
                    </span>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={salaryInput}
                      onChange={(e) => setSalaryInput(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 pl-7 pr-3 py-2 text-sm
                                 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <Button
                    variant="primary"
                    size="md"
                    loading={salarySaving}
                    onClick={handleSaveSalary}
                  >
                    Save
                  </Button>
                </div>
              </>
            )}

            <p className="text-xs text-slate-500 mt-3 text-center">
              Tap the status badge to update as your search progresses →
            </p>
          </div>

          {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          {/* SECTION 2 — WEEKLY PROGRESS CARD                            */}
          {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          <Card className="mb-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Target size={16} className="text-indigo-600" />
                <p className="text-xs font-medium uppercase tracking-widest text-slate-400">This Week</p>
              </div>
              {streak > 0 && (
                <div className="flex items-center gap-1">
                  <span className="text-base">🔥</span>
                  <p className="text-xs font-medium text-emerald-700">
                    {streak} week{streak > 1 ? 's' : ''} on target
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-end justify-between mb-2">
              <div>
                <p className="text-3xl font-bold tracking-tight text-slate-900">{thisWeek}</p>
                <p className="text-xs font-medium uppercase tracking-widest text-slate-400">applications</p>
              </div>
              <div className="text-right">
                <Badge color={weekBadgeColor}>
                  {thisWeek >= WEEKLY_TARGET
                    ? '✓ On target'
                    : `${WEEKLY_TARGET - thisWeek} to go`}
                </Badge>
                <p className="text-xs text-slate-400 mt-1">
                  Target: {WEEKLY_TARGET}/week
                </p>
              </div>
            </div>

            <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${weekBar}`}
                style={{ width: `${weekPct}%` }}
              />
            </div>

            <p className="text-xs text-slate-400 mt-2">
              {Math.round(WEEKLY_TARGET / 5)} per day to hit weekly target
            </p>
          </Card>

          {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          {/* SECTION 3 — ADD APPLICATION FORM                            */}
          {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          {addFormJSX}
          
          {/* Close left column, open right column */}
          </div>
          <div className="lg:col-span-3">

          {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          {/* SECTION 4 — TOTALS 2×2 GRID                                 */}
          {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <Card className="text-center py-3">
              <p className="text-3xl font-bold tracking-tight text-slate-900">{totalApps}</p>
              <p className="text-xs font-medium uppercase tracking-widest text-slate-400 mt-0.5">Total sent</p>
            </Card>
            <Card className="text-center py-3">
              <p className="text-3xl font-bold tracking-tight text-indigo-700">
                {interviewCount}
              </p>
              <p className="text-xs font-medium uppercase tracking-widest text-slate-400 mt-0.5">Interviews</p>
            </Card>
            <Card className="text-center py-3">
              <p className="text-3xl font-bold tracking-tight text-emerald-700">{offerCount}</p>
              <p className="text-xs font-medium uppercase tracking-widest text-slate-400 mt-0.5">Offers</p>
            </Card>
            <Card className="text-center py-3">
              <p className="text-3xl font-bold tracking-tight text-blue-700">{responseRate}%</p>
              <p className="text-xs font-medium uppercase tracking-widest text-slate-400 mt-0.5">Response rate</p>
            </Card>
          </div>

          {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          {/* SECTION 5 — WEEKLY BAR CHART                                */}
          {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          <Card className="mb-4">
            <p className="text-xs font-medium uppercase tracking-widest text-slate-400 mb-1">
              Applications per week
            </p>
            <p className="text-xs text-slate-400 mb-3">Last 8 weeks</p>
            {applications.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">
                No applications yet — log your first one above
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={160}>
                <BarChart
                  data={weeklyData}
                  margin={{ top: 4, right: 4, left: -24, bottom: 4 }}
                >
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 9 }}
                    interval={0}
                    angle={-30}
                    textAnchor="end"
                    height={36}
                  />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip formatter={(v) => [v, 'Applications']} />
                  <Bar dataKey="count" fill="#4F46E5" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>

          {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          {/* SECTION 6 — APPLICATION LIST (grouped)                      */}
          {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}

          {/* Group 1 — Active */}
          <div className="flex items-center justify-between mb-2 mt-5">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">
              Active ({activeApps.length})
            </p>
          </div>

          {activeApps.length === 0 ? (
            <div className="text-center py-8">
              <Briefcase size={28} className="text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-400 font-medium">
                No applications yet
              </p>
              <p className="text-xs text-slate-300 mt-1">
                Use the form above to log your first application
              </p>
            </div>
          ) : (
            activeApps.map((app) => renderApplicationCard(app))
          )}

          {/* Group 2 — Interviewed */}
          {interviewedApps.length > 0 && (
            <>
              <div className="flex items-center justify-between mb-2 mt-5">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                  Interviewed ({interviewedApps.length})
                </p>
              </div>
              {interviewedApps.map((app) => renderApplicationCard(app))}
            </>
          )}

          {/* Group 3 — Offered / Accepted */}
          {offeredApps.length > 0 && (
            <>
              <div className="flex items-center justify-between mb-2 mt-5">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                  Offers ({offeredApps.length})
                </p>
              </div>
              {offeredApps.map((app) => renderApplicationCard(app))}
            </>
          )}

          {/* Group 4 — Rejected (collapsible) */}
          <button
            onClick={() => setShowRejected((p) => !p)}
            className="w-full flex items-center justify-between py-2.5 px-3
                       rounded-xl bg-slate-100 hover:bg-slate-200 transition-colors
                       mt-5 mb-2"
          >
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">
              Rejected ({rejectedApps.length})
            </p>
            {showRejected ? (
              <ChevronDown size={14} />
            ) : (
              <ChevronRight size={14} />
            )}
          </button>
          {showRejected &&
            rejectedApps.map((app) => (
              <div key={app.id} className="opacity-50">
                {renderApplicationCard(app)}
              </div>
            ))}

          {/* Close right column and grid wrapper */}
          </div>
          </div>

          {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          {/* SECTION 7 — MOTIVATION CARD (non-dismissible)               */}
          {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-start gap-3">
              <TrendingUp
                size={20}
                className="text-amber-600 flex-shrink-0 mt-0.5"
              />
              <div>
                <p className="text-sm font-bold text-amber-800 mb-2">
                  Why this matters most
                </p>
                <p className="text-sm text-amber-700 leading-relaxed">
                  A ₹30,000 job reduces this family's monthly deficit from{' '}
                  {formatCurrency(BASELINE_DEFICIT)} to{' '}
                  {formatCurrency(BASELINE_DEFICIT - 30000)}/month. That is
                  worth more than any investment optimisation.
                </p>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div className="bg-amber-100 rounded-lg py-2">
                    <p className="text-lg font-bold text-amber-800">5</p>
                    <p className="text-xs text-amber-600">per day</p>
                  </div>
                  <div className="bg-amber-100 rounded-lg py-2">
                    <p className="text-lg font-bold text-amber-800">25</p>
                    <p className="text-xs text-amber-600">per week</p>
                  </div>
                  <div className="bg-amber-100 rounded-lg py-2">
                    <p className="text-xs font-bold text-amber-800 leading-tight">
                      No exceptions.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Bottom padding */}
      <div className="h-8" />
    </>
  )
}
