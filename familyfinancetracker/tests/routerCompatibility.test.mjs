// Exercise the actual App route tree with the installed router and React.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { transformSync } from 'esbuild'
import React from 'react'
import { renderToString } from 'react-dom/server'
import * as router from 'react-router-dom'

const renderState = { path: '/', member: null, loading: false }
let appPromise
async function loadApp() {
  const context = vm.createContext({ React })
  const page = name => () => React.createElement('main', { 'data-page': name }, name)
  const store = { expenses: [], fixedDeposits: [], mutualFunds: [], milestones: [], currentUser: 'nithish', users: [{ id: 'nithish', name: 'Synthetic family member' }] }
  const module = new vm.SourceTextModule(transformSync(readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8'),
    { loader: 'jsx', format: 'esm' }).code, { context })
  await module.link(name => {
    let exports
    if (name === 'react-router-dom') exports = { ...router,
      BrowserRouter: ({ children }) => React.createElement(router.MemoryRouter, { initialEntries: [renderState.path] }, children) }
    else if (name.includes('FamilySession')) exports = { default: ({ children }) => children,
      useFamilySession: () => ({ member: renderState.member, loading: renderState.loading }) }
    else if (name.includes('useStore')) exports = { default: selector => selector(store) }
    else if (name.includes('workspace')) exports = { workspaceMode: 'personal', switchWorkspace() {} }
    else if (name.startsWith('./pages/')) exports = { default: page(name.split('/').pop().replace('.jsx', '')) }
    else if (name.includes('Header') || name.includes('BottomNav')) exports = { default: () => null }
    else if (name === 'lucide-react') exports = Object.fromEntries(
      ['Home','CreditCard','PieChart','Calendar','Briefcase','FileText','Settings'].map(key => [key, () => null]))
    else throw Error(`Unexpected import ${name}`)
    return new vm.SyntheticModule(Object.keys(exports), function () {
      for (const [key, value] of Object.entries(exports)) this.setExport(key, value)
    }, { context })
  })
  await module.evaluate()
  return module.namespace.default
}
async function renderApp(path, member, loading = false) {
  Object.assign(renderState, { path, member, loading })
  // Reuse the compiled module; repeated VM context creation can crash Node on Windows.
  const App = await (appPromise ??= loadApp())
  return renderToString(React.createElement(App))
}

test('patched router renders every existing authorized route using the actual App route tree', async () => {
  for (const name of ['Dashboard','Expenses','Assets','Milestones','Report','Employment','Settings','Budgets']) {
    const html = await renderApp('/' + name.toLowerCase(), { profileId: 'nithish' })
    assert.match(html, new RegExp(`data-page="${name}"`))
    assert.match(html, /href="\/expenses"/, 'Existing navigation links remain valid')
  }
  assert.match(await renderApp('/', null), /data-page="Auth"/)
})

test('a persisted local profile cannot render any protected page through the patched router', async () => {
  for (const name of ['Dashboard','Expenses','Assets','Milestones','Report','Employment','Settings','Budgets']) {
    assert.doesNotMatch(await renderApp('/' + name.toLowerCase(), null), /data-page=/)
  }
})

test('callback/session initialization renders only the verification screen, never registration or protected pages', async () => {
  for (const path of ['/', '/dashboard']) {
    const html = await renderApp(path, null, true)
    assert.match(html, /Verifying family access/)
    assert.doesNotMatch(html, /data-page=/)
  }
})
