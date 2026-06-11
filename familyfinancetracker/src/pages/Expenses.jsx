// Expenses page — Add, History, and Summary tabs.
// All API calls go through api.* from utils/api.js (via useExpenses hook).
// All state mutations go through Zustand actions — never direct localStorage writes.

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import useStore from '../store/useStore.js'
import { useExpenses } from '../hooks/useExpenses.js'
import { api } from '../utils/api.js'
import { formatCurrency, formatDate } from '../utils/formatters.js'
import { EXPENSE_CATEGORIES } from '../data/seedData.js'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import Card from '../components/ui/Card.jsx'
import Button from '../components/ui/Button.jsx'
import Badge from '../components/ui/Badge.jsx'
import Input from '../components/ui/Input.jsx'
import {
  Clipboard, X, Sparkles, ShoppingCart, Zap, Heart, Car, Home,
  Shield, Users, User, BookOpen, MoreHorizontal, Trash2,
} from 'lucide-react'

// ─── Category icon renderer ────────────────────────────────────────────────────
const renderCategoryIcon = (category, size = 16) => {
  const map = {
    groceries:         <ShoppingCart size={size} />,
    utilities:         <Zap size={size} />,
    medical:           <Heart size={size} />,
    transport:         <Car size={size} />,
    household:         <Home size={size} />,
    lic_premium:       <Shield size={size} />,
    chit_contribution: <Users size={size} />,
    personal:          <User size={size} />,
    education:         <BookOpen size={size} />,
    other:             <MoreHorizontal size={size} />,
  }
  return map[category] ?? <MoreHorizontal size={size} />
}

