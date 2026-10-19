import { useState } from 'react'
import useStore, { saveLocalChanges } from '../store/useStore.js'
import { workspaceMode } from '../utils/workspace.js'

const types = {
  users: { label: 'Household profiles', fields: { name: 'Name', role: 'Role', color: 'Profile colour' } },
  fixedDeposits: { label: 'Fixed deposits', fields: { bank: 'Bank', principal: 'Principal', rate: 'Interest rate (%)', startDate: 'Start date', maturityDate: 'Maturity date', purpose: 'Purpose', notes: 'Notes' } },
  mutualFunds: { label: 'Mutual funds', fields: { name: 'Fund name', investedAmount: 'Invested amount', currentValue: 'Current value', planType: 'Plan type', type: 'Fund type', notes: 'Notes' } },
  licPolicies: { label: 'Insurance policies', fields: { insured: 'Insured person', plan: 'Plan', annualPremium: 'Annual premium', sumAssured: 'Sum assured', nextDueDate: 'Next due date', paidUpEligibleDate: 'Paid-up date', premiumsPaid: 'Premiums paid', notes: 'Notes' } },
  chitFunds: { label: 'Chit funds', fields: { organizer: 'Organizer', monthlyContribution: 'Monthly contribution', expectedPrize: 'Expected prize', completionDate: 'Completion date', status: 'Status', notes: 'Notes' } },
  milestones: { label: 'Milestones', fields: { title: 'Title', date: 'Target date', amount: 'Target amount', category: 'Category', status: 'Status', notes: 'Notes' } },
  jobApplications: { label: 'Job applications', fields: { company: 'Company', role: 'Role', appliedDate: 'Applied date', followUpDate: 'Follow-up date', platform: 'Platform', status: 'Status', notes: 'Notes' } },
}
const numeric = new Set(['principal', 'rate', 'investedAmount', 'currentValue', 'annualPremium', 'sumAssured', 'premiumsPaid', 'monthlyContribution', 'expectedPrize', 'amount'])

