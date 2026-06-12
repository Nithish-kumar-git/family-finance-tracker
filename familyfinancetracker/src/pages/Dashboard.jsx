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

      if (results[0].status === 'fulfilled') {
        const res = results[0].value
        if (res && res.expenses) {
          setExpenses(res.expenses)
          setCategoryTotals(res.category_totals ?? {})
        } else if (Array.isArray(res)) {
          setExpenses(res)
          const totals = {}
          res.forEach(e => { totals[e.category] = (totals[e.category] ?? 0) + e.amount })
          setCategoryTotals(totals)
        }
      }

      if (results[1].status === 'fulfilled') {
        setMilestones(results[1].value ?? [])
      }

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
        <div className="h-28 bg-slate-200 rounded-2xl animate-pulse mb-5" />
        <div className="h-48 bg-slate-200 rounded-2xl animate-pulse mb-5" />
        <div className="h-20 bg-slate-200 rounded-2xl animate-pulse" />
      </>
    )
  }

  // ── Main render ───────────────────────────────────────────────────────
  return (
    <>
      {/* ── Hero: Dark gradient with glass cards ─────────────────────────── */}
      <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 lg:p-8 mb-5">
        {/* Greeting */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-indigo-300 mb-1">
              {getGreeting()}
            </p>
            <p className="text-3xl lg:text-4xl font-bold text-white tracking-tight">
              {user?.name ?? 'Friend'}
            </p>
          </div>
          <p className="text-xs text-slate-500">
            {now.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
          </p>
        </div>

        {/* Net position */}
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-2">
            This Month
          </p>
          <p className={`text-4xl lg:text-5xl font-bold tracking-tight ${
            netPosition >= 0 ? 'text-emerald-400' : 'text-red-400'
          }`}>
            {formatDeficit(netPosition)}
          </p>
          <p className="text-sm text-slate-400 mt-1.5">
            Income {formatCurrency(income, true)} · Spent {formatCurrency(totalExpenses, true)}
          </p>
        </div>

        {/* Glass stat cards — 3 columns */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white/15 backdrop-blur-md border border-white/25 rounded-xl p-3 lg:p-4 text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-white/60 mb-1.5">
              Income
            </p>
            <p className="text-lg lg:text-xl font-bold text-emerald-400">
              {formatCurrency(income, true)}
            </p>
          </div>
          
          <div className="bg-white/15 backdrop-blur-md border border-white/25 rounded-xl p-3 lg:p-4 text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-white/60 mb-1.5">
              Spent
            </p>
            <p className="text-lg lg:text-xl font-bold text-red-400">
              {formatCurrency(totalExpenses, true)}
            </p>
          </div>
          
          <div className="bg-white/15 backdrop-blur-md border border-white/25 rounded-xl p-3 lg:p-4 text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-white/60 mb-1.5">
              Saved
            </p>
            <p className="text-lg lg:text-xl font-bold text-white">
              {formatCurrency(Math.max(0, income - totalExpenses), true)}
            </p>
          </div>
        </div>
      </div>

      {/* ── Desktop 2-column grid ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* LEFT COLUMN */}
        <div className="space-y-5">
          {/* Corpus card */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-1">
              Total Savings
            </p>
            <p className="text-3xl font-bold text-slate-900 tracking-tight mb-5">
              {formatCurrency(totalCorpusWithSavings, true)}
            </p>

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
                  className="text-left bg-slate-50 hover:bg-slate-100 transition-colors rounded-xl p-3"
                >
                  <p className="text-xs font-medium text-slate-400 mb-1 uppercase tracking-wide">
                    {item.label}
                  </p>
                  <p className="text-base font-semibold text-slate-800">
                    {formatCurrency(item.value, true)}
                  </p>
                  <p className="text-xs text-indigo-500 mt-0.5">Edit →</p>
                </button>
              ))}
            </div>

            {/* Emergency fund bar */}
            <div className={`rounded-xl p-3 ${
              efIntact
                ? 'bg-emerald-50 border border-emerald-100'
                : 'bg-red-50 border border-red-100'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <Lock size={13} className={efIntact ? 'text-emerald-600' : 'text-red-400'} />
                  <p className="text-xs font-medium text-slate-700">Emergency Fund</p>
                </div>
                <p className="text-xs text-slate-400">
                  {formatCurrency(efBalance, true)} / {formatCurrency(efTarget, true)}
                </p>
              </div>
              <div className="h-1.5 rounded-full bg-white/70 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    efIntact ? 'bg-emerald-500' : 'bg-red-400'
                  }`}
                  style={{ width: `${efPct}%` }}
                />
              </div>
              {!efIntact && (
                <p className="text-xs text-red-500 mt-1.5 font-medium">
                  ⚠ Not yet isolated
                </p>
              )}
            </div>
          </div>

          {/* Upcoming milestones */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">
              Upcoming
            </p>
            {upcomingMilestones.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">
                All milestones up to date ✓
              </p>
            ) : (
              <div className="space-y-2">
                {upcomingMilestones.map(m => {
                  const days = daysUntil(m.date)
                  return (
                    <div
                      key={m.id}
                      className={`flex items-center justify-between p-3 rounded-xl ${
                        m.isDangerous
                          ? 'bg-red-50 border border-red-100'
                          : 'bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {m.isDangerous && (
                          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
                        )}
                        <p className="text-sm font-medium text-slate-800 truncate">
                          {m.title}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                        {m.amount != null && (
                          <p className="text-xs text-slate-400 hidden sm:block">
                            {formatCurrency(m.amount, true)}
                          </p>
                        )}
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                          days < 0
                            ? 'bg-red-100 text-red-600'
                            : days < 14
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-slate-100 text-slate-500'
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
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">
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
                    ? 'bg-emerald-500'
                    : pct < 100
                    ? 'bg-amber-500'
                    : 'bg-red-500'
                return (
                  <div key={key} className="bg-slate-50 rounded-xl p-3">
                    <div className="flex items-center gap-1.5 mb-2">
                      {IconComponent && (
                        <IconComponent size={13} style={{ color: cat.color }} />
                      )}
                      <p className="text-xs font-medium text-slate-600 truncate">
                        {cat.label.split(' ')[0]}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-slate-800 mb-1.5">
                      {formatCurrency(spent, true)}
                    </p>
                    <div className="h-1 rounded-full bg-slate-200 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${barColor}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      of {formatCurrency(limit, true)}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Employment card */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                Job Search
              </p>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                isEmployed
                  ? 'bg-emerald-100 text-emerald-700'
                  : thisWeek >= 25
                  ? 'bg-emerald-100 text-emerald-700'
                  : thisWeek >= 10
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-red-100 text-red-600'
              }`}>
                {isEmployed ? 'Employed' : 'Searching'}
              </span>
            </div>

            {!isEmployed ? (
              <>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-sm text-slate-500">This week</p>
                  <p className="text-sm font-semibold text-slate-800">
                    {thisWeek} / 25 applications
                  </p>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      weekPct >= 100
                        ? 'bg-emerald-500'
                        : weekPct >= 40
                        ? 'bg-amber-500'
                        : 'bg-red-400'
                    }`}
                    style={{ width: `${weekPct}%` }}
                  />
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  {totalApps} total applications sent
                </p>
              </>
            ) : (
              <div className="bg-emerald-50 rounded-xl p-3">
                <p className="text-sm font-semibold text-emerald-800">
                  {formatCurrency(nithishSalary)}/month
                </p>
                <p className="text-xs text-emerald-600 mt-0.5">
                  {newDeficit <= 0
                    ? `🎉 Surplus ${formatCurrency(Math.abs(newDeficit))}/month`
                    : `Deficit reduced to ${formatCurrency(newDeficit)}/month`}
                </p>
              </div>
            )}
          </div>

          {/* SparkLine — only if enough data */}
          {sparkData.length >= 2 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">
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
        className="fixed bottom-24 lg:bottom-8 right-4 w-14 h-14 rounded-full bg-indigo-600
                   text-white shadow-lg flex items-center justify-center
                   hover:bg-indigo-700 active:scale-95 transition-all z-30"
        aria-label="Add expense"
      >
        <Plus size={24} />
      </button>

      {/* ── Ask Amma AI button ────────────────────────────────────────── */}
      <button
        onClick={() => setChatOpen(true)}
        className="fixed bottom-24 lg:bottom-8 right-20 lg:right-20 rounded-full bg-indigo-600
                   text-white shadow-lg flex items-center justify-center z-40
                   hover:bg-indigo-700 active:scale-95 transition-all relative w-12 h-12"
        aria-label="Ask Amma AI"
      >
        <MessageCircle size={20} />
        {isOffline && (
          <span className="absolute top-0 right-0 w-2.5 h-2.5 rounded-full bg-red-500 border-2 border-white" />
        )}
      </button>

      {/* ── Ask Amma AI drawer ────────────────────────────────────────── */}
      {chatOpen && (
        <>
          <div className="fixed inset-0 bg-black/40 z-50" onClick={() => setChatOpen(false)} />
          <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl z-50 flex flex-col" style={{ height: '80vh' }}>
            <div className="flex items-center justify-between p-4 border-b border-slate-100 flex-shrink-0">
              <div className="flex items-center gap-2">
                <Sparkles size={18} className="text-indigo-600" />
                <p className="text-base font-semibold text-slate-800">Ask Amma AI</p>
              </div>
              <button onClick={() => setChatOpen(false)} className="p-1 rounded-lg hover:bg-slate-100">
                <X size={20} className="text-slate-500" />
              </button>
            </div>

            {isOffline && (
              <div className="flex-1 flex items-center justify-center p-6">
                <div className="text-center">
                  <AlertCircle size={32} className="text-slate-400 mx-auto mb-2" />
                  <p className="text-sm text-slate-600 font-medium">Ask Amma AI is unavailable offline.</p>
                  <p className="text-xs text-slate-400 mt-1">Your data is safe.</p>
                </div>
              </div>
            )}

            {!isOffline && (
              <>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {chatHistory.length === 0 && (
                    <div className="space-y-2">
                      <p className="text-xs text-slate-400 text-center">Ask me anything about your finances</p>
                      {SUGGESTIONS.map((s, i) => (
                        <button
                          key={i}
                          onClick={() => handleSend(s)}
                          className="w-full text-left text-xs bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-xl px-3 py-2.5 hover:bg-indigo-100 transition-colors"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}

                  {chatHistory.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-xs rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-indigo-600 text-white rounded-br-sm'
                          : 'bg-slate-100 text-slate-800 rounded-bl-sm'
                      }`}>
                        {msg.content}
                      </div>
                    </div>
                  ))}

                  {chatLoading && (
                    <div className="flex justify-start">
                      <div className="bg-slate-100 rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1">
                        <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>

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
                    className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50"
                  />
                  <button
                    onClick={() => handleSend()}
                    disabled={chatLoading || !chatInput.trim()}
                    className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0"
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
