import { useState, useEffect, useMemo } from 'react'
import useStore from '../store/useStore'
import { api } from '../utils/api'
import { formatCurrency, formatDate, daysUntil } from '../utils/formatters'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import {
  CheckCircle,
  Plus,
  X,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Calendar,
  Clock,
  Trash2,
} from 'lucide-react'

// ─── Category constants ──────────────────────────────────────────────────────

const CATEGORY_COLORS = {
  form_submission: 'bg-red-500',
  account_setup: 'bg-indigo-500',
  fd_maturity: 'bg-blue-500',
  lic_premium: 'bg-purple-500',
  chit_completion: 'bg-amber-500',
  employment: 'bg-emerald-500',
  other: 'bg-slate-400',
}

const CATEGORY_LABELS = {
  form_submission: 'Form / Submission',
  account_setup: 'Account Setup',
  fd_maturity: 'FD Maturity',
  lic_premium: 'LIC Premium',
  chit_completion: 'Chit Fund',
  employment: 'Employment',
  other: 'Other',
}

const FILTER_TABS = [
  { key: 'all', label: 'All' },
  { key: 'urgent', label: 'Urgent' },
  { key: 'fd_maturity', label: 'FD Maturities' },
  { key: 'lic_premium', label: 'LIC' },
  { key: 'chit_completion', label: 'Chit' },
  { key: 'other', label: 'Other' },
]

// ─── Component ───────────────────────────────────────────────────────────────

