// Browser workspaces never connect to the household database.
export const workspaceMode = (() => {
  if (typeof window === 'undefined') return 'personal'
  const demoLink = new URL(window.location.href).searchParams.get('demo') === '1'
  if (demoLink) { try { sessionStorage.setItem('fft_workspace', 'demo') } catch { /* Stay isolated even if storage is blocked. */ }; return 'demo' }
  try { return sessionStorage.getItem('fft_workspace') === 'demo' ? 'demo' : 'personal' }
  catch { return 'personal' }
})()
export const dataKey = workspaceMode === 'demo' ? 'fft_demo_data_v1' : 'fft_data'
export const loginKey = `fft_${workspaceMode}_unlocked`
export const workspaceKey = name => workspaceMode === 'demo' ? `demo_${name}` : name
export function switchWorkspace(mode) {
  sessionStorage.removeItem(loginKey)
  sessionStorage.setItem('fft_workspace', mode === 'demo' ? 'demo' : 'personal')
  window.location.assign(mode === 'demo' ? '/?demo=1' : '/')
}

export function syntheticData() {
  const month = new Date().toISOString().slice(0, 7)
  return {
    users: [{ id: 'mother', name: 'Demo Parent', color: '#7C3AED' }, { id: 'nithish', name: 'Demo Graduate', color: '#0891B2' }, { id: 'abeerami', name: 'Demo Professional', color: '#059669' }],
    monthlyIncome: { pension: 22000, nithish: 30000, abeerami: 18000 },
    budgets: { groceries: 8000, utilities: 3500, transport: 4000, medical: 2000, personal: 3000, other: 2500 },
    expenses: [{ id: 'demo-groceries', userId: 'mother', date: `${month}-02`, amount: 2400, category: 'groceries', description: 'Synthetic grocery shop', isRecurring: false },
      { id: 'demo-transport', userId: 'nithish', date: `${month}-03`, amount: 900, category: 'transport', description: 'Synthetic travel', isRecurring: false }],
    fixedDeposits: [{ id: 'demo-fd', bank: 'Example Bank', principal: 150000, rate: 6.5, startDate: `${month}-01`, maturityDate: `${new Date().getFullYear() + 1}-12-01`, purpose: 'Demo savings', interestFrequency: 'quarterly' }],
    mutualFunds: [{ id: 'demo-mf', name: 'Example Index Fund', investedAmount: 40000, currentValue: 42500, planType: 'direct', type: 'equity' }],
    licPolicies: [], chitFunds: [], gold: { weightGrams: 5, currentValuePerGram: 7000 },
    emergencyFund: { liquidFundBalance: 25000, cashInBank: 15000, target: 100000, isIsolated: true },
    milestones: [{ id: 'demo-goal', title: 'Build a savings buffer', category: 'other', status: 'pending', date: `${new Date().getFullYear() + 1}-01-01`, amount: 100000, notes: 'Synthetic demonstration goal' }],
    jobApplications: [{ id: 'demo-job', company: 'Example Company', role: 'Graduate Engineer', status: 'applied', appliedDate: `${month}-01`, platform: 'Company website', notes: 'Synthetic example' }],
    monthlySnapshots: [],
  }
}

export function writeWorkspace(state, storage = localStorage) {
  if (state.storageReadError) throw Error('Existing browser data could not be read. It has not been overwritten.')
  const { isOffline, persistenceError, currentUser, ...data } = state
  storage.setItem(dataKey, JSON.stringify(data))
}
