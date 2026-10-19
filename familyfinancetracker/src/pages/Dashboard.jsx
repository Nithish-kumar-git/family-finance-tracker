import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import useStore from '../store/useStore'
import { api } from '../utils/api'
import { getChatErrorMessage } from '../utils/ammaChat'
import {
  formatCurrency, formatDeficit, formatDate, daysUntil,
  getGreeting, formatMonth,
} from '../utils/formatters'
import {
  getTotalCorpus, getFDTotal, getMFTotal, getGoldTotal,
  getMonthlyIncome, getMonthlyExpensesTotal, getMonthlyDeficit,
} from '../utils/calculations'
import {
  MessageCircle, X, Send, Sparkles, Plus, Lock,
  Briefcase, AlertCircle,
} from 'lucide-react'
import {
  ShoppingCart, Zap, Heart, Car, Home, Shield,
  Users, User, BookOpen, MoreHorizontal,
} from 'lucide-react'
import Badge from '../components/ui/Badge'
import SparkLine from '../components/charts/SparkLine'
import { EXPENSE_CATEGORIES } from '../data/seedData'

const iconMap = {
  ShoppingCart, Zap, Heart, Car, Home, Shield,
  Users, User, BookOpen, MoreHorizontal,
}

const SUGGESTIONS = [
  'How much did we spend on groceries this month?',
  'When is the next LIC premium due?',
  'What happens if household income increases?',
]

