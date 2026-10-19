// Pure/local recovery. No network, database writes, seed imports, or automatic replacement.
export const collections = ['users', 'expenses', 'fixedDeposits', 'mutualFunds', 'licPolicies', 'chitFunds', 'milestones', 'jobApplications', 'monthlySnapshots']
const tableNames = { fixed_deposits: 'fixedDeposits', mutual_funds: 'mutualFunds', lic_policies: 'licPolicies', chit_funds: 'chitFunds', job_applications: 'jobApplications', monthly_snapshots: 'monthlySnapshots', emergency_fund: 'emergencyFund', monthly_income: 'monthlyIncome' }
export const scalarGroups = ['budgets', 'gold', 'emergencyFund', 'monthlyIncome']
const object = value => value && typeof value === 'object' && !Array.isArray(value)
const dangerousKeys = new Set(['__proto__', 'constructor', 'prototype'])
function safeObject(value) {
  if (!object(value)) throw Error('The backup must contain an object.')
  const encoded = JSON.stringify(value)
  if (Object.keys(value).some(key => dangerousKeys.has(key)) || /"(?:__proto__|constructor|prototype)"\s*:/.test(encoded)) throw Error('The backup contains unsupported object keys.')
  return value
}
const canonical = value => Array.isArray(value) ? value.map(canonical) : object(value) ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value
const equal = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b))
const comparable = row => Object.fromEntries(Object.entries(row).filter(([key]) => !['created_at', 'updated_at', 'createdAt', 'updatedAt', 'pin'].includes(key)))

