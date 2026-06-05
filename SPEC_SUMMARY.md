# FAMILYFINANCETRACKER — SPEC SUMMARY
# Quick reference. Prevents hallucinated field names and endpoints.
# Full spec: SUPER_MASTER_PROMPT_V2.md

## EXACT MODEL FIELD NAMES

Expense: id, userId, amount, category, description, date, isRecurring, created_at, updated_at
FixedDeposit: id, bank, holders, principal, rate, startDate, maturityDate, purpose, notes, created_at, updated_at
  purpose values: "emergency"|"marriage"|"renovation"|"core"
MutualFund: id, name, platform, investedAmount, currentValue, purchaseDate, planType, type, notes, created_at, updated_at
  planType: "direct"|"regular" | type: "equity"|"debt"|"hybrid"
LICPolicy: id, insured, plan, annualPremium, nextDueDate, premiumsPaid, paidUpEligibleDate, notes, created_at, updated_at
ChitFund: id, organizer, monthlyContribution, expectedPrize, completionDate, status, notes, created_at, updated_at
  status: "active"|"completed"|"defaulted"
Gold: id, weightGrams, currentValuePerGram, lastUpdated, notes, created_at, updated_at
EmergencyFund: id, target, liquidFundBalance, cashInBank, isIsolated, rule, created_at, updated_at
MonthlyIncome: id, pension, nithish, abeerami, created_at, updated_at
Milestone: id, title, date, category, status, amount, isUrgent, isDangerous, notes, created_at, updated_at
  category: "form_submission"|"account_setup"|"fd_maturity"|"lic_premium"|"chit_completion"|"employment"|"other"
  status: "pending"|"done"|"skipped"
JobApplication: id, company, role, platform, appliedDate, status, followUpDate, notes, created_at, updated_at
  status: "applied"|"interview_scheduled"|"interviewed"|"rejected"|"offered"|"accepted"
MonthlySnapshot: id, month, totalIncome, totalExpenses, deficit, corpusTotal, emergencyFundBalance, milestonesDone, milestonesOverdue, notes, created_at, updated_at

## EXPENSE CATEGORIES (exact keys)
groceries | utilities | medical | transport | household |
lic_premium | chit_contribution | personal | education | other

## ALL API ENDPOINTS
GET/POST/DELETE /api/expenses | DELETE /api/expenses/bulk
GET/POST/PUT/DELETE /api/assets/fds
GET/POST/DELETE /api/assets/mf | PATCH /api/assets/mf/{id}/update-value
GET/POST/DELETE /api/assets/lic | PATCH /api/assets/lic/{id}/mark-paid
GET/POST/PUT/DELETE /api/assets/chits
GET/PATCH /api/assets/gold | GET /api/assets/summary
GET/POST/PATCH/DELETE /api/milestones
GET/POST/PATCH/DELETE /api/employment | DELETE /api/employment/bulk | GET /api/employment/stats
GET/POST /api/reports/snapshot | GET /api/reports/snapshots
POST /api/ai/parse-transaction | POST /api/ai/monthly-insights | POST /api/ai/chat
DELETE /api/reset
GET /health

## FRONTEND ROUTES
/ → Auth | /dashboard → Dashboard | /expenses → Expenses
/assets → Assets | /milestones → Milestones | /employment → Employment
/report → Report | /settings → Settings

## ZUSTAND STORE ACTIONS (exact names)
setCurrentUser | addExpense | deleteExpense | updateBudget |
updateMilestoneStatus | addJobApplication | updateJobStatus |
updateMutualFundValue | markLICPaid | updateGold | setIsOffline |
addMonthlySnapshot | updateMonthlyIncome

## API.JS NAMESPACES
api.expenses.{getByMonth, add, remove, bulkDelete}
api.assets.{getSummary, getAll, updateGold, markLICPaid, updateMFValue}
api.milestones.{getAll, updateStatus, add, remove}
api.employment.{getAll, add, updateStatus, getStats, bulkDelete}
api.reports.{getSnapshot, saveSnapshot, getAllSnapshots}
api.ai.{parseTransaction, getMonthlyInsights, chat}
api.reset.resetAll()

## TAILWIND COLORS
Primary: violet-600 | Success: emerald-600 | Danger: red-600
Warning: amber-500 | Surface: slate-50 | Border: slate-100
Card: rounded-xl shadow-sm border border-slate-100 bg-white p-4

## GEMINI MODEL
gemini-1.5-flash | temperature 0.0 for parser | temperature 0.3 for insights and chat