export default function Dashboard() {
  const navigate = useNavigate()
  const state = useStore()
  const { currentUser, users, monthlySnapshots, emergencyFund, monthlyIncome } = state

  const user = users.find(u => u.id === currentUser)
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1

  // ── Data loading state ───────────────────────────────────────────────
  const [milestones, setMilestones] = useState([])
  const [employmentStats, setEmploymentStats] = useState(null)
  const [loading, setLoading] = useState(true)

  // ── Chat state (never persisted) ──────────────────────────────────────
  const [chatOpen, setChatOpen] = useState(false)
  const [chatHistory, setChatHistory] = useState([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [chatError, setChatError] = useState(null)
  const [chatRetryable, setChatRetryable] = useState(false)
  const chatRequestRef = useRef(null)
  const retryAttemptRef = useRef(null)
  const messagesEndRef = useRef(null)

  useEffect(() => () => {
    const pending = chatRequestRef.current
    chatRequestRef.current = null
    pending?.abort()
  }, [])

  // ── Derive expenses from Zustand store reactively ─────────────────────
  const allExpenses = useStore(state => state.expenses)
  const prefix = `${year}-${String(month).padStart(2, '0')}`
  const currentMonthExpenses = allExpenses.filter(e => e.date.startsWith(prefix))

  // Compute category totals from current month expenses
  const categoryTotals = {}
  Object.keys(EXPENSE_CATEGORIES).forEach(k => { categoryTotals[k] = 0 })
  currentMonthExpenses.forEach(e => {
    if (categoryTotals[e.category] !== undefined) {
      categoryTotals[e.category] += e.amount
    } else {
      categoryTotals.other = (categoryTotals.other ?? 0) + e.amount
    }
  })

  // ── Load milestones and employment stats on mount ─────────────────────
  useEffect(() => {
    async function loadDashboard() {
      const results = await Promise.allSettled([
        api.milestones.getAll({ status: 'pending', upcoming_days: 90 }),
        api.employment.getStats(),
        api.expenses.getByMonth(year, month),
      ])

      if (results[0].status === 'fulfilled') {
        setMilestones(results[0].value ?? [])
      }

      if (results[1].status === 'fulfilled') {
        setEmploymentStats(results[1].value ?? null)
      }

      // Load current month expenses from API into store
      if (results[2].status === 'fulfilled') {
        const data = results[2].value
        if (data && Array.isArray(data.expenses)) {
          const apiExpenses = data.expenses
          const ym = `${year}-${String(month).padStart(2, '0')}`
          try { useStore.getState().setExpensesForMonth(ym, apiExpenses) }
          catch { /* Readable records remain available if storage is full. */ }
        }
      }

      setLoading(false)
    }
    loadDashboard()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Scroll chat to bottom ─────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatHistory, chatLoading, chatError])

  // ── Computed values ───────────────────────────────────────────────────
  const income = getMonthlyIncome(state)
  const totalExpenses = currentMonthExpenses.reduce((sum, e) => sum + e.amount, 0)
  const netPosition = income - totalExpenses
  const totalCorpus = getTotalCorpus(state)
  const fdTotal = getFDTotal(state)
  const mfTotal = getMFTotal(state)
  const goldTotal = getGoldTotal(state)
  const savingsBalance = state.emergencyFund?.cashInBank ?? 0
  // getTotalCorpus already includes cashInBank and liquidFundBalance.
  const totalCorpusWithSavings = totalCorpus
  const efBalance = emergencyFund.liquidFundBalance + emergencyFund.cashInBank
  const efTarget = emergencyFund.target
  const efPct = efTarget > 0 ? Math.min((efBalance / efTarget) * 100, 100) : 0
  const efIntact = emergencyFund.isIsolated && efBalance >= efTarget

  const nithishSalary = monthlyIncome.nithish
  const isEmployed = nithishSalary > 0
  const newDeficit = totalExpenses - income
  const thisWeek = employmentStats?.this_week ?? 0
  const totalApps = employmentStats?.total ?? 0
  const weekTarget = 25
  const weekPct = Math.min((thisWeek / weekTarget) * 100, 100)

  const upcomingMilestones = [...(milestones.length ? milestones : state.milestones.filter(m => m.status === 'pending'))]
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, 3)

  const sparkData = [...monthlySnapshots]
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-3)
    .map(s => ({ label: formatMonth(s.month + '-01'), value: s.corpusTotal }))

  // ── AI context builder ────────────────────────────────────────────────
  const buildContext = () => {
    const yr = now.getFullYear()
    const mo = now.getMonth() + 1
    const inc = getMonthlyIncome(state)
    const spent = getMonthlyExpensesTotal(state, yr, mo)
    const efBal = state.emergencyFund.liquidFundBalance + state.emergencyFund.cashInBank
    const upcoming = [...state.milestones]
      .filter(m => m.status === 'pending')
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(0, 5)
      .map(m => ({ title: m.title, date: m.date, amount: m.amount }))

    return {
      monthly_income: inc,
      total_expenses_this_month: spent,
      deficit: inc - spent,
      emergency_fund_balance: efBal,
      emergency_fund_target: state.emergencyFund.target,
      upcoming_milestones: upcoming,
      total_corpus: getTotalCorpus(state),
      nithish_employment_status: state.monthlyIncome.nithish > 0
        ? `Employed at ₹${state.monthlyIncome.nithish}/month`
        : 'Unemployed — job hunting',
      current_month_year: now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
    }
  }

  // ── Send chat message ─────────────────────────────────────────────────
  const sendChatAttempt = async (attempt) => {
    if (chatRequestRef.current) return
    const request = new AbortController()
    chatRequestRef.current = request
    setChatError(null)
    setChatRetryable(false)
    setChatLoading(true)
    try {
      const result = await api.ai.chat(attempt.question, attempt.context, attempt.history, {
        signal: request.signal,
      })
      if (chatRequestRef.current !== request) return
      setChatHistory(prev => [...prev, { role: 'ai', content: result.answer }])
      retryAttemptRef.current = null
    } catch (error) {
      if (chatRequestRef.current === request) {
        setChatError(getChatErrorMessage(error))
        setChatRetryable(error?.retryable === true)
      }
    } finally {
      if (chatRequestRef.current === request) {
        chatRequestRef.current = null
        setChatLoading(false)
      }
    }
  }

  const handleSend = async (text) => {
    const question = (text ?? chatInput).trim()
    if (!question || chatRequestRef.current) return

    const trimmed = chatHistory.length >= 10
      ? chatHistory.slice(chatHistory.length - 9)
      : chatHistory

    const newHistory = [...trimmed, { role: 'user', content: question }]
    setChatHistory(newHistory)
    setChatInput('')

    const apiHistory = trimmed.slice(-6).map(h => ({
      role: h.role === 'user' ? 'user' : 'model',
      content: h.content,
    }))

    const attempt = { question, context: buildContext(), history: apiHistory }
    retryAttemptRef.current = attempt
    await sendChatAttempt(attempt)
  }

  const handleChatRetry = () => {
    if (retryAttemptRef.current) return sendChatAttempt(retryAttemptRef.current)
  }

  // ── Loading skeleton ──────────────────────────────────────────────────
  if (loading) {
    return (
      <>
        <div className="h-28 bg-canvas rounded-lg animate-pulse mb-5" />
        <div className="h-48 bg-canvas rounded-lg animate-pulse mb-5" />
        <div className="h-20 bg-canvas rounded-lg animate-pulse" />
      </>
    )
  }

  if (state.storageReadError) return <div role="alert" className="surface"><h2>Existing browser data could not be safely opened</h2><p className="text-muted my-3">The original storage has not been overwritten. Balances are unavailable.</p><button className="action" onClick={() => navigate('/settings')}>Open recovery</button></div>

  // ── Main render ───────────────────────────────────────────────────────
  return (
    <>
      {/* ── Overview ─────────────────────────── */}
      <div className="surface p-6 lg:p-8 mb-5">
        {/* Greeting */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-accent mb-1">
              {getGreeting()}
            </p>
            <p className="text-3xl lg:text-4xl font-bold text-ink tracking-tight">
              {user?.name ?? 'Friend'}
            </p>
          </div>
          <p className="text-xs text-muted">
            {now.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
          </p>
        </div>

        <div className="mb-6">
          <p className="eyebrow">Net worth</p>
          <p className="text-4xl lg:text-5xl font-semibold tracking-tight text-ink">{formatCurrency(totalCorpusWithSavings)}</p>
          <p className="text-sm text-muted mt-2">Recorded assets and cash · {formatMonth(`${prefix}-01`)}</p>
        </div>

        {/* Monthly summary — 3 columns */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-surface  border border-line rounded-lg p-3 lg:p-4 text-center">
            <p className="text-xs font-medium uppercase tracking-wider text-muted mb-1.5">
              Income
            </p>
            <p className="text-base sm:text-xl font-semibold text-accent">
              {formatCurrency(income)}
            </p>
          </div>

          <div className="bg-surface  border border-line rounded-lg p-3 lg:p-4 text-center">
            <p className="text-xs font-medium uppercase tracking-wider text-muted mb-1.5">
              Spent
            </p>
            <p className="text-base sm:text-xl font-semibold text-ink">
              {formatCurrency(totalExpenses)}
            </p>
          </div>

          <div className="bg-surface  border border-line rounded-lg p-3 lg:p-4 text-center">
            <p className="text-xs font-medium uppercase tracking-wider text-muted mb-1.5">
              Saved
            </p>
            <p className={`text-base sm:text-xl font-semibold ${income - totalExpenses < 0 ? 'text-red-700' : 'text-ink'}`}>
              {formatCurrency(income - totalExpenses)}
            </p>
          </div>
        </div>
      </div>

      {/* ── Desktop 2-column grid ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* LEFT COLUMN */}
        <div className="space-y-5">
          {/* Corpus card */}
          <div className="bg-white rounded-lg border border-line  p-5">
            <h2 className="mb-5">Assets & reserves</h2>

            <div className="grid grid-cols-2 gap-3 mb-4">
              {[
                { label: 'Fixed Deposits', value: fdTotal, to: '/assets' },
                { label: 'Mutual Funds', value: mfTotal, to: '/assets' },
                { label: 'Gold', value: goldTotal, to: '/assets' },
                { label: 'Bank Savings', value: savingsBalance, to: '/settings' },
              ].map(item => (
                <button
                  key={item.label}
                  onClick={() => navigate(item.to)}
                  className="text-left bg-canvas hover:bg-canvas transition-colors rounded-lg p-3"
                >
                  <p className="text-xs font-medium text-muted mb-1 uppercase tracking-wide">
                    {item.label}
                  </p>
                  <p className="text-base font-semibold text-ink">
                    {formatCurrency(item.value, true)}
                  </p>
                  <p className="text-xs text-accent mt-0.5">Edit →</p>
                </button>
              ))}
            </div>

            {/* Emergency fund bar */}
            <div className={`rounded-lg p-3 ${
              efIntact
                ? 'bg-accent-soft border border-line'
                : 'bg-red-50 border border-red-100'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <Lock size={13} className={efIntact ? 'text-accent' : 'text-red-700'} />
                  <p className="text-xs font-medium text-ink">Emergency Fund</p>
                </div>
                <p className="text-xs text-muted">
                  {formatCurrency(efBalance, true)} / {formatCurrency(efTarget, true)}
                </p>
              </div>
              <div className="h-1.5 rounded-full bg-canvas overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    efIntact ? 'bg-accent' : 'bg-red-400'
                  }`}
                  style={{ width: `${efPct}%` }}
                />
              </div>
              {!efIntact && (
                <p className="text-xs text-red-700 mt-1.5 font-medium">
                  {emergencyFund.isIsolated ? ' Below emergency-fund target' : ' Not yet isolated'}
                </p>
              )}
            </div>
          </div>

          {/* Upcoming milestones */}
          <div className="bg-white rounded-lg border border-line  p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-muted mb-3">
              Upcoming
            </p>
            {upcomingMilestones.length === 0 ? (
              <p className="text-sm text-muted text-center py-4">
                All milestones up to date
              </p>
            ) : (
              <div className="space-y-2">
                {upcomingMilestones.map(m => {
                  const days = daysUntil(m.date)
                  return (
                    <div
                      key={m.id}
                      className={`flex items-center justify-between p-3 rounded-lg ${
                        m.isDangerous
                          ? 'bg-red-50 border border-red-100'
                          : 'bg-canvas'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {m.isDangerous && (
                          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
                        )}
                        <p className="text-sm font-medium text-ink truncate">
                          {m.title}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                        {m.amount != null && (
                          <p className="text-xs text-muted hidden sm:block">
                            {formatCurrency(m.amount, true)}
                          </p>
                        )}
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                          days < 0
                            ? 'bg-red-100 text-red-600'
                            : days < 14
                            ? 'bg-canvas text-ink'
                            : 'bg-canvas text-muted'
                        }`}>
                          {days < 0 ? 'Overdue' : days === 0 ? 'Today' : `${days}d`}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-5">
          {/* Budget card */}
          <div className="bg-white rounded-lg border border-line  p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-muted mb-3">
              Budget
            </p>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(EXPENSE_CATEGORIES).map(([key, cat]) => {
                const IconComponent = iconMap[cat.icon]
                const spent = categoryTotals[key] ?? 0
                const limit = state.budgets[key] ?? 0
                const pct = limit > 0 ? Math.min((spent / limit) * 100, 100) : 0
                const barColor =
                  pct < 75
                    ? 'bg-accent'
                    : pct < 100
                    ? 'bg-canvas'
                    : 'bg-red-500'
                return (
                  <div key={key} className="bg-canvas rounded-lg p-3">
                    <div className="flex items-center gap-1.5 mb-2">
                      {IconComponent && (
                        <IconComponent size={13} style={{ color: cat.color }} />
                      )}
                      <p className="text-xs font-medium text-muted truncate">
                        {cat.label.split(' ')[0]}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-ink mb-1.5">
                      {formatCurrency(spent, true)}
                    </p>
                    <div className="h-1 rounded-full bg-canvas overflow-hidden">
                      <div
                        className={`h-full rounded-full ${barColor}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted mt-1">
                      of {formatCurrency(limit, true)}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Employment card */}
          <div className="bg-white rounded-lg border border-line  p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-medium uppercase tracking-wider text-muted">
                Job Search
              </p>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                isEmployed
                  ? 'bg-accent-soft text-accent'
                  : thisWeek >= 25
                  ? 'bg-accent-soft text-accent'
                  : thisWeek >= 10
                  ? 'bg-canvas text-ink'
                  : 'bg-red-100 text-red-600'
              }`}>
                {isEmployed ? 'Employed' : 'Searching'}
              </span>
            </div>

            {!isEmployed ? (
              <>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-sm text-muted">This week</p>
                  <p className="text-sm font-semibold text-ink">
                    {thisWeek} / 25 applications
                  </p>
                </div>
                <div className="h-2 rounded-full bg-canvas overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      weekPct >= 100
                        ? 'bg-accent'
                        : weekPct >= 40
                        ? 'bg-canvas'
                        : 'bg-red-400'
                    }`}
                    style={{ width: `${weekPct}%` }}
                  />
                </div>
                <p className="text-xs text-muted mt-2">
                  {totalApps} total applications sent
                </p>
              </>
            ) : (
              <div className="bg-accent-soft rounded-lg p-3">
                <p className="text-sm font-semibold text-accent">
                  {formatCurrency(nithishSalary)}/month
                </p>
                <p className="text-xs text-accent mt-0.5">
                  {newDeficit <= 0
                    ? ` Surplus ${formatCurrency(Math.abs(newDeficit))}/month`
                    : `Deficit reduced to ${formatCurrency(newDeficit)}/month`}
                </p>
              </div>
            )}
          </div>

          {/* SparkLine — only if enough data */}
          {sparkData.length >= 2 && (
            <div className="bg-white rounded-lg border border-line  p-5">
              <p className="text-xs font-medium uppercase tracking-wider text-muted mb-3">
                Corpus Trend
              </p>
              <SparkLine data={sparkData} height={60} />
            </div>
          )}
        </div>
      </div>

      {/* ── FAB — Add Expense ─────────────────────────────────────────── */}
      <button
        onClick={() => navigate('/expenses')}
        className="fixed bottom-40 right-4 z-50 w-14 h-14 rounded-full
                   bg-accent text-white  flex items-center
                   justify-center hover:bg-accent active:scale-95
                   transition-all lg:bottom-8 lg:right-6"
        aria-label="Add expense"
      >
        <Plus size={24} />
      </button>

      {/* ── Ask Amma AI button ────────────────────────────────────────── */}
      <button
        onClick={() => setChatOpen(true)}
        className="fixed bottom-24 right-4 z-50 rounded-full bg-accent
                   text-white flex items-center justify-center
                   hover:bg-accent active:scale-95 transition-all
                   lg:bottom-8 lg:right-24"
        style={{ width: 52, height: 52 }}
        aria-label="Open local assistant"
      >
        <MessageCircle size={20} />
        {chatError && (
          <span className="absolute top-0 right-0 w-2.5 h-2.5 rounded-full bg-red-500 border-2 border-white" />
        )}
      </button>

      {/* ── Ask Amma AI drawer ────────────────────────────────────────── */}
      {chatOpen && (
        <>
          <div className="fixed inset-0 bg-black/40 z-50" onClick={() => setChatOpen(false)} />
          <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl z-50 flex flex-col" style={{ height: '80vh' }}>
            <div className="flex items-center justify-between p-4 border-b border-line flex-shrink-0">
              <div className="flex items-center gap-2">
                <Sparkles size={18} className="text-accent" />
                <p className="text-base font-semibold text-ink">Local assistant</p>
              </div>
              <button onClick={() => setChatOpen(false)} className="p-1 rounded-lg hover:bg-canvas">
                <X size={20} className="text-muted" />
              </button>
            </div>

              <>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {chatHistory.length === 0 && (
                    <div className="space-y-2">
                      <p className="text-xs text-muted text-center">Ask me anything about your finances</p>
                      {SUGGESTIONS.map((s, i) => (
                        <button
                          key={i}
                          onClick={() => handleSend(s)}
                          disabled={chatLoading}
                          className="w-full text-left text-xs bg-accent-soft border border-line text-accent rounded-lg px-3 py-2.5 hover:bg-accent-soft transition-colors"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}

                  {chatHistory.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-xs rounded-lg px-3.5 py-2.5 text-sm leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-accent text-white rounded-br-sm'
                          : 'bg-canvas text-ink rounded-bl-sm'
                      }`}>
                        {msg.content}
                      </div>
                    </div>
                  ))}

                  {chatLoading && (
                    <div className="flex justify-start" role="status" aria-label="Local assistant is replying">
                      <div className="bg-canvas rounded-lg rounded-bl-sm px-4 py-3 flex gap-1">
                        <span className="w-1.5 h-1.5 bg-surface rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-1.5 h-1.5 bg-surface rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-1.5 h-1.5 bg-surface rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  )}

                  {chatError && (
                    <div role="alert" className="rounded-lg border border-line bg-canvas p-3 text-sm text-ink">
                      <p className="flex items-start gap-2"><AlertCircle size={18} className="flex-shrink-0" aria-hidden="true" />{chatError}</p>
                      {chatRetryable && <button onClick={handleChatRetry} disabled={chatLoading} className="mt-2 rounded-lg border border-line px-3 py-2 font-medium disabled:opacity-50">
                        Retry
                      </button>}
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>

                <div className="p-4 border-t border-line flex gap-2 flex-shrink-0">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey && !chatLoading) {
                        e.preventDefault()
                        handleSend()
                      }
                    }}
                    placeholder="Ask about your finances..."
                    aria-label="Message local assistant"
                    disabled={chatLoading}
                    className="flex-1 rounded-lg border border-line px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent disabled:opacity-50"
                  />
                  <button
                    onClick={() => handleSend()}
                    disabled={chatLoading || !chatInput.trim()}
                    aria-label="Send message"
                    className="w-10 h-10 rounded-lg bg-accent text-white flex items-center justify-center hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0"
                  >
                    <Send size={16} />
                  </button>
                </div>
              </>
          </div>
        </>
      )}
    </>
  )
}
