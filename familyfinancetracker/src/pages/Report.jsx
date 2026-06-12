import { useState, useEffect, useMemo, useRef } from 'react'
import useStore from '../store/useStore'
import { useReport } from '../hooks/useReport'
import { api } from '../utils/api'
import { formatCurrency, formatDate } from '../utils/formatters'
import { EXPENSE_CATEGORIES } from '../data/seedData'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import {
  Sparkles,
  ClipboardCopy,
  Save,
  CheckCircle,
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  Lock,
  Briefcase,
  Calendar,
} from 'lucide-react'

export default function Report() {
  // ── Month selector ─────────────────────────────────────────────────────────
  const now = new Date()
  const [selectedMonth, setSelectedMonth] = useState(
    () =>
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  )

  // ── Report data ────────────────────────────────────────────────────────────
  const [reportJson, setReportJson] = useState(null)

  // ── AI insights ────────────────────────────────────────────────────────────
  const [insights, setInsights] = useState(null)
  const [insightsLoading, setInsightsLoading] = useState(false)
  const [insightsError, setInsightsError] = useState(false)

  // ── Save ───────────────────────────────────────────────────────────────────
  const [saveLoading, setSaveLoading] = useState(false)

  // ── Copy ───────────────────────────────────────────────────────────────────
  const [copied, setCopied] = useState(false)
  const copyTimer = useRef(null)

  // ── Toast ──────────────────────────────────────────────────────────────────
  const [toast, setToast] = useState(null)

  // ── Store + hook ───────────────────────────────────────────────────────────
  const state = useStore()
  const { generateReportForMonth, saveMonthlySnapshot } = useReport()

  // ── Month options (current + 6 prior) ─────────────────────────────────────
  const monthOptions = useMemo(() => {
    const opts = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const label = d.toLocaleDateString('en-IN', {
        month: 'long',
        year: 'numeric',
      })
      opts.push({ val, label })
    }
    return opts
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const monthLabel =
    monthOptions.find((o) => o.val === selectedMonth)?.label ?? selectedMonth

  // ── Report generation ──────────────────────────────────────────────────────
  useEffect(() => {
    const [yr, mo] = selectedMonth.split('-').map(Number)
    const report = generateReportForMonth(yr, mo)
    setReportJson(report)
    setInsights(null)
    setInsightsError(false)
  }, [
    selectedMonth,
    state.expenses.length,
    state.monthlyIncome?.nithish,
    state.milestones,
    state.jobApplications.length,
  ])

  // ── Toast helper ───────────────────────────────────────────────────────────
  const showToast = (message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 2500)
  }

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleGetInsights = async () => {
    if (!reportJson) return
    setInsightsLoading(true)
    setInsightsError(false)
    const result = await api.ai.getMonthlyInsights(reportJson)
    if (result?.insights && Array.isArray(result.insights)) {
      setInsights(result.insights)
    } else {
      setInsightsError(true)
    }
    setInsightsLoading(false)
  }

  const handleCopyForClaude = async () => {
    if (!reportJson) return
    const prompt = `Here is my family's monthly financial report for ${monthLabel}. Please analyse it against our 90-day roadmap and identify: (1) what is on track, (2) what is behind schedule, (3) what needs urgent attention this week, and (4) the top 3 priorities for the next 30 days.`
    const copyText = prompt + '\n\n' + JSON.stringify(reportJson, null, 2)
    try {
      await navigator.clipboard.writeText(copyText)
      setCopied(true)
      clearTimeout(copyTimer.current)
      copyTimer.current = setTimeout(() => setCopied(false), 2000)
    } catch {
      showToast(
        'Could not copy — try HTTPS or use a modern browser',
        'error'
      )
    }
  }

  const handleSaveSnapshot = async () => {
    if (!reportJson) return
    setSaveLoading(true)
    const [yr, mo] = selectedMonth.split('-').map(Number)
    const { apiSuccess } = await saveMonthlySnapshot(yr, mo, reportJson)
    setSaveLoading(false)
    if (apiSuccess) {
      showToast(`Snapshot saved for ${monthLabel} ✓`, 'success')
    } else {
      showToast('Saved locally — will sync when online', 'success')
    }
  }

  // ── Derived display values ─────────────────────────────────────────────────
  const cf = reportJson?.cash_flow
  const netPos = cf?.net_position ?? 0
  const netColor = netPos >= 0 ? 'text-emerald-700' : 'text-red-700'
  const netBg = netPos >= 0
    ? 'bg-emerald-50 border-emerald-200'
    : 'bg-red-50 border-red-200'

  const corp = reportJson?.corpus
  const efColor = corp?.emergency_fund?.is_intact
    ? 'text-emerald-600'
    : 'text-red-600'

  const expByCat = reportJson?.cash_flow?.expenses_by_category ?? {}
  const catEntries = Object.entries(EXPENSE_CATEGORIES)
  const overCategories = catEntries.filter(([key]) => {
    const spent = expByCat[key] ?? 0
    const limit = state.budgets?.[key] ?? 0
    return limit > 0 && spent > limit
  })
  const withinCount = catEntries.length - overCategories.length
  const worstOffender = catEntries
    .map(([key, cat]) => ({
      key,
      label: cat.label,
      overage: (expByCat[key] ?? 0) - (state.budgets?.[key] ?? 0),
    }))
    .filter((d) => d.overage > 0)
    .sort((a, b) => b.overage - a.overage)[0]

  const ms = reportJson?.milestones
  const doneCount = ms?.completed_this_month?.length ?? 0
  const overdueCount = ms?.overdue?.length ?? 0
  const upcoming30 = ms?.upcoming_30_days?.length ?? 0

  const emp = reportJson?.employment
  const alerts = reportJson?.alerts ?? []

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

      {/* ── Month selector (Hero) ── */}
      <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 -mx-4 px-4 pt-4 pb-6 mb-5">
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-3xl font-bold tracking-tight text-white">Monthly Report</p>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mt-0.5">{monthLabel}</p>
          </div>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="border border-slate-700 rounded-xl px-3 py-2 text-sm
                       text-slate-200 focus:outline-none focus:ring-2
                       focus:ring-indigo-500 bg-slate-800"
          >
            {monthOptions.map((o) => (
              <option key={o.val} value={o.val}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {reportJson && (
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-white/15 backdrop-blur-md border border-white/25 rounded-xl p-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-1">Income</p>
              <p className="text-xl font-bold tracking-tight text-emerald-400">
                {formatCurrency(cf?.income?.total ?? 0, true)}
              </p>
            </div>
            <div className="bg-white/15 backdrop-blur-md border border-white/25 rounded-xl p-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-1">Expenses</p>
              <p className="text-xl font-bold tracking-tight text-red-400">
                {formatCurrency(
                  cf?.expenses_by_category?.total ?? 0,
                  true
                )}
              </p>
            </div>
            <div className="bg-white/15 backdrop-blur-md border border-white/25 rounded-xl p-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-1">Net Flow</p>
              <p className="text-xl font-bold tracking-tight text-white">
                {netPos >= 0 ? '+' : '−'}
                {formatCurrency(Math.abs(netPos), true)}
              </p>
            </div>
          </div>
          
          <div className="mt-4 pt-4 border-t border-slate-700 flex items-center justify-between">
            <p className="text-xs text-slate-400">vs ₹85,800 budget</p>
            <p
              className={`text-xs font-semibold ${
                (cf?.variance_from_budget ?? 0) >= 0
                  ? 'text-emerald-400'
                  : 'text-red-400'
              }`}
            >
              {(cf?.variance_from_budget ?? 0) >= 0
                ? `${formatCurrency(cf.variance_from_budget, true)} under`
                : `${formatCurrency(
                    Math.abs(cf?.variance_from_budget ?? 0),
                    true
                  )} over`}
            </p>
          </div>
        )}
      </div>

      {/* ── Loading skeletons ── */}
      {!reportJson ? (
        <>
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-28 bg-slate-100 rounded-2xl animate-pulse mb-3"
            />
          ))}
        </>
      ) : (
        <>
          {/* Desktop 2-column layout */}
          <div className="lg:grid lg:grid-cols-3 lg:gap-6">
            <div className="lg:col-span-2">

          {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          {/* SECTION 2 — CORPUS CARD                                     */}
          {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          <Card className="mb-3">
            <div className="flex items-center gap-2 mb-3">
              <p className="text-xs font-medium uppercase tracking-widest text-slate-400">Corpus</p>
            </div>
            <p className="text-3xl font-bold tracking-tight text-slate-900 mb-3">
              {formatCurrency(corp?.total_corpus ?? 0, true)}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-xs text-slate-400">Fixed Deposits</p>
                <p className="text-sm font-medium text-slate-700">
                  {formatCurrency(
                    (corp?.fixed_deposits ?? []).reduce(
                      (s, fd) => s + fd.principal,
                      0
                    ),
                    true
                  )}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Mutual Funds</p>
                <p className="text-sm font-medium text-slate-700">
                  {formatCurrency(
                    (corp?.mutual_funds ?? []).reduce(
                      (s, mf) => s + mf.current_value,
                      0
                    ),
                    true
                  )}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Gold</p>
                <p className="text-sm font-medium text-slate-700">
                  {formatCurrency(corp?.gold_value ?? 0, true)}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Emergency Fund</p>
                <div className="flex items-center gap-1">
                  <Lock size={11} className={efColor} />
                  <p className={`text-sm font-medium ${efColor}`}>
                    {corp?.emergency_fund?.is_intact
                      ? 'Intact'
                      : 'Needs action'}
                  </p>
                </div>
              </div>
            </div>
          </Card>

          {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          {/* SECTION 3 — BUDGET COMPLIANCE CARD                         */}
          {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          <Card className="mb-3">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-medium uppercase tracking-widest text-slate-400">
                Budget Compliance
              </p>
              <Badge color={overCategories.length === 0 ? 'green' : 'red'}>
                {overCategories.length === 0
                  ? 'All within budget'
                  : `${overCategories.length} over`}
              </Badge>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-center flex-1">
                <p className="text-3xl font-bold tracking-tight text-emerald-700">
                  {withinCount}
                </p>
                <p className="text-xs font-medium uppercase tracking-widest text-slate-400 mt-1">within limit</p>
              </div>
              <div className="text-center flex-1">
                <p className="text-3xl font-bold tracking-tight text-red-600">
                  {overCategories.length}
                </p>
                <p className="text-xs font-medium uppercase tracking-widest text-slate-400 mt-1">over budget</p>
              </div>
            </div>
            {worstOffender && (
              <div className="mt-3 bg-red-50 rounded-lg px-3 py-2">
                <p className="text-xs text-slate-500">Worst offender</p>
                <p className="text-sm font-semibold text-red-700">
                  {worstOffender.label} — over by{' '}
                  {formatCurrency(worstOffender.overage, true)}
                </p>
              </div>
            )}
          </Card>

          {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          {/* SECTION 4 — MILESTONES CARD                                 */}
          {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          <Card className="mb-3">
            <div className="flex items-center gap-2 mb-3">
              <Calendar size={15} className="text-indigo-600" />
              <p className="text-xs font-medium uppercase tracking-widest text-slate-400">
                Milestones
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-3xl font-bold tracking-tight text-emerald-700">
                  {doneCount}
                </p>
                <p className="text-xs font-medium uppercase tracking-widest text-slate-400 mt-1">done</p>
              </div>
              <div>
                <p
                  className={`text-3xl font-bold tracking-tight ${
                    overdueCount > 0 ? 'text-red-600' : 'text-slate-400'
                  }`}
                >
                  {overdueCount}
                </p>
                <p className="text-xs font-medium uppercase tracking-widest text-slate-400 mt-1">overdue</p>
              </div>
              <div>
                <p className="text-3xl font-bold tracking-tight text-amber-600">
                  {upcoming30}
                </p>
                <p className="text-xs font-medium uppercase tracking-widest text-slate-400 mt-1">due in 30d</p>
              </div>
            </div>
            {(ms?.overdue?.length ?? 0) > 0 && (
              <div className="mt-3 space-y-1">
                {ms.overdue.slice(0, 2).map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center gap-2 text-xs text-red-600"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                    <p className="truncate flex-1">{m.title}</p>
                    <p className="flex-shrink-0">{m.days_overdue}d late</p>
                  </div>
                ))}
                {ms.overdue.length > 2 && (
                  <p className="text-xs text-slate-400">
                    +{ms.overdue.length - 2} more overdue
                  </p>
                )}
              </div>
            )}
          </Card>

          {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          {/* SECTION 5 — EMPLOYMENT CARD                                 */}
          {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          <Card className="mb-3">
            <div className="flex items-center gap-2 mb-3">
              <Briefcase size={15} className="text-indigo-600" />
              <p className="text-xs font-medium uppercase tracking-widest text-slate-400">
                Employment
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-widest text-slate-400 mb-1">Status</p>
                <Badge
                  color={
                    emp?.nithish_status?.startsWith('employed')
                      ? 'green'
                      : 'amber'
                  }
                >
                  {emp?.nithish_status?.startsWith('employed')
                    ? 'Employed'
                    : 'Searching'}
                </Badge>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-widest text-slate-400 mb-1">This month</p>
                <p className="text-base font-semibold text-slate-700">
                  {emp?.applications_this_month ?? 0} applications
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-widest text-slate-400 mb-1">Interviews</p>
                <p className="text-base font-semibold text-slate-700">
                  {emp?.interviews_total ?? 0}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-widest text-slate-400 mb-1">Offers</p>
                <p className="text-base font-semibold text-slate-700">
                  {emp?.offers_total ?? 0}
                </p>
              </div>
            </div>
          </Card>

          {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          {/* SECTION 6 — ALERTS                                          */}
          {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          {alerts.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
                Alerts
              </p>
              <div className="space-y-2">
                {alerts.map((alert, i) => {
                  const isRed = alert.startsWith('🔴')
                  const isOrange = alert.startsWith('🟠')
                  return (
                    <div
                      key={i}
                      className={`rounded-xl border px-3 py-2.5 text-xs font-medium
                        ${
                          isRed
                            ? 'bg-red-50 border-red-200 text-red-700'
                            : isOrange
                            ? 'bg-orange-50 border-orange-200 text-orange-700'
                            : 'bg-yellow-50 border-yellow-200 text-yellow-700'
                        }`}
                    >
                      {alert}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          {/* SECTION 7 — AI INSIGHTS                                     */}
          {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          <Card className="mb-4">
            {/* Button state */}
            {!insights && !insightsLoading && !insightsError && (
              <Button
                variant="secondary"
                size="md"
                className="w-full"
                onClick={handleGetInsights}
                disabled={!reportJson}
              >
                <Sparkles size={15} className="mr-2 text-indigo-600" />
                Get AI Insights
              </Button>
            )}

            {/* Loading state */}
            {insightsLoading && (
              <div className="flex items-center justify-center gap-2 py-4">
                <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-slate-500">
                  Getting insights from Gemini AI...
                </p>
              </div>
            )}

            {/* Offline / error state */}
            {insightsError && !insightsLoading && (
              <div className="text-center py-4">
                <p className="text-sm text-slate-500">
                  AI insights require internet connection.
                </p>
                <button
                  onClick={() => setInsightsError(false)}
                  className="text-xs text-indigo-600 underline mt-1"
                >
                  Try again
                </button>
              </div>
            )}

            {/* Results */}
            {insights && !insightsLoading && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles size={15} className="text-indigo-600" />
                  <p className="text-xs font-medium uppercase tracking-widest text-slate-400">
                    AI Insights
                  </p>
                </div>
                <div className="space-y-3">
                  {insights.map((insight, i) => (
                    <div key={i} className="flex gap-2 bg-slate-50 border border-slate-100 rounded-xl p-3">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 text-xs flex items-center justify-center font-bold mt-0.5">
                        {i + 1}
                      </span>
                      <p className="text-sm text-slate-700 leading-relaxed">
                        {insight}
                      </p>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-slate-400 mt-2 text-center">
                  Generated by Gemini AI — for context only, not financial
                  advice
                </p>
                <button
                  onClick={() => setInsights(null)}
                  className="text-xs text-slate-400 underline mt-1 block mx-auto"
                >
                  Clear insights
                </button>
              </div>
            )}
          </Card>

          {/* Close left column, open right column for action buttons */}
          </div>
          <div className="lg:col-span-1 lg:sticky lg:top-4">

          {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          {/* SECTION 8 — COPY FOR CLAUDE (most prominent element)        */}
          {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          <button
            onClick={handleCopyForClaude}
            disabled={!reportJson}
            className={`w-full h-14 rounded-2xl font-semibold text-base flex items-center
                        justify-center gap-2 transition-all mb-3 shadow-md
                        ${
                          copied
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-900 text-white hover:bg-slate-800 active:scale-[0.98]'
                        }
                        disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {copied ? (
              <>
                <CheckCircle size={18} />
                Copied! Paste into Claude for analysis.
              </>
            ) : (
              <>
                <ClipboardCopy size={18} />
                Copy for Claude Analysis
              </>
            )}
          </button>

          {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          {/* SECTION 9 — SAVE SNAPSHOT BUTTON                            */}
          {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          <Button
            variant="secondary"
            size="md"
            className="w-full mb-4"
            loading={saveLoading}
            onClick={handleSaveSnapshot}
            disabled={!reportJson}
          >
            <Save size={14} className="mr-1.5" />
            Save Snapshot for {monthLabel}
          </Button>

          {/* Close right column and grid wrapper */}
          </div>
          </div>
        </>
      )}

      {/* Bottom padding */}
      <div className="h-8 lg:h-4" />
    </>
  )
}
