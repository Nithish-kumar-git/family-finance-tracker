// Run: node --experimental-vm-modules --test tests/dataRecovery.test.mjs
// Only the disabled implementation executes. No real store, browser or API.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { transformSync } from 'esbuild'

globalThis.fetch = () => { throw Error('External network blocked in tests') }
const utilitySource = readFileSync(new URL('../src/utils/dataRecovery.js', import.meta.url), 'utf8')
const settingsSource = readFileSync(new URL('../src/pages/Settings.jsx', import.meta.url), 'utf8')
const buttonSource = readFileSync(new URL('../src/components/ui/Button.jsx', import.meta.url), 'utf8')

function syntheticEnvironment() {
  const fixture = {
    expenses: [
      { id: 'synthetic-may', userId: 'synthetic-user', date: '2026-05-01', amount: 1 },
      { id: 'synthetic-june', userId: 'synthetic-user', date: '2026-06-01', amount: 2 },
    ],
    users: [{ id: 'synthetic-user', name: 'Synthetic user' }],
    settings: { synthetic: true },
  }
  const storage = new Map([
    ['fft_data', JSON.stringify(fixture)], ['fft_currentUser', 'synthetic-user'],
    ['synthetic-unrelated', 'keep'],
  ])
  const before = JSON.stringify([...storage])
  const calls = { reads: 0, writes: 0, removals: 0, clears: 0, network: 0, reloads: 0, logs: 0, state: 0 }
  const blocked = key => () => { calls[key]++; throw Error(`Unexpected synthetic ${key} operation`) }
  const context = vm.createContext({
    localStorage: {
      getItem: blocked('reads'), setItem: blocked('writes'),
      removeItem: blocked('removals'), clear: blocked('clears'),
    },
    fetch: blocked('network'),
    window: { location: { reload: blocked('reloads') } },
    console: { log: blocked('logs'), error: blocked('logs'), warn: blocked('logs') },
  })
  return {
    context, calls,
    assertUntouched() {
      assert.equal(JSON.stringify([...storage]), before)
      assert.ok(Object.values(calls).every(count => count === 0), 'No storage, network, reload, logging or state side effects')
    },
  }
}

async function loadDisabledUtility(context) {
  const module = new vm.SourceTextModule(utilitySource, { context })
  await module.link(() => { throw Error('Disabled recovery must not import API/store dependencies') })
  await module.evaluate()
  return module
}

function assertDisabled(result, message) {
  assert.equal(result.success, false)
  assert.equal(result.disabled, true)
  assert.equal(result.error, 'RECOVERY_DISABLED')
  assert.equal(result.message, message)
  assert.ok(message.includes('complete, validated backup'))
  assert.ok(!Object.hasOwn(result, 'data'), 'No replacement arrays or recovered payload')
}

for (const entry of ['restoreData', 'recoverDataFromBackend']) {
  test(`${entry} fails closed and leaves all synthetic storage unchanged`, async () => {
    const environment = syntheticEnvironment()
    const module = await loadDisabledUtility(environment.context)
    const result = await module.namespace[entry]()
    assertDisabled(result, module.namespace.RESTORE_UNAVAILABLE_MESSAGE)
    environment.assertUntouched()
  })
}

test('repeated attempts remain disabled and caller mutation cannot make later attempts successful', async () => {
  const environment = syntheticEnvironment()
  const module = await loadDisabledUtility(environment.context)
  const first = await module.namespace.restoreData()
  first.success = true
  first.data = { expenses: [] }
  for (let attempt = 0; attempt < 5; attempt++) {
    assertDisabled(await module.namespace.restoreData(), module.namespace.RESTORE_UNAVAILABLE_MESSAGE)
    assertDisabled(await module.namespace.recoverDataFromBackend(), module.namespace.RESTORE_UNAVAILABLE_MESSAGE)
  }
  environment.assertUntouched()
})

test('disabled recovery settles without browser globals or API configuration', async () => {
  const module = await loadDisabledUtility(vm.createContext({}))
  assertDisabled(await module.namespace.restoreData(), module.namespace.RESTORE_UNAVAILABLE_MESSAGE)
  assertDisabled(await module.namespace.recoverDataFromBackend(), module.namespace.RESTORE_UNAVAILABLE_MESSAGE)
})

