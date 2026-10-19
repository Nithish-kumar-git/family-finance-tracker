import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'
import { syntheticData } from '../src/utils/workspace.js'
import { EXPENSE_CATEGORIES } from '../src/data/seedData.js'
import * as formatters from '../src/utils/formatters.js'

async function hook(file, state) {
  const blocked = () => { throw Error('Network and persistence forbidden during reads') }
  const context = vm.createContext({ Date, fetch: blocked, localStorage: { getItem: blocked, setItem: blocked } })
  const module = new vm.SourceTextModule(readFileSync(new URL(file, import.meta.url), 'utf8'), { context })
  await module.link(name => {
    const values = name.includes('useStore') ? { default: { getState: () => state, setState: blocked } }
      : name === 'react' ? { useCallback: fn => fn }
      : name.includes('formatters') ? formatters
      : name.includes('seedData') ? { EXPENSE_CATEGORIES }
      : name.includes('api') ? { api: new Proxy({}, { get: blocked }) } : null
    if (!values) throw Error('Unexpected import: ' + name)
    return new vm.SyntheticModule(Object.keys(values), function () { for (const [key, value] of Object.entries(values)) this.setExport(key, value) }, { context })
  })
  await module.evaluate()
  return module.namespace
}
test('asset reads preserve loaded collections without network or persistence even when empty', async () => {
  for (const state of [syntheticData(), { fixedDeposits: [], mutualFunds: [], licPolicies: [], chitFunds: [] }]) {
    const source = JSON.stringify(state), module = await hook('../src/hooks/useAssets.js', state)
    const result = await module.useAssets().loadAssets()
    assert.equal(result.fixedDeposits, state.fixedDeposits)
    assert.equal(result.mutualFunds, state.mutualFunds)
    assert.equal(JSON.stringify(state), source)
  }
})
test('asset read failure is explicit rather than a successful zero balance', async () => {
  const module = await hook('../src/hooks/useAssets.js', { storageReadError: true })
  assert.match((await module.useAssets().loadAssets()).loadError, /totals are unavailable/)
})
test('monthly report includes opaque legacy categories and uses editable budgets', async () => {
  const state = syntheticData()
  state.expenses = [{ id: 'synthetic-legacy', date: '2026-10-01', category: 'old-opaque-category', amount: 15 }, { id: 'synthetic-known', date: '2026-10-02', category: 'groceries', amount: 30 }]
  state.budgets = { groceries: 100, other: 50 }
  const module = await hook('../src/hooks/useReport.js', state)
  const report = module.useReport().generateReportForMonth(2026, 10)
  assert.equal(report.cash_flow.expenses_by_category.total, 45)
  assert.equal(report.cash_flow.expenses_by_category.other, 15)
  assert.equal(report.cash_flow.budget_monthly_target, 150)
  assert.equal(report.cash_flow.variance_from_budget, 105)
  assert.equal(report.corpus.total_corpus, 267500)
})
