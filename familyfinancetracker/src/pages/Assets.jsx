import { useState, useEffect } from 'react'
import useStore from '../store/useStore'
import { useAssets } from '../hooks/useAssets'
import { api } from '../utils/api'
import { formatCurrency, formatDate, daysUntil } from '../utils/formatters'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import {
  Lock,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Plus,
  X,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  Landmark,
  Coins,
  Shield,
  Users,
  Edit2,
} from 'lucide-react'

// ─── Tab config ──────────────────────────────────────────────────────────────

const TABS = [
  { key: 'fd', label: 'FDs' },
  { key: 'mf', label: 'Funds' },
  { key: 'lic', label: 'LIC' },
  { key: 'chit', label: 'Chits' },
  { key: 'gold', label: 'Gold' },
]

// ─── Component ───────────────────────────────────────────────────────────────

export default function Assets() {
  // ── Tab state ──────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('fd')

  // ── Primary data state (loaded from API) ───────────────────────────────────
  const [fixedDeposits, setFixedDeposits] = useState([])
  const [mutualFunds, setMutualFunds] = useState([])
  const [licPolicies, setLicPolicies] = useState([])
  const [chitFunds, setChitFunds] = useState([])
  const [loading, setLoading] = useState(true)

  // ── Expanded card state ────────────────────────────────────────────────────
  const [expandedId, setExpandedId] = useState(null)

  // ── Modal state (shared — one modal at a time) ─────────────────────────────
  const [modal, setModal] = useState(null)
  const [modalForm, setModalForm] = useState({})
  const [modalLoading, setModalLoading] = useState(false)
  const [modalError, setModalError] = useState('')

  // ── Toast ──────────────────────────────────────────────────────────────────
  const [toast, setToast] = useState(null)

  // ── Gold form (inline on Gold tab) ─────────────────────────────────────────
  const [goldForm, setGoldForm] = useState({ weightGrams: '', currentValuePerGram: '' })
  const [goldSaving, setGoldSaving] = useState(false)

  // ── LIC per-card loading ───────────────────────────────────────────────────
  const [licLoadingId, setLicLoadingId] = useState(null)

  // ── Store reads (gold + emergency fund) ────────────────────────────────────
  const state = useStore()
  const gold = state.gold
  const emergencyFund = state.emergencyFund

  const { loadAssets, getTotalCorpus, getUpcomingFDMaturities, getUpcomingLICDues } =
    useAssets()

  // ── Load on mount ──────────────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true)
    loadAssets().then((data) => {
      setFixedDeposits(data.fixedDeposits ?? [])
      setMutualFunds(data.mutualFunds ?? [])
      setLicPolicies(data.licPolicies ?? [])
      setChitFunds(data.chitFunds ?? [])
      setLoading(false)
    })
    setGoldForm({
      weightGrams: String(gold.weightGrams),
      currentValuePerGram: String(gold.currentValuePerGram),
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Toast helper ───────────────────────────────────────────────────────────
  const showToast = (message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 2500)
  }

  // ── Modal helpers ──────────────────────────────────────────────────────────
  const openModal = (type, data = {}) => {
    setModal({ type, data })
    setModalForm(data)
    setModalError('')
  }
  const closeModal = () => {
    setModal(null)
    setModalForm({})
    setModalError('')
  }

  // ── FD handlers ────────────────────────────────────────────────────────────
  const handleDeleteFD = async (id) => {
    try {
      await api.assets.deleteFD(id)
    } catch {
      showToast('Save failed. Changes were NOT saved to server.', 'error')
      return
    }
    setFixedDeposits((prev) => prev.filter((fd) => fd.id !== id))
    useStore.setState(state => ({
      fixedDeposits: state.fixedDeposits.filter(fd => fd.id !== id),
    }))
    setExpandedId(null)
    showToast('FD removed ✓', 'success')
  }

  const handleSaveFD = async () => {
    const principal = parseInt(modalForm.principal, 10)
    const rate = parseFloat(modalForm.rate)
    if (!principal || principal <= 0 || !rate || rate <= 0 || !modalForm.maturityDate) {
      setModalError('Principal, rate, and maturity date are required.')
      return
    }
    setModalLoading(true)
    const body = {
      bank: modalForm.bank || 'Canara Bank',
      principal,
      rate,
      startDate: modalForm.startDate || null,
      maturityDate: modalForm.maturityDate,
      purpose: modalForm.purpose || 'core',
      notes: modalForm.notes || null,
      holders: typeof modalForm.holders === 'string'
        ? modalForm.holders.split(',').map(h => h.trim()).filter(Boolean)
        : [modalForm.holders || 'mother'],
    }
    let saved
    try {
      saved = await api.assets.createFD(body)
    } catch {
      showToast('Save failed. Changes were NOT saved to server.', 'error')
      setModalLoading(false)
      return
    }
    setFixedDeposits((prev) => [...prev, saved])
    useStore.setState(state => ({
      fixedDeposits: [...state.fixedDeposits, saved],
    }))
    setModalLoading(false)
    closeModal()
    showToast('FD added ✓', 'success')
  }

  // ── MF handlers ────────────────────────────────────────────────────────────
  const handleSaveMFValue = async () => {
    const currentVal = parseFloat(modalForm.currentValue)
    const investedVal = parseFloat(modalForm.investedAmount)
    if (isNaN(currentVal) || currentVal < 0) {
      setModalError('Enter a valid current value')
      return
    }
    setModalLoading(true)
    const investedArg = (!isNaN(investedVal) && investedVal >= 0) ? investedVal : undefined
    let saved
    try {
      saved = await api.assets.updateMutualFundValue(modalForm.id, currentVal, investedArg)
    } catch {
      showToast('Save failed. Changes were NOT saved to server.', 'error')
      setModalLoading(false)
      return
    }
    setMutualFunds(prev => prev.map(mf => mf.id === saved.id ? saved : mf))
    useStore.setState(state => ({
      mutualFunds: state.mutualFunds.map(mf => mf.id === saved.id ? saved : mf)
    }))
    setModalLoading(false)
    closeModal()
    showToast('Fund updated ✓', 'success')
  }

  // ── LIC handlers ──────────────────────────────────────────────────────────
  const handleMarkLICPaid = async (id, amount) => {
    setLicLoadingId(id)
    try {
      const updated = await api.assets.markLICPaid(id)
      setLicPolicies((prev) =>
        prev.map((l) => (l.id === id ? { ...updated, id } : l))
      )
      showToast(`Payment of ${formatCurrency(amount)} recorded ✓`, 'success')
    } catch {
      showToast('Could not record payment — try again', 'error')
    }
    setLicLoadingId(null)
  }

  // ── Chit handlers ──────────────────────────────────────────────────────────
  const handleUpdateChitStatus = async (id, newStatus) => {
    try {
      await api.assets.updateChitStatus(id, newStatus)
    } catch {
      showToast('Save failed. Changes were NOT saved to server.', 'error')
      return
    }
    setChitFunds((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status: newStatus } : c))
    )
    useStore.setState(state => ({
      chitFunds: state.chitFunds.map(c =>
        c.id === id ? { ...c, status: newStatus } : c
      ),
    }))
  }

  const handleDeleteChit = async (id) => {
    try {
      await api.assets.deleteChit(id)
    } catch {
      showToast('Save failed. Changes were NOT saved to server.', 'error')
      return
    }
    setChitFunds((prev) => prev.filter((c) => c.id !== id))
    useStore.setState(state => ({
      chitFunds: state.chitFunds.filter(c => c.id !== id),
    }))
    showToast('Chit removed ✓', 'success')
  }

  const handleSaveChit = async () => {
    const expectedPrize = parseInt(modalForm.expectedPrize, 10)
    if (!expectedPrize || expectedPrize <= 0 || !modalForm.completionDate) {
      setModalError('Expected prize and completion date are required.')
      return
    }
    setModalLoading(true)
    const body = {
      organizer: modalForm.organizer || 'Nadar Sangam',
      monthlyContribution: parseInt(modalForm.monthlyContribution, 10) || 0,
      expectedPrize,
      completionDate: modalForm.completionDate,
      status: 'active',
      notes: modalForm.notes || null,
    }
    let saved
    try {
      saved = await api.assets.createChit(body)
    } catch {
      showToast('Save failed. Changes were NOT saved to server.', 'error')
      setModalLoading(false)
      return
    }
    setChitFunds((prev) => [...prev, saved])
    useStore.setState(state => ({
      chitFunds: [...state.chitFunds, saved],
    }))
    setModalLoading(false)
    closeModal()
    showToast('Chit added ✓', 'success')
  }

  // ── FD edit handler ────────────────────────────────────────────────────────
  const handleEditFD = (fd) => {
    openModal('editFD', {
      ...fd,
      holders: Array.isArray(fd.holders) ? fd.holders.join(', ') : (fd.holders ?? 'mother'),
    })
  }

  const handleSaveEditFD = async () => {
    const principal = parseInt(modalForm.principal, 10)
    const rate = parseFloat(modalForm.rate)
    if (!principal || principal <= 0 || !rate || rate <= 0 || !modalForm.maturityDate) {
      setModalError('Principal, rate, and maturity date required.')
      return
    }
    setModalLoading(true)
    const body = {
      bank: modalForm.bank,
      principal,
      rate,
      startDate: modalForm.startDate || null,
      maturityDate: modalForm.maturityDate,
      purpose: modalForm.purpose,
      notes: modalForm.notes || null,
      holders: typeof modalForm.holders === 'string'
        ? modalForm.holders.split(',').map(h => h.trim()).filter(Boolean)
        : (modalForm.holders ?? ['mother']),
    }
    let saved
    try {
      saved = await api.assets.updateFD(modalForm.id, body)
    } catch {
      showToast('Save failed. Changes were NOT saved to server.', 'error')
      setModalLoading(false)
      return
    }
    setFixedDeposits(prev => prev.map(fd => fd.id === saved.id ? saved : fd))
    useStore.setState(state => ({
      fixedDeposits: state.fixedDeposits.map(fd => fd.id === saved.id ? saved : fd)
    }))
    setModalLoading(false)
    closeModal()
    showToast('FD updated ✓', 'success')
  }

  // ── LIC edit handler ───────────────────────────────────────────────────────
  const handleEditLIC = (lic) => {
    openModal('editLIC', { ...lic })
  }

  const handleSaveEditLIC = async () => {
    const annualPremium = parseFloat(modalForm.annualPremium)
    if (!annualPremium || annualPremium <= 0 || !modalForm.nextDueDate) {
      setModalError('Annual premium and next due date required.')
      return
    }
    setModalLoading(true)
    const body = {
      insured: modalForm.insured,
      plan: modalForm.plan,
      annualPremium,
      nextDueDate: modalForm.nextDueDate,
      premiumsPaid: modalForm.premiumsPaid ?? 0,
      paidUpEligibleDate: modalForm.paidUpEligibleDate || null,
      notes: modalForm.notes || null,
    }
    let saved
    try {
      saved = await api.assets.updateLIC(modalForm.id, body)
    } catch {
      showToast('Save failed. Changes were NOT saved to server.', 'error')
      setModalLoading(false)
      return
    }
    setLicPolicies(prev => prev.map(l => l.id === saved.id ? saved : l))
    useStore.setState(state => ({
      licPolicies: state.licPolicies.map(l => l.id === saved.id ? saved : l)
    }))
    setModalLoading(false)
    closeModal()
    showToast('LIC updated ✓', 'success')
  }

  // ── Chit edit handler ──────────────────────────────────────────────────────
  const handleEditChit = (chit) => {
    openModal('editChit', { ...chit })
  }

  const handleSaveEditChit = async () => {
    const monthlyContribution = parseInt(modalForm.monthlyContribution, 10) || 0
    const expectedPrize = parseInt(modalForm.expectedPrize, 10)
    if (!expectedPrize || !modalForm.completionDate) {
      setModalError('Expected prize and completion date required.')
      return
    }
    setModalLoading(true)
    const body = {
      organizer: modalForm.organizer,
      monthlyContribution,
      expectedPrize,
      completionDate: modalForm.completionDate,
      status: modalForm.status,
      notes: modalForm.notes || null,
    }
    let saved
    try {
      saved = await api.assets.updateChit(modalForm.id, body)
    } catch {
      showToast('Save failed. Changes were NOT saved to server.', 'error')
      setModalLoading(false)
      return
    }
    setChitFunds(prev => prev.map(c => c.id === saved.id ? saved : c))
    useStore.setState(state => ({
      chitFunds: state.chitFunds.map(c => c.id === saved.id ? saved : c)
    }))
    setModalLoading(false)
    closeModal()
    showToast('Chit updated ✓', 'success')
  }

  // ── Gold handler ───────────────────────────────────────────────────────────
  const handleSaveGold = async () => {
    const weight = parseFloat(goldForm.weightGrams)
    const price = parseFloat(goldForm.currentValuePerGram)
    if (isNaN(weight) || weight <= 0 || isNaN(price) || price <= 0) {
      showToast('Enter valid weight and price', 'error')
      return
    }
    setGoldSaving(true)
    const today = new Date().toISOString().split('T')[0]
    const goldData = { weightGrams: weight, currentValuePerGram: price, lastUpdated: today }
    try {
      await api.assets.updateGold(goldData)
    } catch {
      showToast('Save failed. Changes were NOT saved to server.', 'error')
      setGoldSaving(false)
      return
    }
    useStore.getState().updateGold(goldData)
    showToast('Gold updated ✓', 'success')
    setGoldSaving(false)
  }

  // ── Derived values ─────────────────────────────────────────────────────────
  const fdTotal = fixedDeposits.reduce((s, fd) => s + fd.principal, 0)
  const mfTotal = mutualFunds.reduce((s, mf) => s + mf.currentValue, 0)
  const mfInvested = mutualFunds.reduce((s, mf) => s + mf.investedAmount, 0)
  const mfGain = mfTotal - mfInvested
  const annualTotal = licPolicies.reduce((s, l) => s + l.annualPremium, 0)
  const upcomingDues = getUpcomingLICDues(licPolicies, 120)
  const activeChits = chitFunds.filter((c) => c.status === 'active')
  const totalMonthly = activeChits.reduce((s, c) => s + c.monthlyContribution, 0)
  const hasUnknown = activeChits.some((c) => c.monthlyContribution === 0)
  const sortedFunds = [...mutualFunds].sort((a, b) =>
    a.planType === 'regular' ? -1 : b.planType === 'regular' ? 1 : 0
  )
  const parsedWeight = parseFloat(goldForm.weightGrams) || 0
  const parsedPrice = parseFloat(goldForm.currentValuePerGram) || 0
  const calculatedValue = parsedWeight * parsedPrice

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

      {/* ── Tab bar ── */}
      <div className="sticky top-14 z-10 -mx-4 px-4 bg-slate-100 pt-2 pb-2 lg:mx-0 lg:rounded-xl lg:mb-4">
        <div className="flex items-center bg-white rounded-full p-1 shadow-sm">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 text-center py-2 text-sm font-medium transition-colors rounded-full ${
                activeTab === tab.key
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4">
        <div className="flex justify-end mb-2">
          <button
            onClick={async () => {
              try {
                const data = await api.assets.getAll()
                useStore.setState({
                  fixedDeposits: data.fixedDeposits,
                  mutualFunds: data.mutualFunds,
                  licPolicies: data.licPolicies,
                  chitFunds: data.chitFunds,
                })
                setFixedDeposits(data.fixedDeposits)
                setMutualFunds(data.mutualFunds)
                setLicPolicies(data.licPolicies)
                setChitFunds(data.chitFunds)
                showToast('Refreshed from server ✓', 'success')
              } catch {
                showToast('Could not reach server — showing local data', 'error')
              }
            }}
            className="text-xs text-slate-400 underline"
          >
            ↺ Sync from server
          </button>
        </div>

        {/* ── Loading skeleton ── */}
        {loading && activeTab !== 'gold' && (
          <div className="space-y-3">
            <div className="h-24 bg-slate-100 rounded-2xl animate-pulse" />
            <div className="h-24 bg-slate-100 rounded-2xl animate-pulse" />
            <div className="h-24 bg-slate-100 rounded-2xl animate-pulse" />
          </div>
        )}

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        {/* TAB: FDs (Fixed Deposits)                                        */}
        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        {activeTab === 'fd' && !loading && (
          <>
            {/* Total FD card */}
            <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 -mx-4 px-4 pt-4 pb-8 mb-5 lg:mx-0 lg:rounded-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Fixed Deposits</p>
                  <p className="text-3xl font-bold tracking-tight text-white mt-0.5">
                    {formatCurrency(fdTotal)}
                  </p>
                </div>
                <Landmark size={28} className="text-slate-700" />
              </div>
              <p className="text-xs text-slate-400 mt-2">
                {fixedDeposits.length} deposit
                {fixedDeposits.length !== 1 ? 's' : ''} · All in Canara Bank
              </p>
              
              {/* Glass sub-stats */}
              <div className="grid grid-cols-2 gap-2 mt-4">
                <div className="bg-white/15 backdrop-blur-md border border-white/25 rounded-xl px-3 py-2 text-center">
                  <p className="text-xs text-white/60 mb-0.5">Count</p>
                  <p className="text-base font-bold text-white">{fixedDeposits.length}</p>
                </div>
                <div className="bg-white/15 backdrop-blur-md border border-white/25 rounded-xl px-3 py-2 text-center">
                  <p className="text-xs text-white/60 mb-0.5">Total</p>
                  <p className="text-base font-bold text-white">{formatCurrency(fdTotal, true)}</p>
                </div>
              </div>
            </div>

            {/* Add FD button */}
            <div className="flex justify-end mb-3">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => openModal('addFD')}
              >
                <Plus size={13} className="mr-1" /> Add FD
              </Button>
            </div>

            {/* FD cards - 2 column grid on desktop */}
            <div className="lg:grid lg:grid-cols-2 lg:gap-4">
            {fixedDeposits.map((fd) => {
              const days = daysUntil(fd.maturityDate)
              const isExpiringSoon = days !== null && days <= 60
              const isExpiringSoonish = days !== null && days > 60 && days <= 120
              const purposeColor =
                { marriage: 'indigo', renovation: 'amber', core: 'blue', emergency: 'green' }[
                  fd.purpose
                ] ?? 'slate'

              return (
                <Card
                  key={fd.id}
                  className="mb-3"
                  onClick={() =>
                    setExpandedId(expandedId === fd.id ? null : fd.id)
                  }
                >
                  {/* Header row */}
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-slate-800">
                          {fd.bank}
                        </p>
                        <Badge color={purposeColor}>
                          {fd.purpose.charAt(0).toUpperCase() + fd.purpose.slice(1)}
                        </Badge>
                        {/* Rate contested — see FINANCIAL_CONTEXT.md */}
                        {fd.rate === 6.45 && (
                          <Badge color="amber">
                            <AlertTriangle size={10} className="mr-1 inline" />
                            Verify Rate
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Holder{fd.holders?.length > 1 ? 's' : ''}:{' '}
                        {fd.holders?.join(', ')}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0 ml-3">
                      <p className="text-base font-bold text-slate-800">
                        {formatCurrency(fd.principal, true)}
                      </p>
                      <p className="text-xs text-slate-400">{fd.rate}% p.a.</p>
                    </div>
                  </div>

                  {/* Maturity countdown */}
                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs text-slate-500">
                        Matures: {formatDate(fd.maturityDate)}
                      </p>
                    </div>
                    <Badge
                      color={
                        isExpiringSoon
                          ? 'red'
                          : isExpiringSoonish
                          ? 'amber'
                          : 'slate'
                      }
                    >
                      {days === null
                        ? 'No date'
                        : days < 0
                        ? `${Math.abs(days)}d overdue`
                        : days === 0
                        ? 'Today'
                        : `${days} days`}
                    </Badge>
                  </div>

                  {/* Expanded detail */}
                  {expandedId === fd.id && (
                    <div className="mt-3 pt-3 border-t border-slate-100">
                      {fd.startDate && (
                        <p className="text-xs text-slate-500 mb-1">
                          Start date: {formatDate(fd.startDate)}
                        </p>
                      )}
                      {fd.notes && (
                        <div className="bg-amber-50 rounded-lg p-2.5 mb-3">
                          <p className="text-xs text-amber-700 leading-relaxed">
                            {fd.notes}
                          </p>
                        </div>
                      )}
                      <div className="flex gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleEditFD(fd)
                          }}
                        >
                          <Edit2 size={12} className="mr-1" /> Edit
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteFD(fd.id)
                          }}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Expand chevron */}
                  <div className="flex justify-center mt-2">
                    {expandedId === fd.id ? (
                      <ChevronUp size={16} className="text-slate-300" />
                    ) : (
                      <ChevronDown size={16} className="text-slate-300" />
                    )}
                  </div>
                </Card>
              )
            })}
            </div>

            {fixedDeposits.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-8">
                No fixed deposits yet
              </p>
            )}
          </>
        )}

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        {/* TAB: Funds (Mutual Funds)                                        */}
        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        {activeTab === 'mf' && !loading && (
          <>
            {/* Total MF card */}
            <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 -mx-4 px-4 pt-4 pb-8 mb-5 lg:mx-0 lg:rounded-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Mutual Funds</p>
                  <p className="text-3xl font-bold tracking-tight text-white mt-0.5">
                    {formatCurrency(mfTotal)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-400">Invested</p>
                  <p className="text-sm font-medium text-slate-400">
                    {formatCurrency(mfInvested, true)}
                  </p>
                </div>
              </div>
              {mfInvested > 0 && (
                <div
                  className={`flex items-center gap-1 mt-2 ${
                    mfGain >= 0 ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  {mfGain >= 0 ? (
                    <TrendingUp size={14} />
                  ) : (
                    <TrendingDown size={14} />
                  )}
                  <p className="text-xs font-medium">
                    {mfGain >= 0 ? '+' : ''}
                    {formatCurrency(mfGain, true)} overall{' '}
                    {mfGain >= 0 ? 'gain' : 'loss'}
                  </p>
                </div>
              )}
            </div>

            {/* MF cards - 2 column grid on desktop */}
            <div className="lg:grid lg:grid-cols-2 lg:gap-4">
            {sortedFunds.map((mf) => {
              const isEmergencyFund = mf.notes
                ?.toUpperCase()
                .includes('EMERGENCY FUND')
              const isRegular = mf.planType === 'regular'
              const gain = mf.currentValue - mf.investedAmount
              const gainPct =
                mf.investedAmount > 0
                  ? ((gain / mf.investedAmount) * 100).toFixed(1)
                  : 0

              return (
                <div
                  key={mf.id}
                  className={`bg-white rounded-2xl border border-slate-100 shadow-sm p-4 mb-3 ${
                    isRegular ? 'border-t-2 border-red-400 bg-red-50' : ''
                  } ${isEmergencyFund ? 'border-t-2 border-emerald-500 bg-emerald-50' : ''}`}
                >
                  {/* Regular plan warning banner */}
                  {isRegular && (
                    <div className="flex items-center gap-2 bg-red-50 rounded-lg px-3 py-2 mb-3">
                      <AlertTriangle
                        size={14}
                        className="text-red-500 flex-shrink-0"
                      />
                      <p className="text-xs font-semibold text-red-700">
                        Regular Plan — Switch to Direct
                      </p>
                      <Badge color="red">Action Required</Badge>
                    </div>
                  )}

                  {/* Emergency fund banner */}
                  {isEmergencyFund && (
                    <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2 mb-3">
                      <Lock
                        size={14}
                        className="text-green-600 flex-shrink-0"
                      />
                      <p className="text-xs font-semibold text-green-700">
                        🔒 Emergency Fund — Do Not Redeem
                      </p>
                    </div>
                  )}

                  {/* Fund name and badges */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 leading-snug">
                        {mf.name}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <Badge
                          color={
                            mf.type === 'equity'
                              ? 'indigo'
                              : mf.type === 'debt'
                              ? 'blue'
                              : 'amber'
                          }
                        >
                          {mf.type.charAt(0).toUpperCase() + mf.type.slice(1)}
                        </Badge>
                        <Badge color={isRegular ? 'red' : 'green'}>
                          {isRegular ? 'Regular' : 'Direct'}
                        </Badge>
                        {mf.platform && (
                          <Badge color="slate">{mf.platform}</Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Value row */}
                  <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                    <div>
                      <p className="text-xs text-slate-400">Invested</p>
                      <p className="text-sm font-medium text-slate-700">
                        {mf.investedAmount > 0
                          ? formatCurrency(mf.investedAmount, true)
                          : '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Current</p>
                      <p className="text-sm font-bold text-slate-800">
                        {mf.currentValue > 0
                          ? formatCurrency(mf.currentValue, true)
                          : '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Gain/Loss</p>
                      {mf.investedAmount > 0 && mf.currentValue > 0 ? (
                        <p
                          className={`text-sm font-medium ${
                            gain >= 0 ? 'text-emerald-600' : 'text-red-500'
                          }`}
                        >
                          {gain >= 0 ? '+' : ''}
                          {formatCurrency(gain, true)}
                        </p>
                      ) : (
                        <p className="text-sm text-slate-300">—</p>
                      )}
                    </div>
                  </div>

                  {/* Notes for regular plans */}
                  {isRegular && mf.notes && (
                    <div className="mt-3 bg-red-50 rounded-lg px-3 py-2">
                      <p className="text-xs text-red-600 leading-relaxed">
                        {mf.notes}
                      </p>
                    </div>
                  )}

                  {/* Update value button */}
                  <div className="mt-3 flex justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        openModal('updateMFValue', {
                          id: mf.id,
                          name: mf.name,
                          currentValue: String(mf.currentValue),
                        })
                      }
                    >
                      <Edit2 size={12} className="mr-1" /> Update Value
                    </Button>
                  </div>
                </div>
              )
            })}

            {mutualFunds.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-8">
                No mutual funds yet
              </p>
            )}
            </div>
          </>
        )}

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        {/* TAB: LIC (Insurance Policies)                                    */}
        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        {activeTab === 'lic' && !loading && (
          <>
            {/* Total annual outflow card */}
            <div className="-mx-4 px-4 pt-4 pb-6 bg-slate-900 mb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-widest text-slate-400">LIC Annual Outflow</p>
                  <p className="text-3xl font-bold tracking-tight text-white mt-0.5">
                    {formatCurrency(annualTotal)}
                  </p>
                </div>
                <Shield size={28} className="text-slate-700" />
              </div>
              <p className="text-xs text-slate-400 mt-2">
                {formatCurrency(Math.round(annualTotal / 12))}/month ·{' '}
                {licPolicies.length} polic
                {licPolicies.length !== 1 ? 'ies' : 'y'}
              </p>
            </div>

            {/* Upcoming dues mini-timeline */}
            {upcomingDues.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-medium uppercase tracking-widest text-slate-400 mb-2">
                  Upcoming Premiums
                </p>
                {upcomingDues.map((lic) => {
                  const days = daysUntil(lic.nextDueDate)
                  return (
                    <div
                      key={lic.id + '-upcoming'}
                      className="flex items-center justify-between py-2 border-b border-slate-50"
                    >
                      <p className="text-sm text-slate-700">
                        {lic.insured} — {lic.plan}
                      </p>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-slate-800">
                          {formatCurrency(lic.annualPremium, true)}
                        </p>
                        <Badge color={days <= 30 ? 'red' : 'amber'}>
                          {days}d
                        </Badge>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* LIC policy cards */}
            {licPolicies.map((lic) => {
              const days = daysUntil(lic.nextDueDate)
              const isDueSoon = days !== null && days <= 30
              const isDueWarning = days !== null && days > 30 && days <= 60

              return (
                <Card
                  key={lic.id}
                  className={`mb-3 ${isDueSoon ? 'border-red-200' : ''}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 capitalize">
                        {lic.insured}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">{lic.plan}</p>
                    </div>
                    <div className="text-right flex-shrink-0 ml-3">
                      <p className="text-base font-bold text-slate-800">
                        {formatCurrency(lic.annualPremium, true)}
                      </p>
                      <p className="text-xs text-slate-400">per year</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div>
                      <p className="text-xs text-slate-400">Next due</p>
                      <p className="text-sm font-medium text-slate-700">
                        {formatDate(lic.nextDueDate)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Premiums paid</p>
                      <p className="text-sm font-medium text-slate-700">
                        {lic.premiumsPaid > 0 ? lic.premiumsPaid : '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Paid-up eligible</p>
                      <p className="text-sm font-medium text-slate-700">
                        {lic.paidUpEligibleDate
                          ? formatDate(lic.paidUpEligibleDate)
                          : 'Verify'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Days until due</p>
                      <Badge
                        color={
                          isDueSoon
                            ? 'red'
                            : isDueWarning
                            ? 'amber'
                            : 'slate'
                        }
                      >
                        {days === null
                          ? '—'
                          : days < 0
                          ? 'Overdue'
                          : `${days} days`}
                      </Badge>
                    </div>
                  </div>

                  {lic.notes && (
                    <p className="text-xs text-slate-400 mt-3 leading-relaxed">
                      {lic.notes}
                    </p>
                  )}

                  {/* LIC action buttons */}
                  <div className="mt-3 flex gap-2 justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditLIC(lic)}
                    >
                      <Edit2 size={12} className="mr-1" /> Edit
                    </Button>
                    <Button
                      variant={isDueSoon ? 'primary' : 'secondary'}
                      size="sm"
                      loading={licLoadingId === lic.id}
                      onClick={() =>
                        handleMarkLICPaid(lic.id, lic.annualPremium)
                      }
                    >
                      <CheckCircle size={13} className="mr-1" /> Mark Paid
                    </Button>
                  </div>
                </Card>
              )
            })}

            {licPolicies.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-8">
                No LIC policies yet
              </p>
            )}
          </>
        )}

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        {/* TAB: Chits (Chit Funds)                                          */}
        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        {activeTab === 'chit' && !loading && (
          <>
            {/* Total monthly outflow card */}
            <div className="-mx-4 px-4 pt-4 pb-6 bg-slate-900 mb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-widest text-slate-400">Monthly Chit Outflow</p>
                  <p className="text-3xl font-bold tracking-tight text-white mt-0.5">
                    {totalMonthly > 0 ? formatCurrency(totalMonthly) : '—'}
                  </p>
                </div>
                <Users size={28} className="text-slate-700" />
              </div>
              {hasUnknown && (
                <div className="flex items-center gap-1.5 mt-2">
                  <AlertTriangle size={13} className="text-amber-500" />
                  <p className="text-xs text-amber-500">
                    Some chit amounts unverified — call Nadar Sangam
                  </p>
                </div>
              )}
            </div>

            {/* Add chit button */}
            <div className="flex justify-end mb-3">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => openModal('addChit')}
              >
                <Plus size={13} className="mr-1" /> Add Chit
              </Button>
            </div>

            {/* Chit cards */}
            {chitFunds.map((chit) => {
              const days = daysUntil(chit.completionDate)
              const now = new Date()
              const end = new Date(chit.completionDate)
              const monthsLeft = Math.max(
                0,
                (end.getFullYear() - now.getFullYear()) * 12 +
                  (end.getMonth() - now.getMonth())
              )
              const totalLocked = chit.monthlyContribution * monthsLeft

              return (
                <Card key={chit.id} className="mb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">
                        {chit.organizer}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge
                          color={
                            chit.status === 'active'
                              ? 'green'
                              : chit.status === 'completed'
                              ? 'slate'
                              : 'red'
                          }
                        >
                          {chit.status.charAt(0).toUpperCase() +
                            chit.status.slice(1)}
                        </Badge>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-400">Expected prize</p>
                      <p className="text-base font-bold text-slate-800">
                        {formatCurrency(chit.expectedPrize, true)}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div>
                      <p className="text-xs text-slate-400">
                        Monthly contribution
                      </p>
                      {chit.monthlyContribution > 0 ? (
                        <p className="text-sm font-medium text-slate-700">
                          {formatCurrency(chit.monthlyContribution)}
                        </p>
                      ) : (
                        <div className="flex items-center gap-1 mt-0.5">
                          <AlertTriangle size={12} className="text-amber-500" />
                          <p className="text-xs text-amber-600 font-medium">
                            Unverified
                          </p>
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Completion</p>
                      <p className="text-sm font-medium text-slate-700">
                        {formatDate(chit.completionDate)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Months left</p>
                      <p className="text-sm font-medium text-slate-700">
                        {monthsLeft}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Still to pay</p>
                      <p className="text-sm font-medium text-slate-700">
                        {totalLocked > 0
                          ? formatCurrency(totalLocked, true)
                          : '—'}
                      </p>
                    </div>
                  </div>

                  {chit.notes && (
                    <p className="text-xs text-slate-400 mt-3">{chit.notes}</p>
                  )}

                  <div className="mt-3 flex gap-2 flex-wrap">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditChit(chit)}
                    >
                      <Edit2 size={12} className="mr-1" /> Edit
                    </Button>
                    <select
                      value={chit.status}
                      onChange={(e) =>
                        handleUpdateChitStatus(chit.id, e.target.value)
                      }
                      onClick={(e) => e.stopPropagation()}
                      className="text-xs border border-slate-200 rounded-lg px-2 py-1.5
                                 text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="active">Active</option>
                      <option value="completed">Completed</option>
                      <option value="defaulted">Defaulted</option>
                    </select>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleDeleteChit(chit.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </Card>
              )
            })}

            {chitFunds.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-8">
                No chit funds yet
              </p>
            )}
          </>
        )}

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        {/* TAB: Gold                                                        */}
        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        {activeTab === 'gold' && (
          <>
            {/* Current value card */}
            <div className="-mx-4 px-4 pt-4 pb-6 bg-slate-900 mb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-widest text-slate-400">Physical Gold</p>
                  <p className="text-3xl font-bold tracking-tight text-amber-500 mt-0.5">
                    {formatCurrency(calculatedValue)}
                  </p>
                </div>
                <Coins size={28} className="text-slate-700" />
              </div>
              <p className="text-xs text-slate-400 mt-2">
                {parsedWeight}g × {formatCurrency(parsedPrice)}/g
              </p>
              {gold.lastUpdated && (
                <p className="text-xs text-slate-500 mt-1">
                  Last updated: {formatDate(gold.lastUpdated)}
                </p>
              )}
            </div>

            {/* Physical gold warning */}
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 mb-4">
              <p className="text-xs text-amber-700 font-medium mb-1">
                ⚠ Physical gold note
              </p>
              <p className="text-xs text-amber-600 leading-relaxed">
                No yield — gold earns nothing while held. Selling incurs 5–10% in
                deductions (making charges, GST, jeweller margin). Do not liquidate
                unless absolutely necessary.
              </p>
            </div>

            {/* Edit form */}
            <Card>
              <p className="text-sm font-semibold text-slate-700 mb-3">
                Update Gold Details
              </p>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Weight (grams)
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={goldForm.weightGrams}
                    onChange={(e) =>
                      setGoldForm((prev) => ({
                        ...prev,
                        weightGrams: e.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm
                               focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="e.g. 8"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Current price per gram (22K, Chennai)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                      ₹
                    </span>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={goldForm.currentValuePerGram}
                      onChange={(e) =>
                        setGoldForm((prev) => ({
                          ...prev,
                          currentValuePerGram: e.target.value,
                        }))
                      }
                      className="w-full rounded-lg border border-slate-200 pl-7 pr-3 py-2 text-sm
                                 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="e.g. 14650"
                    />
                  </div>
                </div>

                {/* Live calculated value */}
                {parsedWeight > 0 && parsedPrice > 0 && (
                  <div className="bg-slate-50 rounded-lg px-3 py-2">
                    <p className="text-xs text-slate-500">Calculated value</p>
                    <p className="text-base font-bold text-slate-800">
                      {formatCurrency(calculatedValue)}
                    </p>
                  </div>
                )}

                <Button
                  variant="primary"
                  size="md"
                  className="w-full"
                  loading={goldSaving}
                  onClick={handleSaveGold}
                >
                  Update Price
                </Button>
              </div>
            </Card>
          </>
        )}
      </div>

      {/* Bottom padding */}
      <div className="h-8" />

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/* SHARED MODAL                                                      */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {modal && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 z-50"
            onClick={closeModal}
          />

          {/* Modal container */}
          <div className="fixed inset-x-4 top-[15%] bg-white rounded-2xl p-5 z-50 shadow-xl max-h-[70vh] overflow-y-auto">
            {/* Modal header */}
            <div className="flex items-center justify-between mb-4">
              <p className="text-base font-semibold text-slate-800">
                {modal.type === 'addFD' && 'Add Fixed Deposit'}
                {modal.type === 'editFD' && 'Edit Fixed Deposit'}
                {modal.type === 'addChit' && 'Add Chit Fund'}
                {modal.type === 'editChit' && 'Edit Chit Fund'}
                {modal.type === 'editLIC' && `Edit LIC — ${modalForm.insured ?? ''}`}
                {modal.type === 'updateMFValue' &&
                  `Update: ${modal.data?.name?.split(' ').slice(0, 3).join(' ')}...`}
              </p>
              <button
                onClick={closeModal}
                className="p-1.5 rounded-lg hover:bg-slate-100"
              >
                <X size={18} className="text-slate-500" />
              </button>
            </div>

            {/* ── Add FD form ── */}
            {modal.type === 'addFD' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Bank
                  </label>
                  <input
                    type="text"
                    value={modalForm.bank ?? 'Canara Bank'}
                    onChange={(e) =>
                      setModalForm((p) => ({ ...p, bank: e.target.value }))
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm
                               focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Principal (₹)
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={modalForm.principal ?? ''}
                    onChange={(e) =>
                      setModalForm((p) => ({ ...p, principal: e.target.value }))
                    }
                    placeholder="e.g. 600000"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm
                               focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Interest rate (% p.a.)
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    value={modalForm.rate ?? ''}
                    onChange={(e) =>
                      setModalForm((p) => ({ ...p, rate: e.target.value }))
                    }
                    placeholder="e.g. 6.45"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm
                               focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Maturity date
                  </label>
                  <input
                    type="date"
                    value={modalForm.maturityDate ?? ''}
                    onChange={(e) =>
                      setModalForm((p) => ({
                        ...p,
                        maturityDate: e.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm
                               focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Start date (optional)
                  </label>
                  <input
                    type="date"
                    value={modalForm.startDate ?? ''}
                    onChange={(e) =>
                      setModalForm((p) => ({
                        ...p,
                        startDate: e.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm
                               focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Purpose
                  </label>
                  <select
                    value={modalForm.purpose ?? 'core'}
                    onChange={(e) =>
                      setModalForm((p) => ({ ...p, purpose: e.target.value }))
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm
                               focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="marriage">Marriage</option>
                    <option value="renovation">Renovation</option>
                    <option value="core">Core</option>
                    <option value="emergency">Emergency</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Holder
                  </label>
                  <input
                    type="text"
                    value={modalForm.holders ?? 'mother'}
                    onChange={(e) =>
                      setModalForm((p) => ({ ...p, holders: e.target.value }))
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm
                               focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Notes (optional)
                  </label>
                  <textarea
                    value={modalForm.notes ?? ''}
                    onChange={(e) =>
                      setModalForm((p) => ({ ...p, notes: e.target.value }))
                    }
                    rows={2}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm
                               focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  />
                </div>
              </div>
            )}

            {/* ── Add Chit form ── */}
            {modal.type === 'addChit' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Organizer
                  </label>
                  <input
                    type="text"
                    value={modalForm.organizer ?? 'Nadar Sangam'}
                    onChange={(e) =>
                      setModalForm((p) => ({
                        ...p,
                        organizer: e.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm
                               focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Monthly contribution (₹)
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={modalForm.monthlyContribution ?? ''}
                    onChange={(e) =>
                      setModalForm((p) => ({
                        ...p,
                        monthlyContribution: e.target.value,
                      }))
                    }
                    placeholder="0 if unknown"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm
                               focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Expected prize (₹)
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={modalForm.expectedPrize ?? ''}
                    onChange={(e) =>
                      setModalForm((p) => ({
                        ...p,
                        expectedPrize: e.target.value,
                      }))
                    }
                    placeholder="e.g. 277000"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm
                               focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Completion date
                  </label>
                  <input
                    type="date"
                    value={modalForm.completionDate ?? ''}
                    onChange={(e) =>
                      setModalForm((p) => ({
                        ...p,
                        completionDate: e.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm
                               focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Notes (optional)
                  </label>
                  <textarea
                    value={modalForm.notes ?? ''}
                    onChange={(e) =>
                      setModalForm((p) => ({ ...p, notes: e.target.value }))
                    }
                    rows={2}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm
                               focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  />
                </div>
              </div>
            )}

            {/* ── Edit FD form ── */}
            {modal.type === 'editFD' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Bank</label>
                  <input type="text" value={modalForm.bank ?? ''} onChange={e => setModalForm(p => ({ ...p, bank: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Principal (₹)</label>
                  <input type="number" inputMode="numeric" value={modalForm.principal ?? ''} onChange={e => setModalForm(p => ({ ...p, principal: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Interest rate (% p.a.)</label>
                  <input type="number" inputMode="decimal" step="0.01" value={modalForm.rate ?? ''} onChange={e => setModalForm(p => ({ ...p, rate: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Maturity date</label>
                  <input type="date" value={modalForm.maturityDate ?? ''} onChange={e => setModalForm(p => ({ ...p, maturityDate: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Start date</label>
                  <input type="date" value={modalForm.startDate ?? ''} onChange={e => setModalForm(p => ({ ...p, startDate: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Purpose</label>
                  <select value={modalForm.purpose ?? 'core'} onChange={e => setModalForm(p => ({ ...p, purpose: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="marriage">Marriage</option>
                    <option value="renovation">Renovation</option>
                    <option value="core">Core</option>
                    <option value="emergency">Emergency</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Holder(s)</label>
                  <input type="text" value={modalForm.holders ?? 'mother'} onChange={e => setModalForm(p => ({ ...p, holders: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
                  <textarea rows={2} value={modalForm.notes ?? ''} onChange={e => setModalForm(p => ({ ...p, notes: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
                </div>
              </div>
            )}

            {/* ── Edit LIC form ── */}
            {modal.type === 'editLIC' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Insured person</label>
                  <input type="text" value={modalForm.insured ?? ''} onChange={e => setModalForm(p => ({ ...p, insured: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Plan name</label>
                  <input type="text" value={modalForm.plan ?? ''} onChange={e => setModalForm(p => ({ ...p, plan: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Annual premium (₹)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">₹</span>
                    <input type="number" inputMode="numeric" value={modalForm.annualPremium ?? ''} onChange={e => setModalForm(p => ({ ...p, annualPremium: e.target.value }))}
                      className="w-full rounded-lg border border-slate-200 pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Next due date</label>
                  <input type="date" value={modalForm.nextDueDate ?? ''} onChange={e => setModalForm(p => ({ ...p, nextDueDate: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Paid-up eligible date</label>
                  <input type="date" value={modalForm.paidUpEligibleDate ?? ''} onChange={e => setModalForm(p => ({ ...p, paidUpEligibleDate: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Premiums paid</label>
                  <input type="number" inputMode="numeric" value={modalForm.premiumsPaid ?? 0} onChange={e => setModalForm(p => ({ ...p, premiumsPaid: parseInt(e.target.value, 10) || 0 }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
                  <textarea rows={2} value={modalForm.notes ?? ''} onChange={e => setModalForm(p => ({ ...p, notes: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
                </div>
              </div>
            )}

            {/* ── Edit Chit form ── */}
            {modal.type === 'editChit' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Organizer</label>
                  <input type="text" value={modalForm.organizer ?? ''} onChange={e => setModalForm(p => ({ ...p, organizer: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Monthly contribution (₹)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">₹</span>
                    <input type="number" inputMode="numeric" value={modalForm.monthlyContribution ?? ''} onChange={e => setModalForm(p => ({ ...p, monthlyContribution: e.target.value }))}
                      className="w-full rounded-lg border border-slate-200 pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Expected prize (₹)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">₹</span>
                    <input type="number" inputMode="numeric" value={modalForm.expectedPrize ?? ''} onChange={e => setModalForm(p => ({ ...p, expectedPrize: e.target.value }))}
                      className="w-full rounded-lg border border-slate-200 pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Completion date</label>
                  <input type="date" value={modalForm.completionDate ?? ''} onChange={e => setModalForm(p => ({ ...p, completionDate: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
                  <textarea rows={2} value={modalForm.notes ?? ''} onChange={e => setModalForm(p => ({ ...p, notes: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
                </div>
              </div>
            )}

            {/* ── Update MF Value form ── */}
            {modal.type === 'updateMFValue' && (
              <div className="space-y-3">
                <p className="text-sm text-slate-600 leading-snug">
                  {modal.data?.name}
                </p>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Current value — from Groww today (₹)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                      ₹
                    </span>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={modalForm.currentValue ?? ''}
                      onChange={(e) =>
                        setModalForm((p) => ({
                          ...p,
                          currentValue: e.target.value,
                        }))
                      }
                      autoFocus
                      className="w-full rounded-lg border border-slate-200 pl-7 pr-3 py-2 text-sm
                                 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Amount invested — total you put in (₹)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                      ₹
                    </span>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={modalForm.investedAmount ?? ''}
                      onChange={(e) =>
                        setModalForm((p) => ({
                          ...p,
                          investedAmount: e.target.value,
                        }))
                      }
                      className="w-full rounded-lg border border-slate-200 pl-7 pr-3 py-2 text-sm
                                 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
                {modalForm.currentValue && modalForm.investedAmount && (
                  <div className={`rounded-lg px-3 py-2 text-sm font-medium
                    ${parseFloat(modalForm.currentValue) >= parseFloat(modalForm.investedAmount)
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-red-50 text-red-700'}`}>
                    {parseFloat(modalForm.currentValue) >= parseFloat(modalForm.investedAmount)
                      ? `Gain: +₹${(parseFloat(modalForm.currentValue) - parseFloat(modalForm.investedAmount)).toLocaleString('en-IN')}`
                      : `Loss: -₹${(parseFloat(modalForm.investedAmount) - parseFloat(modalForm.currentValue)).toLocaleString('en-IN')}`}
                  </div>
                )}
              </div>
            )}

            {/* Error text */}
            {modalError && (
              <p className="text-xs text-red-600 mt-3">{modalError}</p>
            )}

            {/* Action buttons */}
            <div className="flex gap-2 mt-4">
              <Button variant="ghost" size="md" onClick={closeModal}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="md"
                className="flex-1"
                loading={modalLoading}
                onClick={() => {
                  if (modal.type === 'addFD') handleSaveFD()
                  if (modal.type === 'editFD') handleSaveEditFD()
                  if (modal.type === 'addChit') handleSaveChit()
                  if (modal.type === 'editChit') handleSaveEditChit()
                  if (modal.type === 'editLIC') handleSaveEditLIC()
                  if (modal.type === 'updateMFValue') handleSaveMFValue()
                }}
              >
                Save
              </Button>
            </div>
          </div>
        </>
      )}
    </>
  )
}
