import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { transformSync } from 'esbuild'
import * as calculations from '../src/utils/calculations.js'
import { syntheticData } from '../src/utils/workspace.js'

test('the actual dashboard counts each savings bucket once and distinguishes isolation from target progress', async () => {
  const data = { ...syntheticData(), currentUser: 'mother', monthlySnapshots: [] }
  const source = readFileSync(new URL('../src/pages/Dashboard.jsx', import.meta.url), 'utf8')
  const context = vm.createContext({ Date, React: { createElement: (type, props, ...children) => ({ type, props: { ...props, children } }) } })
  const module = new vm.SourceTextModule(transformSync(source, { loader: 'jsx', format: 'esm' }).code, { context })
  await module.link(name => {
    let exports
    if (name === 'react') exports = { useState: value => [value === true ? false : typeof value === 'function' ? value() : value, () => {}], useEffect() {}, useRef: value => ({ current: value }) }
    else if (name === 'react-router-dom') exports = { useNavigate: () => () => {} }
    else if (name.includes('useStore')) exports = { default: selector => selector ? selector(data) : data }
    else if (name.includes('calculations')) exports = calculations
    else if (name.includes('formatters')) exports = { formatCurrency: value => `AMOUNT:${value}`, formatDeficit: value => String(value), formatDate: () => 'Synthetic date', daysUntil: () => 7, formatMonth: () => 'Synthetic month', getGreeting: () => 'Hello' }
    else if (name.includes('workspace')) exports = { workspaceMode: 'demo' }
    else if (name.includes('api')) exports = { api: {} }
    else if (name.includes('seedData')) exports = { EXPENSE_CATEGORIES: {} }
    else if (name.includes('ammaChat')) exports = { getChatErrorMessage: () => '' }
    else if (name === 'lucide-react') exports = Object.fromEntries(['MessageCircle','AlertCircle','Plus','Send','ChevronRight','AlertTriangle','Lock','Briefcase','TrendingUp','X','Loader2','ShoppingCart','Zap','Heart','Car','Home','Shield','Users','User','BookOpen','MoreHorizontal','ArrowUpRight','ArrowDownRight','Wallet','PiggyBank','Bot','Sparkles','RefreshCw'].map(key => [key, () => null]))
    else if (name === 'recharts') exports = Object.fromEntries(['BarChart','Bar','XAxis','YAxis','Tooltip','ResponsiveContainer','AreaChart','Area','LineChart','Line'].map(key => [key, () => null]))
    else exports = { default: () => null }
    return new vm.SyntheticModule(Object.keys(exports), function () { for (const [key, value] of Object.entries(exports)) this.setExport(key, value) }, { context })
  })
  await module.evaluate()
  const tree = module.namespace.default()
  const text = JSON.stringify(tree)
  assert.equal(calculations.getTotalCorpus(data), 267500)
  assert.equal((text.match(/AMOUNT:267500/g) ?? []).length, 1, 'Net worth appears once')
  assert.ok(text.includes(`AMOUNT:${calculations.getMonthlyIncome(data) - data.expenses.reduce((sum, expense) => sum + expense.amount, 0)}`), 'Employment summary reflects actual monthly surplus')
  assert.doesNotMatch(text, /AMOUNT:282500/)
  assert.match(text, /Below emergency-fund target/)
  assert.doesNotMatch(text, /Not yet isolated/)
})

test('Netlify revalidates the app shell and does not cache service-worker update files', () => {
  const headers = readFileSync(new URL('../public/_headers', import.meta.url), 'utf8').replaceAll('\r\n', '\n')
  assert.match(headers, /\/sw\.js\n\s+Cache-Control: no-store, must-revalidate/)
  assert.match(headers, /\/index\.html\n\s+Cache-Control: no-cache, must-revalidate/)
})

test('employment projection follows editable budgets and income', () => {
  const result = calculations.getEmploymentProjection({ budgets: { groceries: 10000, rent: 5000 }, monthlyIncome: { pension: 4000, abeerami: 1000 } }, 12000)
  assert.deepEqual(result, { budget: 15000, baselineDeficit: 10000, deficit: -2000 })
})
