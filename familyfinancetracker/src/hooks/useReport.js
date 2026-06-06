import useStore from '../store/useStore'
import { api } from '../utils/api'
import { formatCurrency, daysUntil } from '../utils/formatters'
import { EXPENSE_CATEGORIES } from '../data/seedData'

// ─────────────────────────────────────────────────────────────────────────────
// generateAlerts — checks all conditions and returns alert strings
// ─────────────────────────────────────────────────────────────────────────────

function generateAlerts(state, year, month) {
  const prefix = `${year}-${String(month).padStart(2, '0')}`
  const alerts = []

  // ── Emergency fund checks ─────────────────────────────────────────────────
  const efActual =
    (state.emergencyFund?.liquidFundBalance ?? 0) +
    (state.emergencyFund?.cashInBank ?? 0)
  const efTarget = state.emergencyFund?.target ?? 0

  if (efActual < efTarget) {
    const shortfall = efTarget - efActual
    alerts.push(
      `🔴 Emergency fund is below target — ${formatCurrency(shortfall)} needed`
    )
  }
  if (!state.emergencyFund?.isIsolated) {
    alerts.push(
      '🔴 Emergency fund not yet isolated — complete Week 3 action'
    )
  }

  // ── LIC premium checks ────────────────────────────────────────────────────
  if ((state.licPolicies?.length ?? 0) > 0) {
    const earliest = [...(state.licPolicies ?? [])]
      .filter((l) => l.nextDueDate)
      .sort((a, b) => new Date(a.nextDueDate) - new Date(b.nextDueDate))[0]
    if (earliest) {
      const days = daysUntil(earliest.nextDueDate)
      if (days !== null && days < 0) {
        alerts.push(
          '🔴 LIC premium OVERDUE — pay immediately to prevent policy lapse'
        )
      } else if (days !== null && days <= 30) {
        alerts.push(`🔴 LIC premium due in ${days} days — ₹36,375 total`)
      }
    }
  }

  // ── Budget overage alerts (one per category) ──────────────────────────────
  Object.keys(EXPENSE_CATEGORIES).forEach((key) => {
    const limit = state.budgets?.[key] ?? 0
    if (limit === 0) return
    const spent = (state.expenses ?? [])
      .filter((e) => e.date?.startsWith(prefix) && e.category === key)
      .reduce((s, e) => s + (e.amount ?? 0), 0)
    if (spent > limit) {
      alerts.push(
        `🟠 ${EXPENSE_CATEGORIES[key].label} over budget by ${formatCurrency(spent - limit)}`
      )
    }
  })

  // ── FD maturity alerts ────────────────────────────────────────────────────
  ;(state.fixedDeposits ?? []).forEach((fd) => {
    if (!fd.maturityDate) return
    const days = daysUntil(fd.maturityDate)
    if (days !== null && days >= 0 && days <= 45) {
      alerts.push(
        `🟠 FD maturity in ${days} days — ${formatCurrency(fd.principal)} (${fd.purpose})`
      )
    }
  })

  // ── Applications alert ────────────────────────────────────────────────────
  const appsThisMonth = (state.jobApplications ?? []).filter((a) =>
    a.appliedDate?.startsWith(prefix)
  ).length

  if (appsThisMonth >= 100) {
    alerts.push(
      `🟡 Applications this month: ${appsThisMonth} — excellent momentum`
    )
  } else if (appsThisMonth >= 25) {
    alerts.push(`🟡 Applications this month: ${appsThisMonth} — on track`)
  } else {
    alerts.push(
      `🟡 Applications this month: ${appsThisMonth} — below 25/week target`
    )
  }

  // ── Form 15G/121 alert ────────────────────────────────────────────────────
  const formMilestone = (state.milestones ?? []).find(
    (m) =>
      m.category === 'form_submission' &&
      m.title?.toLowerCase().includes('tds')
  )
  if (formMilestone?.status === 'done') {
    alerts.push('🟡 Form 15G/121: Submitted ✓')
  } else {
    alerts.push(
      '🟡 Form 15G/121: NOT YET SUBMITTED — URGENT before FD interest credit'
    )
  }

  return alerts
}

// ─────────────────────────────────────────────────────────────────────────────
// useReport hook — exports three functions
// ─────────────────────────────────────────────────────────────────────────────

