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

  // Deficit card bg
  const deficitBg =
    netPosition < -40000 ? 'bg-red-50 border-red-200' :
    netPosition < 0      ? 'bg-amber-50 border-amber-200' :
                           'bg-green-50 border-green-200'

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
            <p className="text-sm text-slate-500">{getGreeting()}</p>
            <p className="text-xl font-bold text-slate-800">{user?.name ?? 'Friend'}</p>
          </div>
        </div>
        <div className="h-24 bg-slate-200 rounded-xl animate-pulse mb-4" />
        <div className="h-40 bg-slate-200 rounded-xl animate-pulse mb-4" />
        <div className="h-20 bg-slate-200 rounded-xl animate-pulse mb-4" />
      </>
    )
  }

  // ── Main render ───────────────────────────────────────────────────────
  return (
    <>
      {/* ── Section 1: Greeting ───────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm text-slate-500">{getGreeting()}</p>
          <p className="text-xl font-bold text-slate-800">{user?.name ?? 'Friend'}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-400">
            {now.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
          </p>
        </div>
      </div>

      {/* ── Section 2: Deficit card ───────────────────────────────────── */}
      <div className={`rounded-xl border p-4 mb-4 ${deficitBg}`}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-slate-700">This Month</p>
          <Badge color={netPosition < 0 ? 'red' : 'green'}>
            {netPosition < 0 ? 'Deficit' : 'Surplus'}
          </Badge>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-xs text-slate-500 mb-1">Income</p>
            <p className="text-base font-bold text-emerald-700">
              {formatCurrency(income, true)}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1">Spent</p>
            <p className="text-base font-bold text-red-600">
              {formatCurrency(totalExpenses, true)}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1">Net</p>
            <p className={`text-base font-bold ${netPosition < 0 ? 'text-red-700' : 'text-emerald-700'}`}>
              {formatDeficit(netPosition)}
            </p>
          </div>
        </div>
        <p className="text-xs text-slate-400 mt-2 text-center">
          Monthly target: {formatCurrency(85800)} budget
        </p>
      </div>

      {/* ── Section 3: Corpus health card ────────────────────────────── */}
      <Card className="mb-4">
        <div className="flex items-center justify-between mb-1">
          <p className="text-sm font-semibold text-slate-700">Total Corpus</p>
          <ChevronRight size={16} className="text-slate-400" />
        </div>
        <p className="text-2xl font-bold text-slate-800 mb-4">
          {formatCurrency(totalCorpusWithSavings, true)}
        </p>

        <div className="grid grid-cols-2 gap-2 mb-4">
          <button
            className="text-center rounded-lg py-2 hover:bg-slate-50 active:bg-slate-100 transition-colors"
            onClick={() => navigate('/assets')}
          >
            <p className="text-xs text-slate-400">Fixed Deposits</p>
            <p className="text-sm font-semibold text-slate-700">
              {formatCurrency(fdTotal, true)}
            </p>
            <p className="text-xs text-violet-500 mt-0.5">Edit →</p>
          </button>
          <button
            className="text-center rounded-lg py-2 hover:bg-slate-50 active:bg-slate-100 transition-colors"
            onClick={() => navigate('/assets')}
          >
            <p className="text-xs text-slate-400">Mutual Funds</p>
            <p className="text-sm font-semibold text-slate-700">
              {formatCurrency(mfTotal, true)}
            </p>
            <p className="text-xs text-violet-500 mt-0.5">Edit →</p>
          </button>
          <button
            className="text-center rounded-lg py-2 hover:bg-slate-50 active:bg-slate-100 transition-colors"
            onClick={() => navigate('/assets')}
          >
            <p className="text-xs text-slate-400">Gold</p>
            <p className="text-sm font-semibold text-slate-700">
              {formatCurrency(goldTotal, true)}
            </p>
            <p className="text-xs text-violet-500 mt-0.5">Edit →</p>
          </button>
          <button
            className="text-center rounded-lg py-2 hover:bg-slate-50 active:bg-slate-100 transition-colors"
            onClick={() => navigate('/settings')}
          >
            <p className="text-xs text-slate-400">Bank Savings</p>
            <p className="text-sm font-semibold text-slate-700">
              {formatCurrency(savingsBalance, true)}
            </p>
            <p className="text-xs text-violet-500 mt-0.5">Edit →</p>
          </button>
        </div>

        <div className={`rounded-lg p-3 ${efIntact ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Lock size={14} className={efIntact ? 'text-green-600' : 'text-red-500'} />
              <p className="text-xs font-medium text-slate-700">Emergency Fund</p>
            </div>
            <div className="flex items-center gap-1">
              <p className="text-xs text-slate-500">
                {formatCurrency(efBalance, true)} / {formatCurrency(efTarget, true)}
              </p>
              <button
                onClick={() => navigate('/settings')}
                className="text-xs text-violet-500 underline"
              >
                Edit
              </button>
            </div>
          </div>
          <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${efIntact ? 'bg-green-500' : 'bg-red-400'}`}
              style={{ width: `${efPct}%` }}
            />
          </div>
          {!efIntact && (
            <p className="text-xs text-red-600 mt-1.5 font-medium">
              ⚠ Not yet isolated — complete Week 3 action
            </p>
          )}
          {efIntact && (
            <p className="text-xs text-green-700 mt-1.5">✓ Isolated and intact</p>
          )}
        </div>
      </Card>
      <p className="text-xs text-slate-400 text-center -mt-2 mb-4">
        Tap FDs · Funds · Gold above to update values
      </p>

      {/* ── Section 4: Upcoming milestones ───────────────────────────── */}
      <div className="mb-4">
        <p className="text-sm font-semibold text-slate-700 mb-2">Upcoming</p>
        {upcomingMilestones.length === 0 ? (
          <div className="rounded-xl bg-green-50 border border-green-200 p-3 text-center">
            <p className="text-sm text-green-700">All milestones up to date ✓</p>
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
            {upcomingMilestones.map(m => {
              const days = daysUntil(m.date)
              return (
                <div
                  key={m.id}
                  className={`flex-shrink-0 w-52 rounded-xl border p-3 bg-white
                    ${m.isDangerous ? 'border-red-200' : 'border-slate-200'}`}
                >
                  {m.isDangerous && (
                    <span className="inline-flex h-2 w-2 rounded-full bg-red-500 animate-pulse mb-1" />
                  )}
                  <p className="text-xs font-medium text-slate-800 leading-tight mb-2 line-clamp-2">
                    {m.title}
                  </p>
                  <div className="flex items-center justify-between">
                    <Badge color={days < 0 ? 'red' : days < 14 ? 'red' : days < 30 ? 'amber' : 'slate'}>
                      {days < 0 ? 'Overdue' : days === 0 ? 'Today' : `${days}d`}
                    </Badge>
                    {m.amount != null && (
                      <p className="text-xs text-slate-500">
                        {formatCurrency(m.amount, true)}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Section 5: Budget snapshot strip ─────────────────────────── */}
      <div className="mb-4">
        <p className="text-sm font-semibold text-slate-700 mb-2">Budget</p>
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
                className="flex-shrink-0 w-28 rounded-xl border border-slate-200 bg-white p-2.5"
              >
                <div className="flex items-center gap-1.5 mb-1.5">
                  {IconComponent && <IconComponent size={12} style={{ color: cat.color }} />}
                  <p className="text-xs text-slate-600 truncate">{cat.label.split(' ')[0]}</p>
                </div>
                <p className="text-xs font-semibold text-slate-800 mb-1">
                  {formatCurrency(spent, true)}
                </p>
                <div className="h-1 rounded-full bg-slate-100">
                  <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  of {formatCurrency(limit, true)}
                </p>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Section 6: Employment card ───────────────────────────────── */}
      <Card className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Briefcase size={16} className="text-violet-600" />
            <p className="text-sm font-semibold text-slate-700">Job Search</p>
          </div>
          <Badge color={isEmployed ? 'green' : thisWeek >= 25 ? 'green' : thisWeek >= 10 ? 'amber' : 'red'}>
            {isEmployed ? 'Employed' : 'Searching'}
          </Badge>
        </div>

        {!isEmployed && (
          <>
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-slate-500">This week</p>
              <p className="text-xs font-medium text-slate-700">
                {thisWeek} / {weekTarget} applications
              </p>
            </div>
            <div className="h-2 rounded-full bg-slate-100 mb-3">
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
          <div className="bg-green-50 rounded-lg p-3">
            <p className="text-xs font-medium text-green-700 mb-1">
              Salary: {formatCurrency(nithishSalary)}/month
            </p>
            {newDeficit <= 0 ? (
              <p className="text-xs text-emerald-700 font-semibold">
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
        <Card className="mb-4">
          <p className="text-sm font-semibold text-slate-700 mb-1">Corpus Trend</p>
          <p className="text-xs text-slate-400 mb-3">Last {sparkData.length} months</p>
          <SparkLine data={sparkData} height={60} />
        </Card>
      )}

      {/* Bottom padding so FAB doesn't overlap last card */}
      <div className="h-32" />

      {/* ── Section 8: FAB — Add Expense ─────────────────────────────── */}
      <button
        onClick={() => navigate('/expenses')}
        className="fixed bottom-36 right-4 w-14 h-14 rounded-full bg-violet-600
                   text-white shadow-lg flex items-center justify-center
                   hover:bg-violet-700 active:scale-95 transition-all z-30"
        aria-label="Add expense"
      >
        <Plus size={24} />
      </button>

      {/* ── Section 9: Ask Amma AI button ────────────────────────────── */}
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