export default function WorkspaceEditor() {
  const state = useStore(), [kind, setKind] = useState('users'), [selected, setSelected] = useState(''), [draft, setDraft] = useState({}), [message, setMessage] = useState('')
  const schema = types[kind], rows = state[kind] ?? []
  function save(event) {
    event.preventDefault(); setMessage('')
    if (kind === 'users' && !selected) { setMessage('Select an existing household profile.'); return }
    const record = { ...draft, id: selected || crypto.randomUUID() }
    for (const key of numeric) if (key in record) {
      const value = Number(record[key]); if (!Number.isFinite(value) || value < 0) { setMessage('Amounts must be valid numbers of zero or more.'); return }; record[key] = value
    }
    if (!Object.keys(schema.fields).some(key => !numeric.has(key) && String(record[key] ?? '').trim())) { setMessage('Enter the record details first.'); return }
    if (kind === 'users' && !record.name?.trim()) { setMessage('A profile name is required.'); return }
    const identity = { fixedDeposits: 'bank', mutualFunds: 'name', licPolicies: 'insured', chitFunds: 'organizer', milestones: 'title', jobApplications: 'company' }[kind]
    if (identity && !String(record[identity] ?? '').trim()) { setMessage(`Enter ${schema.fields[identity].toLowerCase()} first.`); return }
    if (kind === 'mutualFunds') { record.currentValue ??= 0; record.investedAmount ??= 0; record.type ||= 'equity'; record.planType ||= 'direct' }
    if (kind === 'fixedDeposits') { record.principal ??= 0; record.rate ??= 0; record.holders ||= ['mother']; record.purpose ||= 'core' }
    if (kind === 'licPolicies') { record.annualPremium ??= 0; record.premiumsPaid ??= 0 }
    if (kind === 'milestones') { record.status ||= 'pending'; record.category ||= 'other' }
    if (kind === 'jobApplications') { record.status ||= 'applied'; record.appliedDate ||= new Date().toISOString().slice(0, 10) }
    if (kind === 'chitFunds') { record.status ||= 'active'; record.monthlyContribution ??= 0; record.expectedPrize ??= 0 }
    const statuses = { milestones: ['pending', 'done', 'skipped'], jobApplications: ['applied', 'interview_scheduled', 'interviewed', 'offered', 'accepted', 'rejected'], chitFunds: ['active', 'completed', 'defaulted'] }[kind]
    if (statuses && !statuses.includes(record.status)) { setMessage(`Status must be one of: ${statuses.join(', ')}.`); return }
    const requiredDate = { fixedDeposits: 'maturityDate', licPolicies: 'nextDueDate', chitFunds: 'completionDate', milestones: 'date' }[kind]
    if (requiredDate && !record[requiredDate]) { setMessage(`Enter ${schema.fields[requiredDate].toLowerCase()}.`); return }
    try { saveLocalChanges({ [kind]: selected ? rows.map(row => row.id === selected ? record : row) : [...rows, record] }); setSelected(record.id); setDraft(record); setMessage('Saved on this device.') }
    catch { setMessage('Not saved. Browser storage is unavailable or full; your form is unchanged.') }
  }
  function download() {
    const data = Object.fromEntries(Object.entries(state).filter(([key, value]) => typeof value !== 'function' && !['currentUser', 'persistenceError', 'isOffline'].includes(key)))
    data.users = data.users.map(({ pin, ...user }) => user)
    const url = URL.createObjectURL(new Blob([JSON.stringify({ format: 'fft-backup-v2', workspace: workspaceMode, data }, null, 2)], { type: 'application/json' }))
    const a = document.createElement('a'); a.href = url; a.download = `family-finance-${workspaceMode}-${new Date().toISOString().slice(0, 10)}.json`; a.click(); URL.revokeObjectURL(url)
  }
  return <section className="mb-8 rounded-lg border border-line bg-white p-4 space-y-4">
    <h2 className="font-semibold text-ink">Edit household & financial records</h2>
    <p className="text-xs text-muted">Changes apply only to this {workspaceMode === 'demo' ? 'synthetic demo' : 'personal browser'} workspace. Nothing is uploaded to the household database.</p>
    <label className="block text-sm">Record type<select value={kind} onChange={e => { setKind(e.target.value); setSelected(''); setDraft({}); setMessage('') }} className="mt-1 w-full border rounded-lg p-2">{Object.entries(types).map(([key, type]) => <option key={key} value={key}>{type.label}</option>)}</select></label>
    <label className="block text-sm">Choose a record<select value={selected} onChange={e => { setSelected(e.target.value); setDraft({ ...(rows.find(row => row.id === e.target.value) ?? {}) }); setMessage('') }} className="mt-1 w-full border rounded-lg p-2"><option value="">{kind === 'users' ? 'Select a profile' : 'Add a new record'}</option>{rows.map(row => <option key={row.id} value={row.id}>{row.name || row.title || row.bank || row.insured || row.organizer || row.company || row.id}</option>)}</select></label>
    <form onSubmit={save} className="space-y-3">
      <div className="grid sm:grid-cols-2 gap-3">{Object.entries(schema.fields).map(([key, label]) => <label key={key} className="text-sm text-muted">{label}<input aria-label={label} type={numeric.has(key) ? 'number' : /Date$|^date$/.test(key) ? 'date' : key === 'color' ? 'color' : 'text'} step="any" min={numeric.has(key) ? 0 : undefined} value={draft[key] ?? ''} onChange={e => setDraft({ ...draft, [key]: e.target.value })} className="mt-1 w-full rounded-lg border border-line p-2" /></label>)}</div>
      <button className="bg-accent text-white rounded-lg px-4 py-2">Save record on this device</button>
      {message && <p role="status" className="text-sm text-ink">{message}</p>}
    </form>
    <button onClick={download} className="text-sm underline text-accent">Download a backup of this workspace</button>
  </section>
}