export function preserveSource(storage, raw, reason = 'before-change') {
  if (raw == null) return null
  let key = `fft_archive_v2_${Date.now()}`, suffix = 0
  while (storage.getItem(key) !== null) key = `fft_archive_v2_${Date.now()}_${++suffix}`
  storage.setItem(key, JSON.stringify({ format: 'fft-preserved-source-v2', workspace: 'personal', reason, savedAt: new Date().toISOString(), raw }))
  return key
}
export function ensureOriginalPreserved(storage) {
  const raw = storage.getItem('fft_data')
  if (raw === null) return null
  const existing = storage.getItem('fft_original_archive_v2')
  if (existing && storage.getItem(existing) !== null) return existing
  const key = preserveSource(storage, raw, 'original-before-migration')
  storage.setItem('fft_original_archive_v2', key)
  return key
}
export function listPreservedSources(storage) {
  const sources = []
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i)
    if (key?.startsWith('fft_archive_v2_')) {
      try { const source = JSON.parse(storage.getItem(key)); sources.push({ key, savedAt: source.savedAt, reason: source.reason }) } catch { /* Retain unreadable source untouched. */ }
    }
  }
  return sources.sort((a, b) => b.savedAt.localeCompare(a.savedAt))
}
function csvCells(text) {
  const rows = []; let row = [], cell = '', quoted = false
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (char === '"') { if (quoted && text[i + 1] === '"') { cell += '"'; i++ } else quoted = !quoted }
    else if (char === ',' && !quoted) { row.push(cell); cell = '' }
    else if ((char === '\n' || char === '\r') && !quoted) { if (char === '\r' && text[i + 1] === '\n') i++; row.push(cell); if (row.some(Boolean)) rows.push(row); row = []; cell = '' }
    else cell += char
  }
  if (quoted) throw Error('The CSV contains an incomplete quoted value.')
  row.push(cell); if (row.some(Boolean)) rows.push(row)
  return rows
}
export function parseRecoveryFile(text, depth = 0) {
  if (depth > 3) throw Error('The backup contains too many nested archives.')
  if (typeof text !== 'string' || text.length > 10 * 1024 * 1024) throw Error('Choose a backup smaller than 10 MiB.')
  let value
  try { value = JSON.parse(text.replace(/^\uFEFF/, '')) }
  catch {
    const rows = csvCells(text.replace(/^\uFEFF/, ''))
    if (rows.length !== 2 || rows[0].length !== 1 || !['snapshot', 'backup'].includes(rows[0][0])) throw Error('Choose a JSON backup or the single-snapshot CSV exported by the recovery query.')
    try { value = JSON.parse(rows[1][0]) } catch { throw Error('The CSV snapshot does not contain valid JSON.') }
  }
  if (Array.isArray(value) && value.length === 1 && value[0]?.snapshot) value = value[0].snapshot
  if (value?.format === 'fft-preserved-source-v2') return parseRecoveryFile(value.raw, depth + 1)
  if (value?.snapshot) value = value.snapshot
  if (value?.workspace === 'demo') throw Error('Demo data cannot be imported into the personal workspace.')
  const source = safeObject(value?.tables ?? value?.data ?? value)
  const normalized = {}, unsupported = []
  for (const [table, data] of Object.entries(source)) {
    const key = tableNames[table] ?? table
    if (collections.includes(key)) {
      if (!Array.isArray(data)) throw Error(`${key} must be a list. Nothing was imported.`)
      normalized[key] = data.map(row => {
        safeObject(row)
        if (typeof row.id !== 'string' || !row.id) throw Error(`${key} contains a record without an ID. Nothing was imported.`)
        if (row.id.startsWith('demo-') || (key === 'users' && /^Demo\s/.test(row.name ?? ''))) throw Error('Synthetic demo records cannot be imported into personal storage.')
        if (key === 'users' && (typeof row.name !== 'string' || !row.name.trim())) throw Error('A household profile has no valid name.')
        if (key === 'expenses' && (typeof row.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(row.date) || typeof row.amount !== 'number')) throw Error('An expense has an invalid date or amount.')
        const { pin, password, ...record } = row
        for (const [field, value] of Object.entries(record)) {
          if (['amount', 'principal', 'rate', 'currentValue', 'investedAmount', 'annualPremium', 'monthlyContribution', 'expectedPrize', 'premiumsPaid'].includes(field) && (typeof value !== 'number' || !Number.isFinite(value) || value < 0)) throw Error(`${key} has an invalid ${field}. Nothing was imported.`)
        }
        return record
      })
    } else if (key === 'budgets') {
      if (Array.isArray(data) && new Set(data.map(row => row.category)).size !== data.length) throw Error('Duplicate budget categories require a separate review. Nothing was discarded.')
      normalized.budgets = Array.isArray(data) ? Object.fromEntries(data.map(row => [row.category, row.monthlyLimit])) : safeObject(data)
      safeObject(normalized.budgets)
      if (Object.values(normalized.budgets).some(value => typeof value !== 'number' || !Number.isFinite(value) || value < 0)) throw Error('Budget limits must be valid non-negative numbers.')
    } else if (scalarGroups.includes(key)) {
      if (Array.isArray(data) && data.length > 1) throw Error(`${key} contains multiple versions. Export and review these separately; no records were discarded.`)
      if (Array.isArray(data) && !data.length) continue
      normalized[key] = safeObject(Array.isArray(data) ? data[0] : data)
      for (const [field, value] of Object.entries(normalized[key])) {
        if (['weightGrams', 'currentValuePerGram', 'target', 'liquidFundBalance', 'cashInBank', 'pension', 'nithish', 'abeerami'].includes(field) && (typeof value !== 'number' || !Number.isFinite(value) || value < 0)) throw Error(`${key} has an invalid ${field}. Nothing was imported.`)
      }
    } else if (!['format', 'workspace', 'currentUser', 'isOffline', 'persistenceError', 'storageReadError', 'recoveryConflicts', 'recoveryStatus', 'source', 'createdAt', 'version'].includes(key)) unsupported.push(key)
  }
  if (!Object.keys(normalized).length) throw Error('No recognized financial collections were found. Nothing was imported.')
  return { data: normalized, unsupported }
}
export function planRecovery(current, incoming) {
  const patch = {}, conflicts = [], counts = {}
  for (const key of collections) {
    if (!incoming[key]) continue
    const rows = [...(current[key] ?? [])]
    let added = 0
    for (const candidate of incoming[key]) {
      const matches = rows.filter(row => row.id === candidate.id)
      if (!matches.length) { rows.push(candidate); added++ }
      else if (!matches.some(row => equal(comparable(row), comparable(candidate)))) {
        conflicts.push({ collection: key, id: candidate.id, existing: matches, incoming: candidate })
      }
    }
    patch[key] = rows; counts[key] = added
  }
  for (const key of scalarGroups) {
    if (!incoming[key]) continue
    const existing = { ...(current[key] ?? {}) }
    for (const [field, value] of Object.entries(incoming[key])) {
      if (['id', 'created_at', 'updated_at'].includes(field)) continue
      if (!Object.hasOwn(existing, field) || existing[field] == null) existing[field] = value
      else if (JSON.stringify(existing[field]) !== JSON.stringify(value)) conflicts.push({ collection: key, field, existing: existing[field], incoming: value })
    }
    patch[key] = existing
  }
  return { patch, conflicts, counts }
}
export function applyRecovery({ storage, current, parsed, rawSource }) {
  const plan = planRecovery(current, parsed.data)
  const previous = storage.getItem('fft_data')
  const originalArchive = preserveSource(storage, previous, 'before-reviewed-import')
  const importedArchive = preserveSource(storage, rawSource, 'import-source')
  const next = { ...current, ...plan.patch,
    recoveryConflicts: [...(current.recoveryConflicts ?? []), ...plan.conflicts],
    recoveryStatus: { importedAt: new Date().toISOString(), counts: plan.counts, sourceArchives: [originalArchive, importedArchive].filter(Boolean), unsupported: parsed.unsupported } }
  const { currentUser, persistenceError, storageReadError, ...persisted } = next
  storage.setItem('fft_data', JSON.stringify(persisted))
  return { ...next, storageReadError: false }
}

// Operator-only read-only export. Run privately in the owner's database console,
// download the result, and import directly into the personal app. No Codex upload.
export const ownerExportQuery = 'SELECT jsonb_build_object(' +
  ['users', 'expenses', 'budgets', 'fixed_deposits', 'mutual_funds', 'lic_policies', 'chit_funds', 'gold', 'emergency_fund', 'monthly_income', 'milestones', 'job_applications', 'monthly_snapshots']
    .map(table => `'${table}', (SELECT COALESCE(jsonb_agg(to_jsonb(r) - 'pin' - 'password'), '[]'::jsonb) FROM public.${table} r)`).join(',\n') + ') AS snapshot;'