// Short label for the category chip grid (first word only)
const shortLabel = (label) => {
  const overrides = { 'Groceries & Food': 'Groceries', 'LIC Premium': 'LIC', 'Chit Fund': 'Chit' }
  return overrides[label] ?? label.split(' ')[0]
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
const todayStr = () => new Date().toISOString().split('T')[0]

// Build last-7-months option list (current month + 6 previous)
function buildMonthOptions() {
  const options = []
  const now = new Date()
  for (let i = 0; i < 7; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
    options.push({ val, label })
  }
  return options
}

const MONTH_OPTIONS = buildMonthOptions()

// Date group heading — Today / Yesterday / formatted date
function dateHeading(dateStr) {
  const today = todayStr()
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
  if (dateStr === today) return 'Today'
  if (dateStr === yesterday) return 'Yesterday'
  return formatDate(dateStr)
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function Expenses() {
  // ── Store reads ──────────────────────────────────────────────────────────────
  const currentUser  = useStore(s => s.currentUser)
  const users        = useStore(s => s.users)
  const budgets      = useStore(s => s.budgets)

  const {
    getExpensesForMonth,
    getTotalByCategory,
    getMonthlyTotal,
    addExpense:    hookAddExpense,
    deleteExpense: hookDeleteExpense,
  } = useExpenses()

  // ── Tab state ────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('add')

  // ── Shared data state ────────────────────────────────────────────────────────
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const n = new Date()
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`
  })
  const [expenses,       setExpenses]       = useState([])
  const [categoryTotals, setCategoryTotals] = useState({})
  const [dataLoading,    setDataLoading]    = useState(false)

  // ── Add tab state ────────────────────────────────────────────────────────────
  const [amount,          setAmount]          = useState('')
  const [category,        setCategory]        = useState('groceries')
  const [description,     setDescription]     = useState('')
  const [date,            setDate]            = useState(todayStr)
  const [selectedUserId,  setSelectedUserId]  = useState(null)
  const [isRecurring,     setIsRecurring]     = useState(false)
  const [addLoading,      setAddLoading]      = useState(false)
  const [parsedByAI,      setParsedByAI]      = useState(false)
  const [formError,       setFormError]       = useState('')

  // SMS parser modal state
  const [smsModalOpen,  setSmsModalOpen]  = useState(false)
  const [smsText,       setSmsText]       = useState('')
  const [parseLoading,  setParseLoading]  = useState(false)

  // ── History tab state ────────────────────────────────────────────────────────
  const [historyUserFilter, setHistoryUserFilter] = useState('all')
  const [deletingId,        setDeletingId]        = useState(null)
  const [deleteConfirmId,   setDeleteConfirmId]   = useState(null)

  // ── Toast state ──────────────────────────────────────────────────────────────
  const [toast,     setToast]     = useState(null)
  const toastTimer                = useRef(null)

  // ── Data loader ──────────────────────────────────────────────────────────────
  const loadData = useCallback(() => {
    const [yr, mo] = selectedMonth.split('-').map(Number)
    setDataLoading(true)
    getExpensesForMonth(yr, mo).then(result => {
      setExpenses(result.expenses)
      setCategoryTotals(result.categoryTotals)
      setDataLoading(false)
    })
  }, [selectedMonth]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadData()
  }, [loadData])

  // ── Toast helper ─────────────────────────────────────────────────────────────
  const showToast = useCallback((message, type = 'success') => {
    clearTimeout(toastTimer.current)
    setToast({ message, type })
    toastTimer.current = setTimeout(() => setToast(null), 2500)
  }, [])

  // ── handleAddExpense ─────────────────────────────────────────────────────────
  const handleAddExpense = async () => {
    setFormError('')
    const parsedAmount = parseInt(amount, 10)
    if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) {
      setFormError('Amount is required')
      return
    }

    const expense = {
      userId:      selectedUserId ?? currentUser,
      amount:      parsedAmount,
      category,
      description: description.slice(0, 60),
      date:        date || todayStr(),
      isRecurring,
    }

    setAddLoading(true)
    try {
      await hookAddExpense(expense)
      // Reset form
      setAmount('')
      setDescription('')
      setCategory('groceries')
      setDate(todayStr())
      setIsRecurring(false)
      setParsedByAI(false)
      setFormError('')
      showToast('Expense added ✓', 'success')
      // Reload data for the currently selected month
      loadData()
    } catch {
      showToast('Failed to save — try again', 'error')
    } finally {
      setAddLoading(false)
    }
  }

  // ── handleParseTransaction ───────────────────────────────────────────────────
  const handleParseTransaction = async () => {
    setParseLoading(true)
    const result = await api.ai.parseTransaction(smsText)
    if (result === null) {
      // Offline / error — close silently, no error message
      setSmsModalOpen(false)
      setSmsText('')
      setParseLoading(false)
      return
    }
    if (result.confidence >= 0.6) {
      setAmount(String(result.amount))
      setCategory(result.category)
      setDescription(result.description)
      setParsedByAI(true)
    } else {
      setAmount(String(result.amount))
      setCategory('other')
      setParsedByAI(false)
    }
    setSmsModalOpen(false)
    setSmsText('')
    setParseLoading(false)
  }

  // ── handleDeleteExpense ──────────────────────────────────────────────────────
  const handleDeleteExpense = async (id) => {
    setDeletingId(id)
    try {
      await hookDeleteExpense(id)
      setDeleteConfirmId(null)
      setDeletingId(null)
      setExpenses(prev => prev.filter(e => e.id !== id))
      showToast('Expense deleted', 'success')
    } catch {
      setDeletingId(null)
      showToast('Could not delete — please try again', 'error')
    }
  }

  // ── Filtered + grouped history ───────────────────────────────────────────────
  const filteredExpenses = useMemo(() => {
    let list = [...expenses]
    if (historyUserFilter !== 'all') {
      list = list.filter(e => e.userId === historyUserFilter)
    }
    return list.sort((a, b) => b.date.localeCompare(a.date))
  }, [expenses, historyUserFilter])

  const groupedExpenses = useMemo(() => {
    const grouped = {}
    filteredExpenses.forEach(e => {
      if (!grouped[e.date]) grouped[e.date] = []
      grouped[e.date].push(e)
    })
    const sortedDates = Object.keys(grouped).sort().reverse()
    return { grouped, sortedDates }
  }, [filteredExpenses])

  // ── Summary chart data ───────────────────────────────────────────────────────
  const chartData = useMemo(() =>
    Object.entries(categoryTotals)
      .filter(([, v]) => v > 0)
      .sort(([, a], [, b]) => b - a)
      .map(([key, amt]) => ({
        label: EXPENSE_CATEGORIES[key]?.label.split(' ')[0] ?? key,
        amount: amt,
        color:  EXPENSE_CATEGORIES[key]?.color ?? '#6B7280',
      })),
    [categoryTotals]
  )

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-white pb-24">

      {/* ── Toast ─────────────────────────────────────────────────────────── */}
      {toast && (
        <div
          className={`fixed bottom-20 left-1/2 -translate-x-1/2 z-50 rounded-2xl px-5 py-3 text-sm
            font-medium shadow-xl flex items-center gap-2 whitespace-nowrap
            ${toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}
        >
          {toast.message}
        </div>
      )}

      {/* ── SMS Parser Modal ───────────────────────────────────────────────── */}
      {smsModalOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-50"
            onClick={() => { setSmsModalOpen(false); setSmsText('') }}
          />
          <div className="fixed inset-x-4 bottom-0 bg-white rounded-t-2xl p-5 z-50 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <p className="text-base font-semibold text-slate-900">Paste UPI / SMS</p>
              <button
                onClick={() => { setSmsModalOpen(false); setSmsText('') }}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>
            <textarea
              rows={4}
              className="w-full rounded-xl border border-slate-200 p-3 text-sm
                         focus:outline-none focus:ring-2 focus:ring-indigo-500
                         focus:border-transparent resize-none"
              placeholder="Paste your bank SMS or UPI notification here..."
              value={smsText}
              onChange={e => setSmsText(e.target.value)}
            />
            <div className="flex gap-3 mt-4">
              <Button
                variant="ghost"
                size="md"
                className="flex-1"
                onClick={() => { setSmsModalOpen(false); setSmsText('') }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="md"
                className="flex-1"
                loading={parseLoading}
                onClick={handleParseTransaction}
                disabled={!smsText.trim()}
              >
                <Sparkles size={14} />
                Parse with AI
              </Button>
            </div>
            <div className="h-safe-bottom" />
          </div>
        </>
      )}

      {/* ── Tab bar ───────────────────────────────────────────────────────── */}
      <div className="sticky top-14 z-10 bg-white border-b border-slate-100">
        <div className="flex h-11">
          {['add', 'history', 'summary'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 text-sm font-medium transition-colors
                ${activeTab === tab
                  ? 'border-b-2 border-indigo-600 text-indigo-600 font-semibold'
                  : 'text-slate-400 hover:text-slate-600'}`}
            >
              {tab === 'add' ? 'Add' : tab === 'history' ? 'History' : 'Summary'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Month selector (History + Summary only) ────────────────────────── */}
      {activeTab !== 'add' && (
        <div className="px-4 py-2 bg-white border-b border-slate-100">
          <select
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            className="border border-slate-100 rounded-xl px-3 py-1.5 text-sm
                       text-slate-700 focus:outline-none focus:ring-2
                       focus:ring-indigo-500 bg-slate-50"
          >
            {MONTH_OPTIONS.map(o => (
              <option key={o.val} value={o.val}>{o.label}</option>
            ))}
          </select>
        </div>
      )}

      <div className="px-4 py-4 max-w-7xl mx-auto lg:px-6 pb-24 lg:pb-8">

        {/* ════════════════════════════════════════════════════════════════════
            TAB 1 — ADD EXPENSE
            ════════════════════════════════════════════════════════════════ */}
        {activeTab === 'add' && (
          <div className="lg:grid lg:grid-cols-2 lg:gap-6 lg:items-start">
            <div>
          <div className="flex flex-col gap-4">

            {/* Amount + SMS parser */}
            <div>
              <Input
                id="expense-amount"
                label="Amount"
                prefix="₹"
                inputMode="numeric"
                value={amount}
                onChange={e => {
                  setAmount(e.target.value.replace(/[^0-9]/g, ''))
                  setFormError('')
                }}
                placeholder="0"
                error={formError}
              />
              <div className="flex items-center gap-2 mt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSmsModalOpen(true)}
                >
                  <Clipboard size={14} />
                  Paste UPI / SMS
                </Button>
                {parsedByAI && (
                  <Badge color="indigo">
                    <Sparkles size={10} className="mr-1 inline" />
                    Parsed by AI
                  </Badge>
                )}
              </div>
            </div>

            {/* Category selector */}
            <div>
              <p className="text-xs font-medium uppercase tracking-widest text-slate-400 mb-2">Category</p>
              <div className="grid grid-cols-5 gap-2">
                {Object.entries(EXPENSE_CATEGORIES).map(([key, cat]) => {
                  const isSelected = category === key
                  return (
                    <button
                      key={key}
                      onClick={() => setCategory(key)}
                      className={`rounded-xl p-2.5 flex flex-col items-center gap-1
                        cursor-pointer text-xs transition-colors
                        ${isSelected
                          ? 'ring-2 ring-indigo-500 bg-indigo-50 text-indigo-700'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                    >
                      {renderCategoryIcon(key, 18)}
                      <span className="leading-tight text-center">
                        {shortLabel(cat.label)}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Description */}
            <div>
              <Input
                id="expense-description"
                label="Description (optional)"
                value={description}
                onChange={e => setDescription(e.target.value.slice(0, 60))}
                placeholder="Merchant or note"
                maxLength={60}
              />
              {description.length > 0 && (
                <p className="text-xs text-slate-400 mt-1 text-right">
                  {description.length}/60
                </p>
              )}
            </div>

            {/* Date */}
            <div>
              <label
                htmlFor="expense-date"
                className="block text-sm font-medium text-slate-700 mb-1"
              >
                Date
              </label>
              <input
                id="expense-date"
                type="date"
                value={date}
                max={todayStr()}
                onChange={e => setDate(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm
                           bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500
                           focus:border-transparent"
              />
            </div>

            {/* Paid by */}
            <div>
              <p className="text-xs font-medium uppercase tracking-widest text-slate-400 mb-2">Paid by</p>
              <div className="flex gap-3">
                {users.map(u => {
                  const active = (selectedUserId ?? currentUser) === u.id
                  return (
                    <button
                      key={u.id}
                      onClick={() => setSelectedUserId(u.id)}
                      className={`w-8 h-8 rounded-full flex items-center justify-center
                        text-white text-xs font-bold transition-all
                        ${active ? 'ring-2 ring-offset-1 ring-indigo-600 scale-110' : 'opacity-70'}`}
                      style={{ backgroundColor: u.color }}
                      title={u.name}
                    >
                      {u.name[0]}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Recurring toggle */}
            <div>
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-600">
                  Repeat for next 3 months
                </p>
                {/* Pill toggle */}
                <button
                  role="switch"
                  aria-checked={isRecurring}
                  onClick={() => setIsRecurring(v => !v)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full
                    transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500
                    ${isRecurring ? 'bg-indigo-600' : 'bg-slate-200'}`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white
                      shadow transition-transform
                      ${isRecurring ? 'translate-x-6' : 'translate-x-1'}`}
                  />
                </button>
              </div>
              {isRecurring && (
                <p className="text-xs text-amber-600 mt-1.5 bg-amber-50 rounded-lg px-3 py-2">
                  This will create 3 additional entries on the 1st of the next 3 months.
                </p>
              )}
            </div>

            {/* Submit */}
            <Button
              variant="primary"
              size="lg"
              className="w-full"
              loading={addLoading}
              onClick={handleAddExpense}
            >
              Add Expense
            </Button>
          </div>
          </div>
          
          {/* Second column for recent expenses preview on desktop */}
          <div className="hidden lg:block">
            <p className="text-xs font-medium uppercase tracking-widest text-slate-400 mb-3">
              Recent Expenses
            </p>
            <div className="space-y-2">
              {expenses.slice(0, 5).map(expense => {
                const catMeta = EXPENSE_CATEGORIES[expense.category]
                return (
                  <div key={expense.id} className="flex items-center gap-3 py-2 px-3 bg-white rounded-xl border border-slate-100">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">
                        {expense.description || catMeta?.label}
                      </p>
                      <p className="text-xs text-slate-400">{formatDate(expense.date)}</p>
                    </div>
                    <p className="text-sm font-semibold text-slate-800">{formatCurrency(expense.amount)}</p>
                  </div>
                )
              })}
            </div>
          </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            TAB 2 — HISTORY
            ════════════════════════════════════════════════════════════════ */}
        {activeTab === 'history' && (
          <div>
            {/* User filter chips */}
            <div className="flex gap-2 mb-4 flex-wrap">
              {[
                { id: 'all', label: 'All' },
                ...users.map(u => ({ id: u.id, label: u.name })),
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setHistoryUserFilter(f.id)}
                  className={`rounded-full px-3 py-1 text-xs font-medium cursor-pointer
                    transition-colors
                    ${historyUserFilter === f.id
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Loading skeletons */}
            {dataLoading && (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />
                ))}
              </div>
            )}

            {/* Empty state */}
            {!dataLoading && filteredExpenses.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16">
                <p className="text-sm font-medium text-slate-400">No expenses recorded</p>
                <p className="text-xs text-slate-300 mt-1">
                  {historyUserFilter !== 'all'
                    ? 'Try switching the user filter above'
                    : 'Tap Add to record your first expense'}
                </p>
              </div>
            )}

            {/* Grouped expense list */}
            {!dataLoading && groupedExpenses.sortedDates.map(dateKey => (
              <div key={dateKey}>
                {/* Date heading */}
                <p className="text-xs font-medium uppercase tracking-widest text-slate-400 py-2">
                  {dateHeading(dateKey)}
                </p>

                {groupedExpenses.grouped[dateKey].map(expense => {
                  const catMeta = EXPENSE_CATEGORIES[expense.category]
                  const u = users.find(u => u.id === expense.userId)

                  return (
                    <div
                      key={expense.id}
                      className="flex items-center gap-3 py-3 border-b border-slate-50"
                    >
                      {/* Category icon circle */}
                      <div
                        className="w-9 h-9 rounded-full flex-shrink-0 flex
                                   items-center justify-center"
                        style={{
                          backgroundColor: (catMeta?.color ?? '#6B7280') + '20',
                          color: catMeta?.color ?? '#6B7280',
                        }}
                      >
                        {renderCategoryIcon(expense.category, 16)}
                      </div>

                      {/* Description + category */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">
                          {expense.description || catMeta?.label}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <p className="text-xs text-slate-400">{catMeta?.label}</p>
                          {u && (
                            <span
                              className="w-2 h-2 rounded-full flex-shrink-0"
                              style={{ backgroundColor: u.color }}
                            />
                          )}
                        </div>
                      </div>

                      {/* Amount + delete */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <p className="text-sm font-semibold text-slate-800">
                          {formatCurrency(expense.amount)}
                        </p>
                        {deleteConfirmId === expense.id ? (
                          <div className="flex gap-1">
                            <button
                              onClick={() => handleDeleteExpense(expense.id)}
                              disabled={deletingId === expense.id}
                              className="text-xs bg-red-600 text-white rounded-lg
                                         px-2 py-1 disabled:opacity-50"
                            >
                              {deletingId === expense.id ? '...' : 'Delete'}
                            </button>
                            <button
                              onClick={() => setDeleteConfirmId(null)}
                              className="text-xs bg-slate-100 text-slate-600
                                         rounded-lg px-2 py-1"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirmId(expense.id)}
                            className="p-1.5 rounded-lg text-slate-300
                                       hover:text-red-400 hover:bg-red-50
                                       transition-colors"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            TAB 3 — SUMMARY
            ════════════════════════════════════════════════════════════════ */}
        {activeTab === 'summary' && (
          <div>
            {/* Monthly total vs budget bar */}
            {(() => {
              const totalSpent   = getMonthlyTotal(expenses)
              const budgetTarget = 85800
              const pct          = Math.min((totalSpent / budgetTarget) * 100, 100)
              const barColor     = pct >= 100 ? 'bg-red-500'
                                 : pct >= 80  ? 'bg-amber-500'
                                              : 'bg-emerald-500'
              return (
                <Card className="mb-4">
                  <p className="text-xs font-medium uppercase tracking-widest text-slate-400 mb-1">Monthly Spend</p>
                  <div className="flex items-end justify-between mb-3">
                    <p className={`text-3xl font-bold tracking-tight
                      ${pct >= 100 ? 'text-red-500' : 'text-slate-900'}`}>
                      {formatCurrency(totalSpent)}
                    </p>
                    <p className="text-xs text-slate-400 mb-1">of {formatCurrency(budgetTarget)}</p>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${barColor}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-400 mt-1.5">
                    {pct >= 100
                      ? `Over budget by ${formatCurrency(totalSpent - budgetTarget)}`
                      : `${formatCurrency(budgetTarget - totalSpent)} remaining`}
                  </p>
                </Card>
              )
            })()}

            {/* Spending by category bar chart */}
            <Card className="mb-4">
              <p className="text-xs font-medium uppercase tracking-widest text-slate-400 mb-3">
                Spending by Category
              </p>
              {dataLoading ? (
                <div className="h-48 bg-slate-100 rounded-xl animate-pulse" />
              ) : chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart
                    data={chartData}
                    margin={{ top: 4, right: 4, left: -16, bottom: 4 }}
                  >
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 10 }}
                      interval={0}
                      angle={-35}
                      textAnchor="end"
                      height={48}
                    />
                    <YAxis
                      tick={{ fontSize: 10 }}
                      tickFormatter={v => formatCurrency(v, true)}
                    />
                    <Tooltip formatter={v => [formatCurrency(v), 'Spent']} />
                    <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                      {chartData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-slate-400 text-center py-8">
                  No spending recorded for this month
                </p>
              )}
            </Card>

            {/* Budget vs Actual table */}
            <Card>
              <p className="text-xs font-medium uppercase tracking-widest text-slate-400 mb-3">
                Budget vs Actual
              </p>
              <div className="space-y-2">
                {Object.entries(EXPENSE_CATEGORIES).map(([key, cat]) => {
                  const spent     = categoryTotals[key] ?? 0
                  const limit     = budgets[key] ?? 0
                  const remaining = limit - spent
                  const pct       = limit > 0 ? Math.min((spent / limit) * 100, 100) : 0
                  const isOver    = spent > limit && limit > 0
                  const isWarn    = pct >= 75 && pct < 100

                  return (
                    <div key={key} className="flex items-center gap-3">
                      {/* Category name */}
                      <p className="text-xs text-slate-600 w-20 flex-shrink-0 truncate">
                        {shortLabel(cat.label)}
                      </p>
                      {/* Progress bar */}
                      <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            isOver ? 'bg-red-500' : isWarn ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      {/* Spent */}
                      <p className={`text-xs font-medium w-14 text-right flex-shrink-0
                        ${isOver ? 'text-red-600' : 'text-slate-700'}`}>
                        {formatCurrency(spent, true)}
                      </p>
                      {/* Remaining */}
                      <p className={`text-xs w-14 text-right flex-shrink-0
                        ${isOver ? 'text-red-500 font-medium' : 'text-slate-400'}`}>
                        {isOver
                          ? `+${formatCurrency(Math.abs(remaining), true)}`
                          : formatCurrency(remaining, true)}
                      </p>
                    </div>
                  )
                })}
              </div>
              <p className="text-xs text-slate-300 mt-3">
                Spent · Remaining (of monthly budget)
              </p>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
