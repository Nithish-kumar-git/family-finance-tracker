import { useState } from 'react'
import { resetDemoWorkspace } from '../store/useStore.js'
import { workspaceMode } from '../utils/workspace.js'

export default function DemoTools() {
  const [confirm, setConfirm] = useState(false), [error, setError] = useState('')
  if (workspaceMode !== 'demo') return null
  function reset() {
    try { resetDemoWorkspace(); window.location.assign('/') }
    catch { setError('Demo reset was not saved. Allow browser storage and try again; personal records are unchanged.') }
  }
  return <section className="surface mb-6 space-y-3">
    <h2>Your interactive demo</h2>
    <p className="text-sm text-muted">Explore expenses, edit budgets and assets, and save a report. All records are synthetic. Your changes stay in this browser and never reach the household database.</p>
    {!confirm ? <button className="text-sm text-accent underline" onClick={() => setConfirm(true)}>Reset demo examples</button>
      : <div><p className="text-sm mb-2">Replace this demo’s edits with fresh examples? Personal records and PINs remain untouched.</p><button className="action" onClick={reset}>Reset this demo only</button><button className="ml-4 text-sm underline" onClick={() => setConfirm(false)}>Cancel</button></div>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    <details className="text-xs text-muted pt-2"><summary className="cursor-pointer">Owner access</summary><p className="mt-2">Separate device-local PIN workspace. Cross-device database sync is not connected.</p><a href="/personal/" className="inline-block text-accent underline mt-2">Open owner workspace</a></details>
  </section>
}
