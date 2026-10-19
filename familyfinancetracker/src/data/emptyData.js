// No financial records or login PINs are embedded in the public application.
// Existing fft_data browser storage is retained verbatim by the store loader.
export const INITIAL_DATA = {
  currentUser: null, isOffline: false,
  users: [
    { id: 'mother', name: 'Amma', color: '#245C46' },
    { id: 'nithish', name: 'Nithish', color: '#65786B' },
    { id: 'abeerami', name: 'Abeerami', color: '#788A79' },
  ],
  expenses: [], budgets: {}, fixedDeposits: [], mutualFunds: [], licPolicies: [], chitFunds: [],
  gold: { weightGrams: 0, currentValuePerGram: 0, lastUpdated: null },
  emergencyFund: { liquidFundBalance: 0, cashInBank: 0, target: 0, isIsolated: true },
  monthlyIncome: { pension: 0, nithish: 0, abeerami: 0 },
  milestones: [], jobApplications: [], monthlySnapshots: [],
}
