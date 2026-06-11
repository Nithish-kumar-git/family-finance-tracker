import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import useStore from '../store/useStore'
import { api } from '../utils/api'
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
  Briefcase, ChevronRight, AlertCircle,
} from 'lucide-react'
import {
  ShoppingCart, Zap, Heart, Car, Home, Shield,
  Users, User, BookOpen, MoreHorizontal,
} from 'lucide-react'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
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
  'What happens if Nithish gets a ₹35,000 job?',
]

export default function Dashboard() {
  const navigate = useNavigate()
  const state = useStore()
  const { currentUser, users, monthlySnapshots, emergencyFund, monthlyIncome, isOffline } = state

  const user = users.find(u => u.id === currentUser)
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1

  // ── Data loading state ───────────────────────────────────────────────
  const [expenses, setExpenses] = useState([])
  const [categoryTotals, setCategoryTotals] = useState({})
  const [milestones, setMilestones] = useState([])
  const [employmentStats, setEmploymentStats] = useState(null)
  const [loading, setLoading] = useState(true)

  // ── Chat state (never persisted) ──────────────────────────────────────
  const [chatOpen, setChatOpen] = useState(false)
  const [chatHistory, setChatHistory] = useState([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const messagesEndRef = useRef(null)

  // ── Load data on mount ────────────────────────────────────────────────
  useEffect(() => {
    async function loadDashboard() {
      const results = await Promise.allSettled([
        api.expenses.getByMonth(year, month),
        api.milestones.getAll({ status: 'pending', upcoming_days: 90 }),
        api.employment.getStats(),
      ])

      // expenses result
      if (results[0].status === 'fulfilled') {
        const res = results[0].value
        if (res && res.expenses) {
          setExpenses(res.expenses)
          setCategoryTotals(res.category_totals ?? {})
        } else if (Array.isArray(res)) {
          setExpenses(res)
          // compute category totals from array
          const totals = {}
          res.forEach(e => { totals[e.category] = (totals[e.category] ?? 0) + e.amount })
          setCategoryTotals(totals)
        }
      }

      // milestones result
      if (results[1].status === 'fulfilled') {
        setMilestones(results[1].value ?? [])
      }

      // employment stats result
      if (results[2].status === 'fulfilled') {
        setEmploymentStats(results[2].value ?? null)
      }

      setLoading(false)
    }
    loadDashboard()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Scroll chat to bottom ─────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatHistory])

  // ── Computed values ───────────────────────────────────────────────────
  const income = getMonthlyIncome(state)
  const totalExpenses = getMonthlyExpensesTotal(state, year, month)
  const netPosition = getMonthlyDeficit(state, year, month)
  const totalCorpus = getTotalCorpus(state)
  const fdTotal = getFDTotal(state)
  const mfTotal = getMFTotal(state)
  const goldTotal = getGoldTotal(state)
  const savingsBalance = state.emergencyFund?.cashInBank ?? 0
  const totalCorpusWithSavings = totalCorpus + savingsBalance
  const efBalance = emergencyFund.liquidFundBalance + emergencyFund.cashInBank
  const efTarget = emergencyFund.target
  const efPct = Math.min((efBalance / efTarget) * 100, 100)
  const efIntact = emergencyFund.isIsolated && efBalance >= efTarget

  const nithishSalary = monthlyIncome.nithish
  const isEmployed = nithishSalary > 0
  const currentDeficit = 48196
  const newDeficit = currentDeficit - nithishSalary
  const thisWeek = employmentStats?.this_week ?? 0
  const totalApps = employmentStats?.total ?? 0
  const weekTarget = 25
  const weekPct = Math.min((thisWeek / weekTarget) * 100, 100)

  // Upcoming milestones — sort by date, take first 3
  const upcomingMilestones = [...(milestones.length ? milestones : state.milestones.filter(m => m.status === 'pending'))]
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, 3)

  // Net position card bg
  const netBg =
    netPosition < 0 ? 'bg-red-50 border-red-100' :
    netPosition > 0 ? 'bg-emerald-50 border-emerald-100' :
                      'bg-slate-50 border-slate-200'

  const netNumberColor = netPosition < 0 ? 'text-red-500' : 'text-emerald-600'

  // SparkLine data
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
  const handleSend = async (text) => {
    const question = (text ?? chatInput).trim()
    if (!question) return

    const trimmed = chatHistory.length >= 10
      ? chatHistory.slice(chatHistory.length - 9)
      : chatHistory

    const newHistory = [...trimmed, { role: 'user', content: question }]
    setChatHistory(newHistory)
    setChatInput('')
    setChatLoading(true)

    const apiHistory = trimmed.slice(-6).map(h => ({
      role: h.role === 'user' ? 'user' : 'model',
      content: h.content,
    }))

    const result = await api.ai.chat(question, buildContext(), apiHistory)
    const answer = result?.answer ?? "I'm unable to answer right now. Please try again in a moment."
    setChatHistory(prev => [...prev, { role: 'ai', content: answer }])
    setChatLoading(false)
  }

  // ── Loading skeleton ──────────────────────────────────────────────────
  if (loading) {
    return (
      <>
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-slate-400">{getGreeting()}</p>
            <p className="text-2xl font-bold text-slate-900">{user?.name ?? 'Friend'}</p>
          </div>
        </div>
        <div className="h-28 bg-slate-100 rounded-2xl animate-pulse mb-3" />
        <div className="h-48 bg-slate-100 rounded-2xl animate-pulse mb-3" />
        <div className="h-20 bg-slate-100 rounded-2xl animate-pulse mb-3" />
      </>
    )
  }

  // ── Main render ───────────────────────────────────────────────────────
  return (
    <>
      {/* ── Section 1: Greeting ───────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-slate-400">
            {getGreeting()}
          </p>
          <p className="text-2xl font-bold text-slate-900">{user?.name ?? 'Friend'}</p>
        </div>
        <p className="text-xs text-slate-400">
          {now.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
        </p>
      </div>

      {/* ── Section 2: Net Position card (hero) ───────────────────────── */}
      <div className={`rounded-2xl border p-4 mb-3 ${netBg}`}>
        {/* Top row */}
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-medium uppercase tracking-widest text-slate-400">
            This Month
          </p>
          <Badge color={netPosition < 0 ? 'red' : 'green'}>
            {netPosition < 0 ? 'Deficit' : 'Surplus'}
          </Badge>
        </div>

        {/* Hero number */}
        <p className={`text-4xl font-bold tracking-tight mb-4 ${netNumberColor}`}>
          {formatDeficit(netPosition)}
        </p>

        {/* Bottom 3-column breakdown */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-slate-400 mb-1">
              Income
            </p>
            <p className="text-sm font-semibold text-emerald-600">
              {formatCurrency(income, true)}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-slate-400 mb-1">
              Budget
            </p>
            <p className="text-sm font-semibold text-slate-700">
              {formatCurrency(85800, true)}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-slate-400 mb-1">
              Spent
            </p>
            <p className="text-sm font-semibold text-red-500">
              {formatCurrency(totalExpenses, true)}
            </p>
          </div>
        </div>

        <p className="text-xs text-slate-400 mt-3 text-center">
          Monthly deficit target: ₹48,196
        </p>
      </div>

      {/* ── Section 3: Corpus card ────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-100 shadow-sm bg-white p-5 mb-3">
        {/* Header */}
        <p className="text-xs font-medium uppercase tracking-widest text-slate-400">
          Total Savings
        </p>
        <p className="text-3xl font-bold tracking-tight text-slate-900 mt-1">
          {formatCurrency(totalCorpusWithSavings, true)}
        </p>

        {/* Divider */}
        <div className="border-t border-slate-100 my-3" />

        {/* 2×2 sub-values */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <button
            className="text-left rounded-xl px-2 py-2 hover:bg-slate-50 active:bg-slate-100 transition-colors"
            onClick={() => navigate('/assets')}
          >
            <p className="text-xs uppercase tracking-wide text-slate-400">Fixed Deposits</p>
            <p className="text-base font-semibold text-slate-700 mt-0.5">
              {formatCurrency(fdTotal, true)}
            </p>
            <p className="text-xs text-violet-500 mt-0.5">Edit →</p>
          </button>

          <button
            className="text-left rounded-xl px-2 py-2 hover:bg-slate-50 active:bg-slate-100 transition-colors"
            onClick={() => navigate('/assets')}
          >
            <p className="text-xs uppercase tracking-wide text-slate-400">Mutual Funds</p>
            <p className="text-base font-semibold text-slate-700 mt-0.5">
              {formatCurrency(mfTotal, true)}
            </p>
            <p className="text-xs text-violet-500 mt-0.5">Edit →</p>
          </button>

          <button
            className="text-left rounded-xl px-2 py-2 hover:bg-slate-50 active:bg-slate-100 transition-colors"
            onClick={() => navigate('/assets')}
          >
            <p className="text-xs uppercase tracking-wide text-slate-400">Gold</p>
            <p className="text-base font-semibold text-slate-700 mt-0.5">
              {formatCurrency(goldTotal, true)}
            </p>
            <p className="text-xs text-violet-500 mt-0.5">Edit →</p>
          </button>

          <button
            className="text-left rounded-xl px-2 py-2 hover:bg-slate-50 active:bg-slate-100 transition-colors"
            onClick={() => navigate('/settings')}
          >
            <p className="text-xs uppercase tracking-wide text-slate-400">Bank Savings</p>
            <p className="text-base font-semibold text-slate-700 mt-0.5">
              {formatCurrency(savingsBalance, true)}
            </p>
            <p className="text-xs text-violet-500 mt-0.5">Edit →</p>
          </button>
        </div>

        {/* Emergency fund bar */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <Lock size={13} className={efIntact ? 'text-emerald-600' : 'text-red-500'} />
              <p className="text-xs text-slate-500">Emergency Fund</p>
            </div>
            <p className="text-xs text-slate-400">
              {formatCurrency(efBalance, true)} / {formatCurrency(efTarget, true)}
            </p>
          </div>
          <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${efIntact ? 'bg-emerald-500' : 'bg-red-400'}`}
              style={{ width: `${efPct}%` }}
            />
          </div>
          {!efIntact && (
            <p className="text-xs text-red-500 mt-1.5">⚠ Not yet isolated — complete Week 3 action</p>
          )}
          {efIntact && (
            <p className="text-xs text-emerald-600 mt-1.5">✓ Isolated and intact</p>
          )}
        </div>
      </div>

      {/* ── Section 4: Upcoming milestones ───────────────────────────── */}
      <div className="mb-3">
        <p className="text-xs font-medium uppercase tracking-widest text-slate-400 mb-2">
          Upcoming
        </p>
        {upcomingMilestones.length === 0 ? (
          <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-3 text-center">
            <p className="text-sm text-emerald-700">All milestones up to date ✓</p>
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
            {upcomingMilestones.map(m => {
              const days = daysUntil(m.date)
              return (
                <div
                  key={m.id}
                  className={`flex-shrink-0 w-48 rounded-2xl border bg-white px-3 py-2.5 shadow-sm
                    ${m.isDangerous ? 'border-l-2 border-l-red-400 border-slate-200' : 'border-slate-200'}`}
                >
                  {m.isDangerous && (
                    <span className="inline-flex h-2 w-2 rounded-full bg-red-500 animate-pulse mb-1.5" />
                  )}
                  <p className="text-xs font-medium text-slate-700 leading-snug mb-2 line-clamp-2">
                    {m.title}
                  </p>
                  <div className="flex items-center justify-between">
                    <Badge color={days < 0 ? 'red' : days < 14 ? 'red' : days < 30 ? 'amber' : 'slate'}>
                      {days < 0 ? 'Overdue' : days === 0 ? 'Today' : `${days}d`}
                    </Badge>
                    {m.amount != null && (
                      <p className="text-xs text-slate-400">{formatCurrency(m.amount, true)}</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Section 5: Budget strip ───────────────────────────────────── */}
      <div className="mb-3">
        <p className="text-xs font-medium uppercase tracking-widest text-slate-400 mb-2">
          Budget
        </p>
        <div className="flex gap-2 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
          {Object.entries(EXPENSE_CATEGORIES).map(([key, cat]) => {
            const IconComponent = iconMap[cat.icon]
            const spent = categoryTotals[key] ?? 0
            const limit = state.budgets[key] ?? 0
            const pct = limit > 0 ? Math.min((spent / limit) * 100, 100) : 0
            const barColor = pct < 75 ? 'bg-emerald-500' : pct < 100 ? 'bg-amber-500' : 'bg-red-500'
            return (
              <div
                key={key}
                className="flex-shrink-0 w-24 rounded-xl border border-slate-200 bg-white px-2.5 py-2"
              >
                <div className="flex items-center gap-1 mb-1">
                  {IconComponent && <IconComponent size={13} style={{ color: cat.color }} />}
                  <p className="text-xs text-slate-500 truncate">{cat.label.split(' ')[0]}</p>
                </div>
                <p className="text-xs font-semibold text-slate-800">
                  {formatCurrency(spent, true)}
                </p>
                <div className="h-0.5 rounded-full bg-slate-100 mt-1.5">
                  <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Section 6: Employment card ───────────────────────────────── */}
      <Card className="mb-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Briefcase size={15} className={isEmployed ? 'text-emerald-600' : 'text-violet-600'} />
            <p className="text-xs font-medium uppercase tracking-widest text-slate-400">
              Job Search
            </p>
          </div>
          <Badge color={isEmployed ? 'green' : thisWeek >= 25 ? 'green' : thisWeek >= 10 ? 'amber' : 'red'}>
            {isEmployed ? 'Employed' : 'Searching'}
          </Badge>
        </div>

        {!isEmployed && (
          <>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs text-slate-400">This week</p>
              <p className="text-xs font-semibold text-slate-700">
                {thisWeek} / {weekTarget} applications
              </p>
            </div>
            <div className="h-1.5 rounded-full bg-slate-100 mb-2">
              <div
                className={`h-full rounded-full transition-all
                  ${weekPct >= 100 ? 'bg-emerald-500' : weekPct >= 40 ? 'bg-amber-500' : 'bg-red-400'}`}
                style={{ width: `${weekPct}%` }}
              />
            </div>
            <p className="text-xs text-slate-400">{totalApps} total applications sent</p>
          </>
        )}

        {isEmployed && (
          <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3">
            <p className="text-xs font-medium text-emerald-700 mb-1">
              Salary: {formatCurrency(nithishSalary)}/month
            </p>
            {newDeficit <= 0 ? (
              <p className="text-xs font-semibold text-emerald-700">
                🎉 Family surplus of {formatCurrency(Math.abs(newDeficit))}/month
              </p>
            ) : (
              <p className="text-xs text-slate-600">
                Deficit reduced to {formatCurrency(newDeficit)}/month
              </p>
            )}
          </div>
        )}
      </Card>

      {/* ── Section 7: SparkLine (conditional) ───────────────────────── */}
      {sparkData.length >= 2 && (
        <Card className="mb-3">
          <p className="text-xs font-medium uppercase tracking-widest text-slate-400 mb-1">
            Corpus Trend
          </p>
          <p className="text-xs text-slate-400 mb-3">Last {sparkData.length} months</p>
          <SparkLine data={sparkData} height={60} />
        </Card>
      )}

      {/* Bottom padding so FAB doesn't overlap last card */}
      <div className="h-32" />

      {/* ── FAB — Add Expense ─────────────────────────────────────────── */}
      <button
        onClick={() => navigate('/expenses')}
        className="fixed bottom-36 right-4 w-14 h-14 rounded-full bg-violet-600
                   text-white shadow-lg flex items-center justify-center
                   hover:bg-violet-700 active:scale-95 transition-all z-30"
        aria-label="Add expense"
      >
        <Plus size={24} />
      </button>

      {/* ── Ask Amma AI button ────────────────────────────────────────── */}
      <button
        onClick={() => setChatOpen(true)}
        className="fixed bottom-20 right-4 rounded-full bg-violet-600
                   text-white shadow-lg flex items-center justify-center z-40
                   hover:bg-violet-700 active:scale-95 transition-all relative"
        style={{ width: 52, height: 52 }}
        aria-label="Ask Amma AI"
      >
        <MessageCircle size={22} />
        {isOffline && (
          <span className="absolute top-0 right-0 w-2.5 h-2.5 rounded-full
                           bg-red-500 border-2 border-white" />
        )}
      </button>

      {/* ── Ask Amma AI drawer ────────────────────────────────────────── */}
      {chatOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/40 z-40"
            onClick={() => setChatOpen(false)}
          />

          {/* Drawer */}
          <div
            className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl z-50 flex flex-col"
            style={{ height: '80vh' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-100 flex-shrink-0">
              <div className="flex items-center gap-2">
                <Sparkles size={18} className="text-violet-600" />
                <p className="text-base font-semibold text-slate-800">Ask Amma AI</p>
              </div>
              <button
                onClick={() => setChatOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-100"
              >
                <X size={20} className="text-slate-500" />
              </button>
            </div>

            {/* Offline notice */}
            {isOffline && (
              <div className="flex-1 flex items-center justify-center p-6">
                <div className="text-center">
                  <AlertCircle size={32} className="text-slate-400 mx-auto mb-2" />
                  <p className="text-sm text-slate-600 font-medium">
                    Ask Amma AI is unavailable offline.
                  </p>
                  <p className="text-xs text-slate-400 mt-1">Your data is safe.</p>
                </div>
              </div>
            )}

            {/* Chat area */}
            {!isOffline && (
              <>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {/* Suggestion chips */}
                  {chatHistory.length === 0 && (
                    <div className="space-y-2">
                      <p className="text-xs text-slate-400 text-center">
                        Ask me anything about your finances
                      </p>
                      {SUGGESTIONS.map((s, i) => (
                        <button
                          key={i}
                          onClick={() => handleSend(s)}
                          className="w-full text-left text-xs bg-violet-50 border border-violet-100
                                     text-violet-700 rounded-xl px-3 py-2.5
                                     hover:bg-violet-100 transition-colors"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Chat bubbles */}
                  {chatHistory.map((msg, i) => (
                    <div
                      key={i}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-xs rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed
                          ${msg.role === 'user'
                            ? 'bg-violet-600 text-white rounded-br-sm'
                            : 'bg-slate-100 text-slate-800 rounded-bl-sm'}`}
                      >
                        {msg.content}
                      </div>
                    </div>
                  ))}

                  {/* Typing indicator */}
                  {chatLoading && (
                    <div className="flex justify-start">
                      <div className="bg-slate-100 rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1">
                        <span
                          className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"
                          style={{ animationDelay: '0ms' }}
                        />
                        <span
                          className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"
                          style={{ animationDelay: '150ms' }}
                        />
                        <span
                          className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"
                          style={{ animationDelay: '300ms' }}
                        />
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>

                {/* Input row */}
                <div className="p-4 border-t border-slate-100 flex gap-2 flex-shrink-0">
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
                    disabled={chatLoading}
                    className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm
                               focus:outline-none focus:ring-2 focus:ring-violet-500
                               focus:border-transparent disabled:opacity-50"
                  />
                  <button
                    onClick={() => handleSend()}
                    disabled={chatLoading || !chatInput.trim()}
                    className="w-10 h-10 rounded-xl bg-violet-600 text-white flex items-center
                               justify-center hover:bg-violet-700 disabled:opacity-40
                               disabled:cursor-not-allowed transition-colors flex-shrink-0"
                  >
                    <Send size={16} />
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </>
  )
}
