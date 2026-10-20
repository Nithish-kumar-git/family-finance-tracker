import vm from 'node:vm'
import { readFileSync } from 'node:fs'
import { webcrypto } from 'node:crypto'
import { create } from 'zustand'
export function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial))
  return { values, get length() { return values.size }, key: index => [...values.keys()][index] ?? null, getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key) }
}
export async function browserHarness({ demo = false, localStorage = memoryStorage(), sessionStorage = memoryStorage(), href } = {}) {
  const context = vm.createContext({ URL, URLSearchParams, TextEncoder, Uint8Array, crypto: webcrypto, structuredClone, localStorage, sessionStorage,
    fetch: () => { throw Error('Network forbidden in browser workspace tests') },
    window: { location: { href: href ?? `https://synthetic.invalid/${demo ? '' : 'personal/'}`, origin: 'https://synthetic.invalid', assign() {} } },
  })
  const cache = new Map()
  async function load(file) {
    const url = new URL(file, import.meta.url)
    if (cache.has(url.href)) return cache.get(url.href)
    const module = new vm.SourceTextModule(readFileSync(url, 'utf8'), { context })
    cache.set(url.href, module)
    await module.link(name => name === 'zustand' ? new vm.SyntheticModule(['create'], function () { this.setExport('create', create) }, { context }) : load(new URL(name, url).href))
    return module
  }
  const transport = await load('../src/utils/authorizedFetch.js'); await transport.evaluate()
  const repo = cache.get(new URL('../src/utils/browserRepository.js', import.meta.url).href)
  const store = cache.get(new URL('../src/store/useStore.js', import.meta.url).href).namespace.default
  const login = cache.get(new URL('../src/utils/localLogin.js', import.meta.url).href).namespace
  const workspace = cache.get(new URL('../src/utils/workspace.js', import.meta.url).href).namespace
  return { resetDemoWorkspace: cache.get(new URL('../src/store/useStore.js', import.meta.url).href).namespace.resetDemoWorkspace, request: repo.namespace.browserRequest, transport: transport.namespace.authorizedFetch, store, login, workspace, localStorage, sessionStorage }
}
