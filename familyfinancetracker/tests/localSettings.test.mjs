import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'

const settings = readFileSync(new URL('../src/pages/Settings.jsx', import.meta.url), 'utf8')
for (const [name, next] of [['handleSaveIncome', '// ── Section C'], ['handleDeleteExpenses', '// ── Section D2'], ['handleDeleteApplications', '// ── Section E']]) {
  test(`Settings ${name} preserves drafts/records and reports errors on rejected or unconfirmed operations`, async () => {
    for (const reply of [{ ok: false, json: async () => ({ deleted: true }) }, { ok: true, json: async () => ({ deleted: false }) }]) {
      if (name === 'handleSaveIncome' && reply.ok) continue
      let writes = 0
      const toasts = []
      const context = vm.createContext({ pension: '12', nithish: '34', abeerami: '56', importMeta: { env: { VITE_API_URL: 'https://synthetic.invalid' } },
        selectedExpMonth: '2026-10', expCountForMonth: 1, selectedAppStatus: 'all', appCountForStatus: 1,
        authorizedFetch: async () => reply, saveLocalChanges: () => { writes++ }, updateMonthlyIncome: () => { writes++ },
        setDeleteExpModal() {}, setDeleteAppModal() {}, showToast: (message, type) => toasts.push({ message, type }), encodeURIComponent,
      })
      const start = settings.indexOf('  async function ' + name)
      const end = settings.indexOf(next, start)
      assert.ok(start >= 0 && end > start)
      const source = settings.slice(start, end).replaceAll('import.meta', 'importMeta')
      vm.runInContext(source + `; globalThis.run = ${name}`, context)
      await context.run()
      assert.equal(writes, 0)
      assert.equal(toasts.length, 1); assert.equal(toasts[0].type, 'error')
    }
  })
}

test('reports and expense summaries use edited budget totals; no fixed household target is embedded in those calculations', () => {
  const report = readFileSync(new URL('../src/hooks/useReport.js', import.meta.url), 'utf8')
  const budgets = readFileSync(new URL('../src/pages/Budgets.jsx', import.meta.url), 'utf8')
  const expenses = readFileSync(new URL('../src/pages/Expenses.jsx', import.meta.url), 'utf8')
  for (const text of [report, budgets, expenses]) assert.doesNotMatch(text, /85800|85,800|36,375/)
  assert.match(report, /budget_monthly_target: budgetTarget/)
})
