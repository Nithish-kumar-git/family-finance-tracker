// The URL is the workspace boundary. A stale browser session cannot select private mode.
export function resolveWorkspace(href) {
  const path = new URL(href, 'https://workspace.invalid').pathname
  return path === '/personal' || path.startsWith('/personal/') ? 'personal' : 'demo'
}
export const workspaceMode = typeof window === 'undefined' ? 'demo' : resolveWorkspace(window.location.href)
export const dataKey = workspaceMode === 'demo' ? 'fft_demo_data_v2' : 'fft_data'
export const loginKey = workspaceMode === 'demo' ? 'fft_demo_v2_unlocked' : 'fft_personal_unlocked'
export const workspaceKey = name => workspaceMode === 'demo' ? `fft_demo_v2_${name}` : name
export const workspacePath = path => workspaceMode === 'personal' ? `/personal${path}` : path
export function switchWorkspace(mode) {
  // A full navigation creates a new store/session. Never reuse one workspace's state in the other.
  window.location.assign(mode === 'personal' ? '/personal/' : '/')
}

export function syntheticData() {
  const month = new Date().toISOString().slice(0, 7)
  return {
    users: [{ id: 'mother', name: 'Demo Household', color: '#245C46' }, { id: 'nithish', name: 'Demo Member A', color: '#65786B' }, { id: 'abeerami', name: 'Demo Member B', color: '#788A79' }],
    monthlyIncome: { pension: 22000, nithish: 30000, abeerami: 18000 },
    budgets: { groceries: 8000, utilities: 3500, transport: 4000, medical: 2000, personal: 3000, household: 16000, education: 2000, lic_premium: 1200, chit_contribution: 2000, other: 2500 },
    expenses: [{ id: 'demo-groceries', userId: 'mother', date: `${month}-02`, amount: 2400, category: 'groceries', description: 'Synthetic grocery shop', isRecurring: false },
      { id: 'demo-transport', userId: 'nithish', date: `${month}-03`, amount: 900, category: 'transport', description: 'Synthetic travel', isRecurring: false },
      ...[['demo-rent', 'household', 14000, 'Monthly rent', 'mother', '01'], ['demo-power', 'utilities', 2100, 'Electricity bill', 'mother', '04'], ['demo-market', 'groceries', 1850, 'Weekend market', 'abeerami', '06'], ['demo-pharmacy', 'medical', 650, 'Pharmacy essentials', 'mother', '07'], ['demo-lunch', 'personal', 480, 'Lunch with friends', 'nithish', '08'], ['demo-course', 'education', 1200, 'Online course', 'nithish', '05']]
        .map(([id, category, amount, description, userId, day]) => ({ id, category, amount, description, userId, date: `${month}-${day}`, isRecurring: id === 'demo-rent' }))],
    fixedDeposits: [{ id: 'demo-fd', bank: 'Example Bank', holders: ['mother'], principal: 150000, rate: 6.5, startDate: `${month}-01`, maturityDate: `${new Date().getFullYear() + 1}-12-01`, purpose: 'Demo savings', interestFrequency: 'quarterly' }],
    mutualFunds: [{ id: 'demo-mf', name: 'Example Index Fund', investedAmount: 40000, currentValue: 42500, planType: 'direct', type: 'equity' }],
    licPolicies: [{ id: 'demo-policy', insured: 'Demo Household', plan: 'Example protection plan', annualPremium: 12000, premiumsPaid: 2, nextDueDate: `${new Date().getFullYear() + 1}-03-01`, notes: 'Synthetic policy' }], chitFunds: [{ id: 'demo-chit', organizer: 'Example savings group', monthlyContribution: 2000, expectedPrize: 24000, completionDate: `${new Date().getFullYear() + 1}-06-01`, status: 'active', notes: 'Synthetic savings example' }], gold: { weightGrams: 5, currentValuePerGram: 7000 },
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