test('actual Settings recovery control and actual Button are disabled with no handler or loading state', async () => {
  const environment = syntheticEnvironment()
  const { context, calls } = environment
  const recovery = await loadDisabledUtility(context)
  // In-memory JSX transformation for this isolated test, not an app build.
  const jsx = source => transformSync(source, { loader: 'jsx', format: 'esm', jsx: 'transform' }).code
  const createElement = (type, props, ...children) => ({ type, props: { ...props, children } })
  context.React = { createElement, Fragment: Symbol('synthetic-fragment') }
  const button = new vm.SourceTextModule(jsx(buttonSource), { context })
  await button.link(() => { throw Error('Unexpected Button import') })
  await button.evaluate()
  const fakeStore = {
    monthlyIncome: { pension: 0, nithish: 0, abeerami: 0 }, users: [],
    emergencyFund: { target: 0, isIsolated: false, cashInBank: 0, rule: 'Synthetic' },
    expenses: [], jobApplications: [], isOffline: false,
  }
  const unexpectedStateChange = () => { calls.state++; throw Error('Unexpected synthetic state change') }
  const stub = () => null
  const exports = {
    react: { useState: initial => [typeof initial === 'function' ? initial() : initial, unexpectedStateChange], useEffect: () => {} },
    'react-router-dom': { useNavigate: () => unexpectedStateChange },
    'lucide-react': Object.fromEntries(['Shield', 'User', 'Wallet', 'Trash2', 'RefreshCw', 'Activity', 'ChevronRight', 'AlertTriangle', 'CheckCircle', 'XCircle', 'Lock'].map(name => [name, stub])),
    '../store/useStore': { default: selector => selector(fakeStore), saveLocalChanges: unexpectedStateChange },
    '../components/WorkspaceEditor.jsx': { default: stub },
    '../components/RecoveryPanel.jsx': { default: stub },
    '../utils/formatters': { formatCurrency: () => 'Synthetic amount' },
    '../components/ui/Button': { default: button.namespace.default },
    '../components/ui/Card': { default: stub },
    '../components/ui/Input': { default: stub },
  }
  const settings = new vm.SourceTextModule(jsx(settingsSource), { context })
  await settings.link(specifier => {
    if (specifier.includes('authorizedFetch')) return new vm.SyntheticModule(['authorizedFetch'], function () { this.setExport('authorizedFetch', () => { throw Error('Unexpected recovery network call') }) }, { context })
    if (specifier === '../utils/dataRecovery') return recovery
    const values = exports[specifier]
    if (!values) throw Error('Unexpected Settings import')
    return new vm.SyntheticModule(Object.keys(values), function () {
      for (const [name, value] of Object.entries(values)) this.setExport(name, value)
    }, { context })
  })
  await settings.evaluate()
  const nodes = []
  function visit(node) {
    if (Array.isArray(node)) { node.forEach(visit); return }
    if (node && typeof node === 'object' && node.props) { nodes.push(node); visit(node.props.children) }
  }
  visit(settings.namespace.default())
  const controls = nodes.filter(node => node.props.id === 'btn-recover-data')
  assert.equal(controls.length, 1)
  const control = controls[0]
  assert.equal(control.props.disabled, true)
  assert.equal(control.props.onClick, undefined)
  assert.equal(control.props.loading, undefined)
  assert.ok(nodes.some(node => node.type === 'p' && node.props.children.includes(recovery.namespace.RESTORE_UNAVAILABLE_MESSAGE)))
  const nativeButton = button.namespace.default(control.props)
  assert.equal(nativeButton.type, 'button')
  assert.equal(nativeButton.props.disabled, true)
  assert.equal(nativeButton.props.onClick, undefined)
  assert.ok(nativeButton.props.className.includes('cursor-not-allowed'))
  assert.ok(!nativeButton.props.className.includes('animate-spin'))
  // Even a forced programmatic attempt cannot reach a handler or recovery.
  nativeButton.props.onClick?.()
  assert.ok(!settingsSource.includes('recoveryLoading') && !settingsSource.includes('handleRecoverData'))
  environment.assertUntouched()
})
