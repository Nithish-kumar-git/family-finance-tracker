import { useState, useMemo } from 'react'
import useStore from '../store/useStore'
import { formatCurrency } from '../utils/formatters'
import {
  getCategorySpent,
  getBudgetPctUsed,
  getMonthlyExpensesTotal,
} from '../utils/calculations'
import { EXPENSE_CATEGORIES } from '../data/seedData'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import {
  ShoppingCart,
  Zap,
  Heart,
  Car,
  Home,
  Shield,
  Users,
  User,
  BookOpen,
  MoreHorizontal,
  AlertTriangle,
  CheckCircle,
  Edit2,
  X,
} from 'lucide-react'

// ─── Constants ───────────────────────────────────────────────────────────────

const BUDGET_TARGET = 85800 // family's known monthly expense target — constant

const now = new Date()
const year = now.getFullYear()
const month = now.getMonth() + 1

// Icon map — re-implemented locally; pages must not import other pages
const iconMap = {
  ShoppingCart,
  Zap,
  Heart,
  Car,
  Home,
  Shield,
  Users,
  User,
  BookOpen,
  MoreHorizontal,
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function Budgets() {
  // ── Store reads ────────────────────────────────────────────────────────────
  const state = useStore()
  const budgets = state.budgets

  // ── Local state ────────────────────────────────────────────────────────────
  const [editingCategory, setEditingCategory] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [editAllOpen, setEditAllOpen] = useState(false)
  const [modalValues, setModalValues] = useState({})
  const [modalSaving, setModalSaving] = useState(false)
  const [toast, setToast] = useState(null)

  // ── Toast helper ───────────────────────────────────────────────────────────
  const showToast = (message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 2000)
  }

  // ── Derived values ─────────────────────────────────────────────────────────
  const totalSpent = useMemo(
    () => getMonthlyExpensesTotal(state, year, month),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.expenses]
  )

  const totalBudgeted = useMemo(
    () => Object.values(budgets).reduce((sum, v) => sum + v, 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.budgets]
  )

  const categoryData = useMemo(
    () =>
      Object.entries(EXPENSE_CATEGORIES).map(([key, cat]) => {
        const limit = budgets[key] ?? 0
        const spent = getCategorySpent(state, key, year, month)
        const pct = getBudgetPctUsed(state, key, year, month)
        const remaining = limit - spent
        const isOver = spent > limit && limit > 0
        const isWarn = pct >= 75 && pct < 100
        const isChit = key === 'chit_contribution'
        return { key, cat, limit, spent, pct, remaining, isOver, isWarn, isChit }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.expenses, state.budgets]
  )

  // ── Inline edit handlers ───────────────────────────────────────────────────
  const startInlineEdit = (key, limit) => {
    setEditingCategory(key)
    setEditValue(String(limit))
  }

  const saveInlineEdit = (key) => {
    const parsed = parseInt(editValue, 10)
    if (isNaN(parsed) || parsed < 0) {
      showToast('Enter a valid amount (0 or more)', 'error')
      return
    }
    useStore.getState().updateBudget(key, parsed)
    setEditingCategory(null)
    showToast('Budget updated', 'success')
  }

  // ── Edit All modal handlers ────────────────────────────────────────────────
  const openEditAllModal = () => {
    setModalValues(
      Object.fromEntries(
        Object.keys(EXPENSE_CATEGORIES).map((k) => [k, String(budgets[k] ?? 0)])
      )
    )
    setEditAllOpen(true)
  }

  const handleSaveAllBudgets = async () => {
    // 1. Validate
    const invalids = Object.entries(modalValues).filter(([, v]) => {
      const n = parseInt(v, 10)
      return isNaN(n) || n < 0
    })
    if (invalids.length > 0) {
      showToast('All budget amounts must be 0 or more', 'error')
      return
    }
    // 2. Loading state
    setModalSaving(true)
    // 3. Brief UX delay
    await new Promise((resolve) => setTimeout(resolve, 300))
    // 4. Save each category
    Object.entries(modalValues).forEach(([key, val]) => {
      useStore.getState().updateBudget(key, parseInt(val, 10))
    })
    // 5-7. Finish
    setModalSaving(false)
    setEditAllOpen(false)
    showToast('All budgets saved ✓', 'success')
  }

  // ── Section 1 derived values ───────────────────────────────────────────────
  const totalPct = Math.min((totalSpent / BUDGET_TARGET) * 100, 100)
  const totalBarColor =
    totalPct >= 100 ? 'bg-red-500' : totalPct >= 80 ? 'bg-amber-500' : 'bg-emerald-500'
  const totalTextColor = totalPct >= 100 ? 'text-red-600' : 'text-slate-800'

  // ── Section 4 derived values ───────────────────────────────────────────────
  const untracked = BUDGET_TARGET - totalBudgeted

  // ── Section 5 derived values ───────────────────────────────────────────────
  const overBudget = categoryData.filter((d) => d.isOver)
  const nearLimit = categoryData.filter((d) => d.isWarn && !d.isOver)

  // ── Modal running total ────────────────────────────────────────────────────
  const modalTotal = Object.values(modalValues).reduce(
    (sum, v) => sum + (parseInt(v, 10) || 0),
    0
  )
  const modalDiff = BUDGET_TARGET - modalTotal
  const modalPct = Math.min((modalTotal / BUDGET_TARGET) * 100, 100)

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

      {/* ── Section 1 — Month total card ── */}
      <Card className="mb-4">
        <p className="text-xs font-medium uppercase tracking-widest text-slate-400 mb-1">
          {new Date(year, month - 1).toLocaleDateString('en-IN', {
            month: 'long',
            year: 'numeric',
          })}{' '}
          Budget
        </p>
        <div className="flex items-end justify-between mb-3">
          <p className={`text-3xl font-bold tracking-tight ${totalTextColor}`}>
            {formatCurrency(totalSpent)}
          </p>
          <div className="text-right">
            <Badge
              color={
                totalPct >= 100 ? 'red' : totalPct >= 80 ? 'amber' : 'green'
              }
            >
              {totalPct.toFixed(0)}% used
            </Badge>
            <p className="text-xs text-slate-400 mt-1">of {formatCurrency(BUDGET_TARGET)}</p>
          </div>
        </div>
        <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${totalBarColor}`}
            style={{ width: `${totalPct}%` }}
          />
        </div>
        <p className="text-xs text-slate-400 mt-1.5">
          {totalPct >= 100
            ? `Over budget by ${formatCurrency(totalSpent - BUDGET_TARGET)}`
            : `${formatCurrency(BUDGET_TARGET - totalSpent)} left in monthly budget`}
        </p>
      </Card>

      {/* ── Section 2 — Edit All button ── */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium uppercase tracking-widest text-slate-400">Category Budgets</p>
        <Button variant="secondary" size="sm" onClick={() => openEditAllModal()}>
          <Edit2 size={13} className="mr-1.5" /> Edit All
        </Button>
      </div>

      {/* ── Section 3 — Category rows ── */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {categoryData.map(({ key, cat, limit, spent, pct, isOver, isWarn, isChit }) => {
          const IconComponent = iconMap[cat.icon]
          const barColor = isOver
            ? 'bg-red-500'
            : isWarn
            ? 'bg-amber-500'
            : 'bg-emerald-500'

          return (
            <div key={key}>
              <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
                {/* Icon */}
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: cat.color + '20', color: cat.color }}
                >
                  {IconComponent && <IconComponent size={15} />}
                </div>

                {/* Middle: label + progress bar */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 truncate">
                    {cat.label}
                  </p>
                  <div className="h-1.5 rounded-full bg-slate-100 mt-1 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${barColor}`}
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                </div>

                {/* Right: inline edit or spend/limit figures */}
                <div className="flex-shrink-0">
                  {editingCategory === key ? (
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-slate-400">₹</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveInlineEdit(key)
                          if (e.key === 'Escape') setEditingCategory(null)
                        }}
                        autoFocus
                        className="w-20 text-sm border border-violet-300 rounded-lg px-2 py-1
                                   focus:outline-none focus:ring-2 focus:ring-violet-500 text-right"
                      />
                      <button
                        onClick={() => saveInlineEdit(key)}
                        className="p-1 text-emerald-600 hover:bg-emerald-50 rounded-lg"
                      >
                        <CheckCircle size={16} />
                      </button>
                      <button
                        onClick={() => setEditingCategory(null)}
                        className="p-1 text-slate-400 hover:bg-slate-100 rounded-lg"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <div className="text-right">
                      <button
                        onClick={() => startInlineEdit(key, limit)}
                        className="group text-right"
                      >
                        <p
                          className={`text-sm font-semibold ${
                            isOver ? 'text-red-600' : 'text-slate-800'
                          }`}
                        >
                          {formatCurrency(spent)}
                        </p>
                        <p className="text-xs text-slate-400 group-hover:text-violet-500 transition-colors">
                          / {formatCurrency(limit)}
                        </p>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Chit contribution amber warning (below row, outside row flex) */}
              {isChit && limit === 0 && (
                <div className="flex items-center gap-1.5 px-4 pb-2 -mt-1">
                  <AlertTriangle size={12} className="text-amber-500 flex-shrink-0" />
                  <p className="text-xs text-amber-600">
                    Verify monthly chit amount with Nadar Sangam organiser
                  </p>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ── Section 4 — Untracked amount card ── */}
      <Card
        className={`mt-4 ${
          untracked < 0
            ? 'border-red-200 bg-red-50'
            : untracked > 0
            ? 'border-amber-200 bg-amber-50'
            : 'border-emerald-200 bg-emerald-50'
        }`}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-700">
              {untracked < 0
                ? '⚠ Over-budgeted'
                : untracked > 0
                ? 'Unbudgeted amount'
                : '✓ Budget fully allocated'}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              {untracked < 0
                ? `Category limits total ${formatCurrency(totalBudgeted)} — exceeds ₹85,800 target by ${formatCurrency(Math.abs(untracked))}`
                : untracked > 0
                ? `${formatCurrency(untracked)} not assigned to any category`
                : 'All ₹85,800 is assigned across categories'}
            </p>
          </div>
          <p
            className={`text-lg font-bold flex-shrink-0 ml-3 ${
              untracked < 0
                ? 'text-red-600'
                : untracked > 0
                ? 'text-amber-600'
                : 'text-emerald-600'
            }`}
          >
            {untracked < 0 ? '−' : '+'}{formatCurrency(Math.abs(untracked), true)}
          </p>
        </div>
        {untracked > 0 && (
          <p className="text-xs text-amber-600 mt-2">
            Tip: assign the unbudgeted amount to a category, or add it to "Other"
            so your total matches the ₹85,800 monthly target.
          </p>
        )}
        {untracked < 0 && (
          <p className="text-xs text-red-600 mt-2">
            Reduce category limits until the total equals ₹85,800.
          </p>
        )}
      </Card>

      {/* ── Section 5 — Alerts ── */}
      {(overBudget.length > 0 || nearLimit.length > 0) && (
        <div className="mt-4 space-y-2">
        <p className="text-sm font-semibold text-slate-700">Alerts</p>

          {overBudget.map((d) => (
            <Card key={d.key} danger className="py-3">
              <div className="flex items-start gap-2">
                <AlertTriangle
                  size={16}
                  className="text-red-500 flex-shrink-0 mt-0.5"
                />
                <div>
                  <p className="text-sm font-semibold text-red-700">
                    {d.cat.label} overspent by {formatCurrency(Math.abs(d.remaining))}
                  </p>
                  <p className="text-xs text-red-500 mt-0.5">
                    Spent {formatCurrency(d.spent)} of {formatCurrency(d.limit)} limit
                  </p>
                </div>
              </div>
            </Card>
          ))}

          {nearLimit.map((d) => (
            <div
              key={d.key}
              className="rounded-xl border border-amber-200 bg-amber-50 p-3"
            >
              <div className="flex items-start gap-2">
                <AlertTriangle
                  size={16}
                  className="text-amber-500 flex-shrink-0 mt-0.5"
                />
                <div>
                  <p className="text-sm font-semibold text-amber-700">
                    {d.cat.label} is {formatCurrency(d.remaining)} from limit
                  </p>
                  <p className="text-xs text-amber-600 mt-0.5">
                    {d.pct.toFixed(0)}% used — {formatCurrency(d.spent)} of{' '}
                    {formatCurrency(d.limit)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Bottom padding */}
      <div className="h-8" />

      {/* ── Section 6 — Edit All modal ── */}
      {editAllOpen && (
        <div className="fixed inset-0 bg-white z-50 flex flex-col">
          {/* Modal header */}
          <div className="flex items-center justify-between px-4 py-4 border-b border-slate-100 flex-shrink-0">
            <div>
              <p className="text-base font-semibold text-slate-900">Edit All Budgets</p>
              <p className="text-xs text-slate-400 mt-0.5">Target: ₹85,800/month</p>
            </div>
            <button
              onClick={() => setEditAllOpen(false)}
              className="p-2 rounded-xl hover:bg-slate-100"
            >
              <X size={20} className="text-slate-500" />
            </button>
          </div>

          {/* Running total bar */}
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex-shrink-0">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs text-slate-500">Total budgeted</p>
              <p
                className={`text-sm font-bold ${
                  modalDiff < 0
                    ? 'text-red-600'
                    : modalDiff === 0
                    ? 'text-emerald-600'
                    : 'text-amber-600'
                }`}
              >
                {formatCurrency(modalTotal, true)}{' '}
                <span className="text-xs font-normal">
                  {modalDiff < 0
                    ? `(+${formatCurrency(Math.abs(modalDiff), true)} over)`
                    : modalDiff > 0
                    ? `(${formatCurrency(modalDiff, true)} unallocated)`
                    : '✓'}
                </span>
              </p>
            </div>
            <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  modalTotal > BUDGET_TARGET
                    ? 'bg-red-500'
                    : modalTotal === BUDGET_TARGET
                    ? 'bg-emerald-500'
                    : 'bg-amber-500'
                }`}
                style={{ width: `${modalPct}%` }}
              />
            </div>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-4 py-2">
            {Object.entries(EXPENSE_CATEGORIES).map(([key, cat]) => {
              const IconComponent = iconMap[cat.icon]
              const isChit = key === 'chit_contribution'
              return (
                <div key={key} className="py-3 border-b border-slate-50">
                  <div className="flex items-center gap-3">
                    {/* Icon */}
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: cat.color + '20', color: cat.color }}
                    >
                      {IconComponent && <IconComponent size={15} />}
                    </div>
                    {/* Label */}
                    <p className="flex-1 text-sm font-medium text-slate-700">
                      {cat.label}
                    </p>
                    {/* Input */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <span className="text-sm text-slate-400">₹</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        value={modalValues[key] ?? ''}
                        onChange={(e) =>
                          setModalValues((prev) => ({
                            ...prev,
                            [key]: e.target.value,
                          }))
                        }
                        className="w-24 text-sm border border-slate-200 rounded-lg
                                   px-2 py-1.5 text-right focus:outline-none
                                   focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                  {/* Chit warning in modal */}
                  {isChit && (parseInt(modalValues[key], 10) || 0) === 0 && (
                    <div className="flex items-center gap-1.5 mt-1.5 ml-11">
                      <AlertTriangle size={11} className="text-amber-500" />
                      <p className="text-xs text-amber-600">
                        Verify with Nadar Sangam before setting this amount
                      </p>
                    </div>
                  )}
                </div>
              )
            })}
            {/* Bottom padding so last item not hidden by save button */}
            <div className="h-4" />
          </div>

          {/* Footer */}
          <div className="px-4 py-4 border-t border-slate-100 bg-white flex-shrink-0">
            <Button
              variant="primary"
              size="lg"
              className="w-full"
              loading={modalSaving}
              onClick={handleSaveAllBudgets}
            >
              Save Budgets
            </Button>
          </div>
        </div>
      )}
    </>
  )
}