export default function Milestones() {
  // ── Primary data ───────────────────────────────────────────────────────────
  const [milestones, setMilestones] = useState([])
  const [loading, setLoading] = useState(true)

  // ── Filter ─────────────────────────────────────────────────────────────────
  const [activeFilter, setActiveFilter] = useState('all')

  // ── Completed section visibility ───────────────────────────────────────────
  const [showCompleted, setShowCompleted] = useState(false)

  // ── Add modal ──────────────────────────────────────────────────────────────
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [addForm, setAddForm] = useState({
    title: '',
    date: '',
    category: 'other',
    amount: '',
    isUrgent: false,
    isDangerous: false,
    notes: '',
  })
  const [addLoading, setAddLoading] = useState(false)
  const [addError, setAddError] = useState('')

  // ── Per-milestone loading ──────────────────────────────────────────────────
  const [updatingId, setUpdatingId] = useState(null)

  // ── Delete confirmation ────────────────────────────────────────────────────
  const [deleteConfirmId, setDeleteConfirmId] = useState(null)
  const [deletingId, setDeletingId] = useState(null)

  // ── Toast ──────────────────────────────────────────────────────────────────
  const [toast, setToast] = useState(null)

  // ── Store fallback ─────────────────────────────────────────────────────────
  const state = useStore()

  // ── Load on mount ──────────────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true)
    api.milestones
      .getAll()
      .then((data) => {
        const arr = Array.isArray(data) ? data : (data?.milestones ?? [])
        setMilestones(arr)
        setLoading(false)
      })
      .catch(() => {
        setMilestones(state.milestones ?? [])
        setLoading(false)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Toast helper ───────────────────────────────────────────────────────────
  const showToast = (message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 2500)
  }

  // ── Filtering logic ────────────────────────────────────────────────────────
  const filteredMilestones = useMemo(() => {
    if (activeFilter === 'all') return milestones
    if (activeFilter === 'urgent') return milestones.filter((m) => m.isUrgent)
    if (activeFilter === 'fd_maturity')
      return milestones.filter((m) => m.category === 'fd_maturity')
    if (activeFilter === 'lic_premium')
      return milestones.filter((m) => m.category === 'lic_premium')
    if (activeFilter === 'chit_completion')
      return milestones.filter((m) => m.category === 'chit_completion')
    if (activeFilter === 'other')
      return milestones.filter(
        (m) => !['fd_maturity', 'lic_premium', 'chit_completion'].includes(m.category)
      )
    return milestones
  }, [milestones, activeFilter])

  const urgentMilestones = useMemo(
    () =>
      filteredMilestones
        .filter((m) => m.isUrgent && m.status !== 'done')
        .sort((a, b) => new Date(a.date) - new Date(b.date)),
    [filteredMilestones]
  )

  const upcomingMilestones = useMemo(
    () =>
      filteredMilestones
        .filter((m) => m.status === 'pending' && !m.isUrgent)
        .sort((a, b) => new Date(a.date) - new Date(b.date)),
    [filteredMilestones]
  )

  const completedMilestones = useMemo(
    () =>
      filteredMilestones
        .filter((m) => m.status === 'done')
        .sort((a, b) => new Date(b.date) - new Date(a.date)),
    [filteredMilestones]
  )

  const skippedMilestones = useMemo(
    () => filteredMilestones.filter((m) => m.status === 'skipped'),
    [filteredMilestones]
  )

  // ── Status update handler ──────────────────────────────────────────────────
  const handleUpdateStatus = async (id, newStatus) => {
    setUpdatingId(id)
    try {
      await api.milestones.updateStatus(id, newStatus)
      useStore.getState().updateMilestoneStatus(id, newStatus)
      setMilestones((prev) =>
        prev.map((m) => (m.id === id ? { ...m, status: newStatus } : m))
      )
      if (newStatus === 'done') showToast('Milestone completed ✓', 'success')
      if (newStatus === 'skipped') showToast('Milestone marked as skipped', 'success')
      if (newStatus === 'pending') showToast('Milestone reset to pending', 'success')
    } catch {
      showToast('Could not update — try again', 'error')
    }
    setUpdatingId(null)
  }

  // ── Delete handler ─────────────────────────────────────────────────────────
  const handleDelete = async (id) => {
    setDeletingId(id)
    try {
      await api.milestones.remove(id)
      setMilestones((prev) => prev.filter((m) => m.id !== id))
      setDeleteConfirmId(null)
      showToast('Milestone deleted', 'success')
    } catch {
      showToast('Could not delete — try again', 'error')
    }
    setDeletingId(null)
  }

  // ── Add milestone handler ──────────────────────────────────────────────────
  const handleAddMilestone = async () => {
    if (!addForm.title.trim() || !addForm.date) {
      setAddError('Title and date are required.')
      return
    }

    const newMilestone = {
      title: addForm.title.trim(),
      date: addForm.date,
      category: addForm.category,
      status: 'pending',
      amount: addForm.amount ? parseInt(addForm.amount, 10) : null,
      isUrgent: addForm.isUrgent,
      isDangerous: addForm.isDangerous,
      notes: addForm.notes.trim(),
    }

    setAddLoading(true)
    try {
      const created = await api.milestones.add(newMilestone)
      const toAdd = created ?? { ...newMilestone, id: Date.now().toString(36) }
      setMilestones((prev) => [...prev, toAdd])
      setAddModalOpen(false)
      setAddForm({
        title: '',
        date: '',
        category: 'other',
        amount: '',
        isUrgent: false,
        isDangerous: false,
        notes: '',
      })
      setAddError('')
      showToast('Milestone added ✓', 'success')
    } catch {
      setAddError('Could not save — check connection and try again.')
    }
    setAddLoading(false)
  }

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

      {/* ── Page header ── */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-3xl font-bold tracking-tight text-slate-900">Milestones</p>
          <p className="text-xs font-medium text-slate-400 mt-0.5">
            {urgentMilestones.length > 0
              ? `${urgentMilestones.length} urgent action${urgentMilestones.length > 1 ? 's' : ''} needed`
              : 'All urgent actions complete ✓'}
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setAddModalOpen(true)}
        >
          <Plus size={13} className="mr-1" /> Add
        </Button>
      </div>

      {/* ── Filter tabs ── */}
      <div
        className={`flex gap-2 overflow-x-auto pb-1 mb-5 flex-nowrap whitespace-nowrap ${
          loading ? 'pointer-events-none opacity-50' : ''
        }`}
      >
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveFilter(tab.key)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium cursor-pointer
                       flex-shrink-0 transition-colors ${
                         activeFilter === tab.key
                           ? 'bg-indigo-600 text-white'
                           : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                       }`}
          >
            {tab.key === 'all' ? `All (${milestones.length})` : tab.label}
          </button>
        ))}
      </div>

      {/* ── Loading state ── */}
      {loading ? (
        <div className="space-y-3">
          <div className="h-20 bg-slate-100 rounded-2xl animate-pulse" />
          <div className="h-20 bg-slate-100 rounded-2xl animate-pulse" />
          <div className="h-20 bg-slate-100 rounded-2xl animate-pulse" />
          <div className="h-20 bg-slate-100 rounded-2xl animate-pulse" />
          <div className="h-20 bg-slate-100 rounded-2xl animate-pulse" />
        </div>
      ) : (
        <>
          {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          {/* SECTION 1 — URGENT                                          */}
          {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          
          {/* Desktop 2-column layout wrapper */}
          <div className="lg:grid lg:grid-cols-2 lg:gap-6 lg:items-start">
            <div>
          {urgentMilestones.length > 0 && (
            <>
              <div className="bg-gradient-to-br from-red-950 via-slate-900 to-slate-900 -mx-4 px-4 pt-4 pb-6 mb-4 lg:mx-0 lg:rounded-2xl">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse flex-shrink-0" />
                  <p className="text-sm font-bold text-white">Urgent — Act Now</p>
                  <Badge color="red">{urgentMilestones.length}</Badge>
                </div>
              </div>

              {urgentMilestones.map((m) => {
                const days = daysUntil(m.date)
                const isOverdue = days !== null && days < 0

                return (
                  <div
                    key={m.id}
                    className="bg-white border-l-4 border-red-500 rounded-r-2xl shadow-sm p-4 mb-3"
                  >
                    <div>
                      {/* Title row */}
                      <div className="flex items-start gap-2 mb-2">
                        <p className="text-sm font-semibold text-slate-800 leading-snug flex-1">
                          {m.title}
                        </p>
                      </div>

                      {/* Dangerous warning banner */}
                      {m.isDangerous && (
                        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
                          <AlertTriangle
                            size={14}
                            className="text-amber-500 flex-shrink-0 mt-0.5"
                          />
                          <p className="text-xs text-amber-700 font-medium">
                            ⚠ Missing this creates a difficult-to-fix problem
                          </p>
                        </div>
                      )}

                      {/* Meta row */}
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="flex items-center gap-1">
                            <Calendar size={12} className="text-slate-400" />
                            <p className="text-xs text-slate-500">
                              {formatDate(m.date)}
                            </p>
                          </div>
                          <Badge
                            color={
                              isOverdue
                                ? 'red'
                                : days <= 7
                                ? 'red'
                                : 'amber'
                            }
                          >
                            {isOverdue
                              ? `${Math.abs(days)}d overdue`
                              : days === 0
                              ? 'Due today'
                              : `${days} days`}
                          </Badge>
                          {m.amount != null && (
                            <p className="text-xs font-medium text-slate-600">
                              {formatCurrency(m.amount, true)}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Notes */}
                      {m.notes && (
                        <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                          {m.notes}
                        </p>
                      )}

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 mt-3">
                        <Button
                          variant="primary"
                          size="sm"
                          loading={updatingId === m.id}
                          onClick={() => handleUpdateStatus(m.id, 'done')}
                        >
                          <CheckCircle size={13} className="mr-1" /> Mark Done ✓
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleUpdateStatus(m.id, 'skipped')}
                          disabled={updatingId === m.id}
                        >
                          Skip
                        </Button>
                        {deleteConfirmId === m.id ? (
                          <div className="flex gap-1 ml-auto">
                            <Button
                              size="sm"
                              variant="danger"
                              loading={deletingId === m.id}
                              onClick={() => handleDelete(m.id)}
                            >
                              Delete
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setDeleteConfirmId(null)}
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirmId(m.id)}
                            className="ml-auto p-1.5 rounded-lg text-slate-300
                                       hover:text-red-400 hover:bg-red-50 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </>
          )}

          {/* No urgent actions */}
          {urgentMilestones.length === 0 &&
            (activeFilter === 'all' || activeFilter === 'urgent') && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 mb-4">
                <div className="flex items-center gap-2">
                  <CheckCircle size={16} className="text-emerald-600" />
                  <p className="text-sm font-medium text-emerald-700">
                    No urgent actions pending
                  </p>
                </div>
              </div>
            )}

          <div className="mb-6" />

          {/* Close first column, open second */}
          </div>
          <div>

          {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          {/* SECTION 2 — UPCOMING (timeline layout)                      */}
          {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          <p className="text-xs font-medium uppercase tracking-widest text-slate-400 mb-3">
            Upcoming
            {upcomingMilestones.length > 0
              ? ` (${upcomingMilestones.length})`
              : ''}
          </p>

          {upcomingMilestones.length > 0 ? (
            <div className="relative border-l-2 border-slate-100 pl-5 ml-1">
              {upcomingMilestones.map((m) => {
                const days = daysUntil(m.date)
                const isOverdue = days !== null && days < 0

                return (
                  <div key={m.id} className="relative pb-5">
                    {/* Timeline dot */}
                    <div
                      className="absolute -left-[26px] mt-1.5 w-2 h-2 rounded-full bg-indigo-500 ring-4 ring-slate-50 flex-shrink-0"
                    />

                    {/* Card */}
                    <div className="bg-white rounded-xl border border-slate-200 p-3.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-800 leading-snug">
                            {m.title}
                          </p>
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <div className="flex items-center gap-1">
                              <Calendar size={11} className="text-slate-400" />
                              <p className="text-xs text-slate-500">
                                {formatDate(m.date)}
                              </p>
                            </div>
                            <Badge
                              color={
                                isOverdue
                                  ? 'red'
                                  : days <= 30
                                  ? 'amber'
                                  : 'slate'
                              }
                            >
                              {isOverdue
                                ? `${Math.abs(days)}d overdue`
                                : days === 0
                                ? 'Today'
                                : `${days}d`}
                            </Badge>
                            {m.amount != null && (
                              <p className="text-xs text-slate-500">
                                {formatCurrency(m.amount, true)}
                              </p>
                            )}
                          </div>
                        </div>
                        <Badge color="slate">
                          {CATEGORY_LABELS[m.category] ?? m.category}
                        </Badge>
                      </div>

                      {/* Dangerous warning */}
                      {m.isDangerous && (
                        <div className="flex items-center gap-1.5 mt-2 bg-amber-50 rounded-lg px-2.5 py-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
                          <p className="text-xs text-amber-700 font-medium">
                            ⚠ Missing this creates a difficult-to-fix problem
                          </p>
                        </div>
                      )}

                      {m.notes && (
                        <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                          {m.notes}
                        </p>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-2 mt-3">
                        <Button
                          size="sm"
                          variant="secondary"
                          loading={updatingId === m.id}
                          onClick={() => handleUpdateStatus(m.id, 'done')}
                        >
                          <CheckCircle size={12} className="mr-1" /> Done
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={updatingId === m.id}
                          onClick={() => handleUpdateStatus(m.id, 'skipped')}
                        >
                          Skip
                        </Button>
                        {deleteConfirmId === m.id ? (
                          <div className="flex gap-1 ml-auto">
                            <Button
                              size="sm"
                              variant="danger"
                              loading={deletingId === m.id}
                              onClick={() => handleDelete(m.id)}
                            >
                              Delete
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setDeleteConfirmId(null)}
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirmId(m.id)}
                            className="ml-auto p-1.5 rounded-lg text-slate-300
                                       hover:text-red-400 hover:bg-red-50 transition-colors"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-slate-400 text-center py-6">
              No upcoming milestones in this category.
            </p>
          )}

          <div className="mb-6" />

          {/* Close second column and grid wrapper */}
          </div>
          </div>

          {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          {/* SECTION 3 — COMPLETED (collapsed by default)                */}
          {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          <button
            onClick={() => setShowCompleted((p) => !p)}
            className="w-full flex items-center justify-between py-3 px-4
                       rounded-xl bg-slate-100 hover:bg-slate-200 transition-colors mb-3"
          >
            <div className="flex items-center gap-2">
              <CheckCircle size={16} className="text-emerald-600" />
              <p className="text-sm font-medium text-slate-700">
                Completed ({completedMilestones.length})
              </p>
            </div>
            {showCompleted ? (
              <ChevronUp size={16} className="text-slate-400" />
            ) : (
              <ChevronDown size={16} className="text-slate-400" />
            )}
          </button>

          {showCompleted &&
            completedMilestones.map((m) => (
              <div
                key={m.id}
                className="flex items-start gap-3 py-3 px-4 mb-2
                           bg-white rounded-xl border border-slate-100 opacity-70"
              >
                <CheckCircle
                  size={16}
                  className="text-emerald-500 flex-shrink-0 mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 line-through truncate">
                    {m.title}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-xs text-slate-400">{formatDate(m.date)}</p>
                    <Badge color="green">Done</Badge>
                    {m.amount != null && (
                      <p className="text-xs text-slate-400">
                        {formatCurrency(m.amount, true)}
                      </p>
                    )}
                  </div>
                  {m.notes && (
                    <p className="text-xs text-slate-300 mt-1">{m.notes}</p>
                  )}
                </div>
                <button
                  onClick={() => handleUpdateStatus(m.id, 'pending')}
                  className="p-1 rounded text-slate-300 hover:text-indigo-500
                             hover:bg-indigo-50 flex-shrink-0 transition-colors"
                  title="Reset to pending"
                >
                  <Clock size={14} />
                </button>
              </div>
            ))}

          <div className="mb-6" />

          {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          {/* SECTION 4 — SKIPPED (minimal, conditional)                  */}
          {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          {skippedMilestones.length > 0 && (
            <div className="mb-6">
              <p className="text-xs font-medium text-slate-400 mb-2 uppercase tracking-wide">
                Skipped ({skippedMilestones.length})
              </p>
              {skippedMilestones.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center gap-2 py-2 px-3 mb-1.5
                             bg-slate-50 rounded-lg opacity-60"
                >
                  <p className="text-xs text-slate-500 flex-1 truncate">
                    {m.title}
                  </p>
                  <button
                    onClick={() => handleUpdateStatus(m.id, 'pending')}
                    className="text-xs text-indigo-500 hover:underline flex-shrink-0"
                  >
                    Restore
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Bottom padding */}
      <div className="h-8" />

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/* ADD MILESTONE MODAL                                            */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {addModalOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 z-50"
            onClick={() => {
              setAddModalOpen(false)
              setAddError('')
            }}
          />

          {/* Modal */}
          <div className="fixed inset-x-4 top-16 bottom-16 bg-white rounded-2xl z-50 shadow-xl flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-100 flex-shrink-0">
              <p className="text-base font-semibold text-slate-800">
                Add Milestone
              </p>
              <button
                onClick={() => {
                  setAddModalOpen(false)
                  setAddError('')
                }}
                className="p-1 rounded-lg hover:bg-slate-100"
              >
                <X size={20} className="text-slate-500" />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Title */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={addForm.title}
                  onChange={(e) =>
                    setAddForm((p) => ({ ...p, title: e.target.value }))
                  }
                  placeholder="e.g. Renew Canara Bank FD"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm
                             focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  maxLength={100}
                />
              </div>

              {/* Date */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={addForm.date}
                  onChange={(e) =>
                    setAddForm((p) => ({ ...p, date: e.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm
                             focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Category
                </label>
                <select
                  value={addForm.category}
                  onChange={(e) =>
                    setAddForm((p) => ({ ...p, category: e.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm
                             focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {Object.entries(CATEGORY_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Amount */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Amount (optional)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                    ₹
                  </span>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={addForm.amount}
                    onChange={(e) =>
                      setAddForm((p) => ({ ...p, amount: e.target.value }))
                    }
                    placeholder="Leave blank if not applicable"
                    className="w-full rounded-lg border border-slate-200 pl-7 pr-3 py-2 text-sm
                               focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Toggles */}
              <div className="space-y-2">
                {/* isUrgent toggle */}
                <div className="flex items-center justify-between py-2.5 px-3 bg-slate-50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-slate-700">Urgent</p>
                    <p className="text-xs text-slate-400">
                      Appears in the red urgent section
                    </p>
                  </div>
                  <button
                    onClick={() =>
                      setAddForm((p) => ({ ...p, isUrgent: !p.isUrgent }))
                    }
                    className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0
                      ${addForm.isUrgent ? 'bg-red-500' : 'bg-slate-200'}`}
                  >
                    <span
                      className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow
                        transition-transform ${addForm.isUrgent ? 'translate-x-5' : 'translate-x-0.5'}`}
                    />
                  </button>
                </div>

                {/* isDangerous toggle */}
                <div className="flex items-center justify-between py-2.5 px-3 bg-slate-50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-slate-700">
                      Dangerous if missed
                    </p>
                    <p className="text-xs text-slate-400">
                      Shows amber warning on the card
                    </p>
                  </div>
                  <button
                    onClick={() =>
                      setAddForm((p) => ({
                        ...p,
                        isDangerous: !p.isDangerous,
                      }))
                    }
                    className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0
                      ${addForm.isDangerous ? 'bg-amber-500' : 'bg-slate-200'}`}
                  >
                    <span
                      className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow
                        transition-transform ${addForm.isDangerous ? 'translate-x-5' : 'translate-x-0.5'}`}
                    />
                  </button>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Notes
                </label>
                <textarea
                  value={addForm.notes}
                  onChange={(e) =>
                    setAddForm((p) => ({ ...p, notes: e.target.value }))
                  }
                  placeholder="Any additional context or action steps..."
                  rows={3}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm
                             focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  maxLength={300}
                />
              </div>

              {/* Error */}
              {addError && (
                <p className="text-xs text-red-600 font-medium">{addError}</p>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-100 flex gap-2 flex-shrink-0">
              <Button
                variant="ghost"
                size="md"
                className="flex-1"
                onClick={() => {
                  setAddModalOpen(false)
                  setAddError('')
                }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="md"
                className="flex-1"
                loading={addLoading}
                onClick={handleAddMilestone}
              >
                Add Milestone
              </Button>
            </div>
          </div>
        </>
      )}
    </>
  )
}
