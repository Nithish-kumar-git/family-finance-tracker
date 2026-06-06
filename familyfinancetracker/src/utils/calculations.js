// Pure calculation functions for FamilyFinanceTracker.
// All functions accept store state as a parameter — no direct store imports.
// This keeps them testable and dependency-free.

export const getTotalCorpus = (state) => {
  const fdTotal = state.fixedDeposits.reduce((sum, fd) => sum + fd.principal, 0)
  const mfTotal = state.mutualFunds.reduce((sum, mf) => sum + mf.currentValue, 0)
  const goldTotal = state.gold.weightGrams * state.gold.currentValuePerGram
  const efTotal =
    state.emergencyFund.liquidFundBalance + state.emergencyFund.cashInBank
  return fdTotal + mfTotal + goldTotal + efTotal
}

export const getFDTotal = (state) =>
  state.fixedDeposits.reduce((sum, fd) => sum + fd.principal, 0)

export const getMFTotal = (state) =>
  state.mutualFunds.reduce((sum, mf) => sum + mf.currentValue, 0)

export const getGoldTotal = (state) =>
  state.gold.weightGrams * state.gold.currentValuePerGram

export const getMonthlyIncome = (state) =>
  state.monthlyIncome.pension +
  state.monthlyIncome.nithish +
  state.monthlyIncome.abeerami

export const getMonthlyExpensesTotal = (state, year, month) => {
  const prefix = `${year}-${String(month).padStart(2, '0')}`
  return state.expenses
    .filter(e => e.date.startsWith(prefix))
    .reduce((sum, e) => sum + e.amount, 0)
}

export const getMonthlyDeficit = (state, year, month) => {
  const income = getMonthlyIncome(state)
  const expenses = getMonthlyExpensesTotal(state, year, month)
  return income - expenses // positive = surplus, negative = deficit
}

export const getBudgetRemaining = (state, category, year, month) => {
  const limit = state.budgets[category] ?? 0
  const prefix = `${year}-${String(month).padStart(2, '0')}`
  const spent = state.expenses
    .filter(e => e.date.startsWith(prefix) && e.category === category)
    .reduce((sum, e) => sum + e.amount, 0)
  return limit - spent
}

export const getCategorySpent = (state, category, year, month) => {
  const prefix = `${year}-${String(month).padStart(2, '0')}`
  return state.expenses
    .filter(e => e.date.startsWith(prefix) && e.category === category)
    .reduce((sum, e) => sum + e.amount, 0)
}

export const getBudgetPctUsed = (state, category, year, month) => {
  const limit = state.budgets[category]
  if (!limit || limit === 0) return 0
  const spent = getCategorySpent(state, category, year, month)
  return (spent / limit) * 100
}
