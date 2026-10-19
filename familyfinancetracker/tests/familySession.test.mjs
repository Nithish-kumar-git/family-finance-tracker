import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'
import { transformSync } from 'esbuild'

const read = file => readFileSync(new URL(file, import.meta.url), 'utf8')
const flush = async () => { for (let i = 0; i < 25; i++) await Promise.resolve() }
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }

async function componentHarness(file, dependencies, globals = {}) {
  const slots = [], effects = []
  let cursor = 0
  const context = vm.createContext({ AbortController, setTimeout, clearTimeout, ...globals })
  context.React = { createElement: (type, props, ...children) => ({ type, props: { ...props, children } }) }
  const hooks = {
    createContext: () => ({ Provider: 'context-provider' }), useContext: () => null,
    useState(value) {
      const index = cursor++
      if (!(index in slots)) slots[index] = typeof value === 'function' ? value() : value
      return [slots[index], next => { slots[index] = typeof next === 'function' ? next(slots[index]) : next }]
    },
    useRef(value) { const index = cursor++; return slots[index] ?? (slots[index] = { current: value }) },
    useEffect(callback, deps) {
      const index = cursor++, previous = slots[index]
      if (!previous || deps.some((value, i) => value !== previous.deps[i])) effects.push(() => {
        previous?.cleanup?.(); slots[index] = { deps, callback, cleanup: callback() }
      })
    },
  }
  const module = new vm.SourceTextModule(transformSync(read(file), { loader: 'jsx', format: 'esm' }).code, {
    context, initializeImportMeta: meta => { meta.env = { VITE_API_URL: 'https://synthetic.invalid' } },
  })
  await module.link(name => {
    const exports = name === 'react' ? hooks : dependencies[name]
    assert.ok(exports, `Unexpected import ${name}`)
    return new vm.SyntheticModule(Object.keys(exports), function () {
      for (const [key, value] of Object.entries(exports)) this.setExport(key, value)
    }, { context })
  })
  await module.evaluate()
  return {
    render() { cursor = 0; const tree = module.namespace.default({ children: 'synthetic-child' }); while (effects.length) effects.shift()(); return tree },
    unmount() { slots.forEach(slot => slot?.cleanup?.()) },
    replayEffects() { for (const slot of slots) if (slot?.callback) { slot.cleanup?.(); slot.cleanup = slot.callback() } },
  }
}

async function sessionHarness({ restored = null, unlock = async () => {} } = {}) {
  const writes = [], users = [{ id: 'mother', name: 'Synthetic parent' }]
  let locked = 0
  const h = await componentHarness('../src/components/FamilySession.jsx', {
    '../utils/localLogin.js': { unlockedProfile: () => restored, unlockProfile: unlock, lockWorkspace: () => { locked++ } },
    '../store/useStore.js': { default: { getState: () => ({ users, setCurrentUser: id => writes.push(id) }) } },
  })
  return { ...h, writes, locked: () => locked }
}

test('a persisted data profile alone cannot unlock the application', async () => {
  const h = await sessionHarness()
  h.render()
  assert.equal(h.render().props.value.member, null)
  assert.equal(h.render().props.value.loading, false)
  assert.deepEqual(h.writes, [])
})
test('successful PIN verification activates the selected profile only after acknowledgement', async () => {
  const pending = deferred(), h = await sessionHarness({ unlock: () => pending.promise })
  h.render()
  const login = h.render().props.value.signIn('mother', 'synthetic-pin')
  assert.equal(h.render().props.value.member, null)
  pending.resolve(); await login
  assert.equal(h.render().props.value.member.profileId, 'mother')
  assert.deepEqual(h.writes, ['mother'])
  await h.render().props.value.signOut()
  assert.equal(h.render().props.value.member, null); assert.equal(h.locked(), 1)
  assert.equal(h.writes.at(-1), null)
})
test('wrong PIN leaves the protected app locked', async () => {
  const h = await sessionHarness({ unlock: async () => { throw Error('Incorrect PIN') } })
  h.render()
  await assert.rejects(h.render().props.value.signIn('mother', 'synthetic-wrong'), /Incorrect PIN/)
  assert.equal(h.render().props.value.member, null); assert.deepEqual(h.writes, [])
})
test('same-tab refresh restores a local profile and sign-out requires unlocking again', async () => {
  const h = await sessionHarness({ restored: 'mother' })
  h.render()
  assert.equal(h.render().props.value.member.local, true)
  await h.render().props.value.signOut()
  assert.equal(h.render().props.value.member, null)
})
test('original profile/PIN screen replaces email login and opens the existing dashboard route', async () => {
  const Navigate = () => null
  let member = null, calls = 0
  const h = await componentHarness('../src/pages/Auth.jsx', {
    'react-router-dom': { Navigate }, 'lucide-react': { ChevronRight: () => null },
    '../store/useStore.js': { default: selector => selector({ users: [{ id: 'mother', name: 'Synthetic parent' }] }) },
    '../utils/localLogin.js': { hasPin: () => true },
    '../utils/workspace.js': { workspaceMode: 'personal', switchWorkspace() {} },
    '../components/FamilySession.jsx': { useFamilySession: () => ({ member, signIn: async () => { calls++; member = { profileId: 'mother' } } }) },
  })
  const nodes = tree => { const all = []; const visit = n => { if (Array.isArray(n)) n.forEach(visit); else if (n?.props) { all.push(n); visit(n.props.children) } }; visit(tree); return all }
  assert.doesNotMatch(JSON.stringify(h.render()), /Email me|email-link|Supabase/)
  nodes(h.render()).find(n => n.type === 'button').props.onClick()
  nodes(h.render()).find(n => n.props['aria-label'] === 'Enter PIN').props.onChange({ target: { value: '1739' } })
  h.render(); await flush()
  const result = h.render(); assert.equal(result.type, Navigate); assert.equal(result.props.to, '/dashboard'); assert.equal(calls, 1)
})