export const useReport = () => {
  // ── generateReportForMonth ─────────────────────────────────────────────────

  const generateReportForMonth = (year, month) => {
    const state = useStore.getState()
    const prefix = `${year}-${String(month).padStart(2, '0')}`

    // Step 1 — Income
    const income = {
      pension: state.monthlyIncome?.pension ?? 0,
      nithish_salary: state.monthlyIncome?.nithish ?? 0,
      abeerami_contribution: state.monthlyIncome?.abeerami ?? 0,
      fd_interest_credited: 0,
      get total() {
        return this.pension + this.nithish_salary + this.abeerami_contribution
      },
    }
    // Resolve getter to plain value for JSON serialisation
    const incomeFlat = {
      pension: income.pension,
      nithish_salary: income.nithish_salary,
      abeerami_contribution: income.abeerami_contribution,
      fd_interest_credited: 0,
      total: income.pension + income.nithish_salary + income.abeerami_contribution,
    }

    // Step 2 — Expenses by category
    const monthlyExpenses = (state.expenses ?? []).filter((e) =>
      e.date?.startsWith(prefix)
    )

    const expByCat = {}
    Object.keys(EXPENSE_CATEGORIES).forEach((key) => {
      expByCat[key] = monthlyExpenses
        .filter((e) => e.category === key)
        .reduce((s, e) => s + (e.amount ?? 0), 0)
    })
    const expTotal = Object.values(expByCat).reduce((s, v) => s + v, 0)
    const expenses_by_category = { ...expByCat, total: expTotal }

    // Step 3 — Cash flow
    const net_position = incomeFlat.total - expTotal
    const variance_from_budget = 85800 - expTotal

    const cash_flow = {
      income: incomeFlat,
      expenses_by_category,
      net_position,
      budget_monthly_target: 85800,
      variance_from_budget,
    }

    // Step 4 — Corpus
    const fds = (state.fixedDeposits ?? []).map((fd) => ({
      id: fd.id,
      bank: fd.bank,
      principal: fd.principal ?? 0,
      rate: fd.rate ?? 0,
      maturity_date: fd.maturityDate ?? '',
      purpose: fd.purpose ?? '',
      days_to_maturity: daysUntil(fd.maturityDate) ?? 0,
    }))

    const mfs = (state.mutualFunds ?? []).map((mf) => ({
      id: mf.id,
      name: mf.name,
      current_value: mf.currentValue ?? 0,
      plan_type: mf.planType ?? 'direct',
      type: mf.type ?? 'equity',
    }))

    const gold_value =
      (state.gold?.weightGrams ?? 0) * (state.gold?.currentValuePerGram ?? 0)

    const efActual =
      (state.emergencyFund?.liquidFundBalance ?? 0) +
      (state.emergencyFund?.cashInBank ?? 0)
    const efTarget = state.emergencyFund?.target ?? 0
    const emergency_fund = {
      target: efTarget,
      actual: efActual,
      is_intact: !!(state.emergencyFund?.isIsolated && efActual >= efTarget),
    }

    const fdSum = fds.reduce((s, fd) => s + fd.principal, 0)
    const mfSum = mfs.reduce((s, mf) => s + mf.current_value, 0)
    const total_corpus = fdSum + mfSum + gold_value + efActual

    const corpus = {
      fixed_deposits: fds,
      mutual_funds: mfs,
      gold_value,
      emergency_fund,
      total_corpus,
    }

    // Step 5 — Milestones
    const allMilestones = state.milestones ?? []

    const completed_this_month = allMilestones
      .filter((m) => m.status === 'done' && m.date?.startsWith(prefix))
      .map((m) => ({ id: m.id, title: m.title, date: m.date, amount: m.amount ?? null }))

    const overdue = allMilestones
      .filter((m) => m.status === 'pending' && (daysUntil(m.date) ?? 0) < 0)
      .map((m) => ({
        id: m.id,
        title: m.title,
        date: m.date,
        amount: m.amount ?? null,
        days_overdue: Math.abs(daysUntil(m.date) ?? 0),
      }))

    const upcoming_30_days = allMilestones
      .filter((m) => {
        if (m.status !== 'pending') return false
        const d = daysUntil(m.date)
        return d !== null && d >= 0 && d <= 30
      })
      .map((m) => ({
        id: m.id,
        title: m.title,
        date: m.date,
        amount: m.amount ?? null,
        days_until: daysUntil(m.date) ?? 0,
      }))

    const milestones = { completed_this_month, overdue, upcoming_30_days }

    // Step 6 — Employment
    const apps = state.jobApplications ?? []
    const nithishSalary = state.monthlyIncome?.nithish ?? 0
    const nithish_status =
      nithishSalary === 0
        ? 'unemployed'
        : `employed at ${formatCurrency(nithishSalary)}/month`
    const interviews_total = apps.filter((a) =>
      ['interview_scheduled', 'interviewed'].includes(a.status)
    ).length
    const offers_total = apps.filter((a) =>
      ['offered', 'accepted'].includes(a.status)
    ).length
    const applications_this_month = apps.filter((a) =>
      a.appliedDate?.startsWith(prefix)
    ).length

    const employment = {
      nithish_status,
      applications_total: apps.length,
      interviews_total,
      offers_total,
      applications_this_month,
    }

    // Step 7 — Alerts
    const alerts = generateAlerts(state, year, month)

    // Step 8 — Assemble and return
    return {
      report_version: '1.0',
      generated_at: new Date().toISOString(),
      period: prefix,
      cash_flow,
      corpus,
      milestones,
      employment,
      alerts,
      notes: '',
    }
  }

  // ── saveMonthlySnapshot ────────────────────────────────────────────────────

  const saveMonthlySnapshot = async (year, month, reportJson) => {
    const prefix = `${year}-${String(month).padStart(2, '0')}`

    const snapshot = {
      month: prefix,
      totalIncome: reportJson.cash_flow.income.total,
      totalExpenses: reportJson.cash_flow.expenses_by_category.total,
      deficit: reportJson.cash_flow.net_position,
      corpusTotal: reportJson.corpus.total_corpus,
      emergencyFundBalance: reportJson.corpus.emergency_fund.actual,
      milestonesDone: reportJson.milestones.completed_this_month.length,
      milestonesOverdue: reportJson.milestones.overdue.length,
      notes: '',
    }

    let apiSuccess = false
    try {
      await api.reports.saveSnapshot(snapshot)
      apiSuccess = true
    } catch {
      apiSuccess = false
    }

    // Always save to store (offline persistence)
    useStore.getState().addMonthlySnapshot(snapshot)
    return { snapshot, apiSuccess }
  }

  return {
    generateReportForMonth,
    generateAlerts,
    saveMonthlySnapshot,
  }
}
