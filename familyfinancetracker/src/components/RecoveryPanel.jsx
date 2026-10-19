import { useState } from 'react'
import useStore, { saveLocalChanges } from '../store/useStore.js'
import { workspaceMode } from '../utils/workspace.js'
import { parseRecoveryFile, planRecovery, applyRecovery, listPreservedSources, preserveSource, ownerExportQuery } from '../utils/recordRecovery.js'

export default function RecoveryPanel() {
  const state = useStore(), [review, setReview] = useState(null), [message, setMessage] = useState(''), [revision, setRevision] = useState(0)
  if (workspaceMode === 'demo') return <section className="surface mb-8"><h2>Demo data is separate</h2><p className="text-sm text-muted mt-2">Personal backups and records are never opened by the recruiter demo.</p></section>
  let archives = []
  try { archives = listPreservedSources(localStorage) } catch { /* Error appears on save/import. */ }
  function prepare(raw) {
    try { const parsed = parseRecoveryFile(raw); setReview({ raw, parsed, plan: planRecovery(useStore.getState(), parsed.data) }); setMessage('Review the counts below before merging. Existing values remain active where versions conflict.') }
    catch (error) { setReview(null); setMessage(error.message) }
  }
  async function choose(event) {
    const file = event.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) { setMessage('Choose a backup smaller than 10 MiB.'); return }
    try { prepare(await file.text()) } catch { setMessage('Could not read this file. Nothing was changed.') }
    event.target.value = ''
  }
  function merge() {
    try { const next = applyRecovery({ storage: localStorage, current: useStore.getState(), parsed: review.parsed, rawSource: review.raw }); useStore.setState(next); setReview(null); setRevision(revision + 1); setMessage('Missing records merged on this device. Original sources are preserved; conflicting versions await your review below.') }
    catch { setMessage('Not imported. Browser storage could not preserve and save the backup. Your existing records remain active.') }
  }
  function resolve(index, incoming) {
    try {
      const current = useStore.getState(), conflict = current.recoveryConflicts[index]
      preserveSource(localStorage, localStorage.getItem('fft_data'), 'before-conflict-resolution')
      const patch = incoming ? { [conflict.collection]: conflict.field
        ? { ...current[conflict.collection], [conflict.field]: conflict.incoming }
        : [...current[conflict.collection].filter(row => row.id !== conflict.id), { ...current[conflict.collection].find(row => row.id === conflict.id), ...conflict.incoming }] } : {}
      saveLocalChanges({ ...patch, recoveryConflicts: current.recoveryConflicts.filter((_, i) => i !== index), recoveryResolutions: [...(current.recoveryResolutions ?? []), { ...conflict, choice: incoming ? 'imported' : 'current', resolvedAt: new Date().toISOString() }] })
      setMessage('Choice saved. Both versions remain in the preserved source and resolution history.'); setRevision(revision + 1)
    } catch { setMessage('Choice was not saved. No active records were replaced.') }
  }
  return <section className="surface mb-8 space-y-5" data-revision={revision}>
    <div><p className="eyebrow">Personal data</p><h2>Recover & reconcile records</h2><p className="text-sm text-muted mt-2">An empty browser is not proof that cloud records are gone. Cloud sync is disconnected. Import your own backup here; its contents stay in this browser. No seeding or database writes.</p></div>
    <label className="block text-sm font-medium">Review a JSON backup or snapshot CSV<input className="block mt-2 w-full" type="file" accept=".json,.csv,application/json,text/csv" onChange={choose} /></label>
    {message && <p role="status" className="text-sm text-accent">{message}</p>}
    {review && <div className="border rounded-lg p-4 space-y-3"><h3>Import preview</h3><p className="text-sm">{Object.entries(review.plan.counts).map(([key, count]) => `${key}: ${count} new`).join(' · ') || 'No new ID-based records'}</p><p className="text-sm">{review.plan.conflicts.length} conflicts will be preserved for review. Existing values will not be replaced automatically.</p>{review.parsed.unsupported.length > 0 && <p className="text-sm">Unmapped fields retained in the source archive: {review.parsed.unsupported.join(', ')}</p>}<button className="action" onClick={merge}>Merge missing records on this device</button><button className="ml-3 text-sm underline" onClick={() => setReview(null)}>Cancel</button></div>}
    {(state.recoveryConflicts ?? []).map((conflict, index) => <details className="border rounded-lg p-3" key={`${index}-${conflict.collection}`}><summary className="cursor-pointer text-sm font-medium">Review {conflict.collection} · {conflict.id || conflict.field}</summary><div className="grid sm:grid-cols-2 gap-3 my-3">{[['Current', conflict.existing], ['Imported', conflict.incoming]].map(([label, value]) => <div key={label}><h3>{label}</h3><pre className="text-xs whitespace-pre-wrap break-all mt-2">{JSON.stringify(value, null, 2)}</pre></div>)}</div><button className="action" onClick={() => resolve(index, false)}>Keep current</button><button className="ml-3 underline text-sm" onClick={() => resolve(index, true)}>Use imported version</button></details>)}
    <details><summary className="text-sm font-medium cursor-pointer">Preserved browser sources ({archives.length})</summary><p className="text-xs text-muted my-2">Sources remain unchanged. Opening one only prepares an import preview.</p>{archives.map(source => <button key={source.key} onClick={() => prepare(localStorage.getItem(source.key))} className="block text-sm underline py-2">{source.savedAt} · {source.reason}</button>)}</details>
    <details><summary className="text-sm font-medium cursor-pointer">Recover existing cloud records privately</summary><p className="text-sm text-muted my-3">As project owner, run this read-only export in your existing Supabase SQL Editor. Download the single snapshot result as CSV, then choose that file above. Do not send the file, connection details, or household data to chat. This exports existing records; it does not change them. Keep the export private.</p><pre className="text-xs whitespace-pre-wrap break-all bg-canvas p-3 rounded-lg">{ownerExportQuery}</pre></details>
  </section>
}
