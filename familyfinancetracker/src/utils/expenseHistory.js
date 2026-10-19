// History-only reads and request state. No store imports, persistence, or logging.
const CATEGORIES = [
  'groceries', 'utilities', 'medical', 'transport', 'household',
  'lic_premium', 'chit_contribution', 'personal', 'education', 'other',
]

export const HISTORY_ERRORS = {
  NETWORK: 'The request could not reach the service.',
  TIMEOUT: 'The History request timed out. Retry to check this month again.',
  HTTP: 'The service returned an unsuccessful response.',
  JSON: 'The response could not be read as JSON.',
  SHAPE: 'The response has an unsupported format.',
  RECORD: 'The response contains an invalid expense record.',
  DATE: 'Expense dates must be unambiguous YYYY-MM-DD calendar dates. No dates were rewritten.',
  MONTH: 'The response does not match the requested month.',
  LOCAL: 'The local fallback could not be safely read.',
  UNKNOWN: 'History could not be loaded.',
}

export function historyErrorMessage(code) {
  return Object.hasOwn(HISTORY_ERRORS, code) ? HISTORY_ERRORS[code] : HISTORY_ERRORS.UNKNOWN
}

export function initialHistoryState(month) {
  return {
    month, status: 'loading', source: null, freshness: 'unverified',
    expenses: [], categoryTotals: {}, error: null, retained: false,
  }
}

function validMonth(month) {
  return typeof month === 'string' && /^(?!0000)\d{4}-(0[1-9]|1[0-2])$/.test(month)
}

function validDate(date) {
  if (typeof date !== 'string' || !/^(?!0000)\d{4}-\d{2}-\d{2}$/.test(date)) return false
  const parsed = new Date(`${date}T00:00:00Z`)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date
}

function validRecord(record) {
  return record !== null && typeof record === 'object' && !Array.isArray(record)
    && ['id', 'category'].every(key => typeof record[key] === 'string' && record[key].length > 0)
    // The backend permits any string userId, including an empty string.
    // Preserve it verbatim; never infer a profile or coerce an identifier.
    && typeof record.userId === 'string'
    && validDate(record.date)
    && typeof record.amount === 'number' && Number.isFinite(record.amount)
    && (record.description == null || typeof record.description === 'string')
    && (record.isRecurring == null || typeof record.isRecurring === 'boolean')
}

function totalsFor(expenses) {
  const totals = Object.fromEntries(CATEGORIES.map(key => [key, 0]))
  for (const expense of expenses) {
    const key = Object.hasOwn(totals, expense.category) ? expense.category : 'other'
    totals[key] += expense.amount
  }
  return totals
}

// Validate the entire response before exposing any rows. IDs are never coerced.
export function validateHistoryResponse(payload, month) {
  if (!validMonth(month)) return { error: 'MONTH' }
  const records = Array.isArray(payload) ? payload : payload?.expenses
  if (!Array.isArray(records)) return { error: 'SHAPE' }
  const ids = new Set()
  for (const record of records) {
    if (typeof record?.date === 'string' && !validDate(record.date)) return { error: 'DATE' }
    if (!validRecord(record) || ids.has(record.id)) return { error: 'RECORD' }
    if (record.date.slice(0, 7) !== month) return { error: 'MONTH' }
    ids.add(record.id)
  }
  const expenses = records.map(record => ({ ...record }))
  const categoryTotals = totalsFor(expenses)
  if (Object.values(categoryTotals).some(total => !Number.isFinite(total))) return { error: 'RECORD' }
  return { expenses, categoryTotals }
}

// Count opaque IDs independently of dates, month or display eligibility.
// This is a read-only snapshot, not deduplication or a persistent tombstone.
export function findLocalIdCollisions(local) {
  const counts = new Map()
  if (!Array.isArray(local)) return []
  for (const record of local) {
    if (typeof record?.id === 'string' && record.id.length > 0) {
      counts.set(record.id, (counts.get(record.id) ?? 0) + 1)
    }
  }
  return [...counts].filter(([, count]) => count > 1).map(([id]) => id)
}

// Local storage can contain duplicate IDs from the existing offline Add path.
// Keep every safely displayable row, with limitations instead of silent repair.
export function validateLocalHistory(local, month) {
  if (!Array.isArray(local)) throw new Error('LOCAL')
  const limitations = { duplicateIds: [], unknownMonthCount: 0, invalidMonthCount: 0, totalsOverflow: false }
  const expenses = []
  const collisionIds = findLocalIdCollisions(local)
  for (const record of local) {
    const date = record?.date
    const period = typeof date === 'string' && /^\d{4}-\d{2}(?:-|$)/.test(date) ? date.slice(0, 7) : null
    if (!validMonth(period)) {
      limitations.unknownMonthCount++
      continue
    }
    // A determinable other month cannot invalidate the requested month's view.
    if (period !== month) continue
    if (!validRecord(record)) {
      limitations.invalidMonthCount++
      continue
    }
    expenses.push({ ...record })
  }
  const displayIds = new Set(expenses.map(record => record.id))
  limitations.duplicateIds = collisionIds.filter(id => displayIds.has(id))
  let categoryTotals = totalsFor(expenses)
  limitations.totalsOverflow = Object.values(categoryTotals).some(total => !Number.isFinite(total))
  const limited = limitations.duplicateIds.length > 0 || limitations.unknownMonthCount > 0
    || limitations.invalidMonthCount > 0 || limitations.totalsOverflow
  // Do not present ambiguous or partial sums as a complete monthly summary.
  if (limited) categoryTotals = {}
  return { expenses, categoryTotals, limitations, limited, collisionIds }
}

export function localHistoryWarnings(limitations, retained = false) {
  if (!limitations) return []
  const warnings = []
  if (limitations.duplicateIds.length) warnings.push(retained
    ? 'Duplicate local IDs were detected in fallback. Showing the previous successful response instead. Affected Delete controls are unavailable because individual local copies cannot be targeted safely.'
    : 'Duplicate local IDs: all safely displayable copies for the selected month are shown separately, without deduplication. Their Delete controls are unavailable because individual copies cannot be targeted safely.')
  if (limitations.unknownMonthCount) warnings.push(`${limitations.unknownMonthCount} local record(s) have an undetermined month and cannot be displayed safely in this month view. Stored records are unchanged.`)
  if (limitations.invalidMonthCount) warnings.push(`${limitations.invalidMonthCount} selected-month local record(s) cannot be displayed safely because their fields or dates are invalid. Stored records are unchanged.`)
  if (limitations.totalsOverflow) warnings.push('Local amounts cannot be safely totalled.')
  if (warnings.length) warnings.push(retained
    ? 'The local fallback is limited, not verified complete; the previous response remains displayed. No stored records were deleted, merged or rewritten.'
    : 'This local view is limited, not verified complete. Monthly summaries are unavailable. No stored records were deleted, merged or rewritten.')
  return warnings
}

export async function readHistoryMonth({ month, url, fetchResponse, getLocalExpenses }) {
  let error
  if (!validMonth(month)) return { ...initialHistoryState(month), status: 'error', error: 'MONTH' }
  let response
  try {
    response = await fetchResponse(url)
  } catch {
    error = 'NETWORK'
  }
  if (!error) {
    if (!response?.ok) {
      error = 'HTTP'
    } else {
      let payload
      try {
        payload = await response.json()
      } catch {
        error = 'JSON'
      }
      if (!error) {
        if (response.local === true) {
          const validated = validateLocalHistory(Array.isArray(payload) ? payload : payload?.expenses, month)
          return { ...initialHistoryState(month), ...validated, source: 'browser',
            status: validated.limited && !validated.expenses.length ? 'error' : validated.expenses.length ? 'success' : 'empty' }
        }
        const validated = validateHistoryResponse(payload, month)
        if (!validated.error) {
          return {
            ...initialHistoryState(month), ...validated,
            status: validated.expenses.length ? 'success' : 'empty', source: 'response',
          }
        }
        error = validated.error
      }
    }
  }
  // Only transport/HTTP/JSON failures use local fallback. Invalid server data
  // stays an explicit error rather than being replaced by apparent emptiness.
  if (['NETWORK', 'HTTP', 'JSON'].includes(error)) {
    try {
      const local = getLocalExpenses()
      const validated = validateLocalHistory(local, month)
      return {
        ...initialHistoryState(month), ...validated,
        status: validated.limited && !validated.expenses.length ? 'error' : 'fallback',
        ...(validated.limited && !validated.expenses.length ? { fallbackError: 'LOCAL' } : {}),
        source: 'local-fallback', error,
      }
    } catch {
      return { ...initialHistoryState(month), status: 'error', error, fallbackError: 'LOCAL' }
    }
  }
  return { ...initialHistoryState(month), status: 'error', error }
}

export function filterHistoryExpenses(expenses, userId) {
  return [...expenses].filter(expense => userId === 'all' || expense.userId === userId)
    .sort((a, b) => b.date.localeCompare(a.date))
}

const isSuccess = result => result.status === 'success' || result.status === 'empty'

function withoutDeleted(result, ids) {
  const expenses = result.expenses.filter(expense => !ids.has(expense.id))
  const limitations = result.limitations ? {
    ...result.limitations, duplicateIds: result.limitations.duplicateIds.filter(id => !ids.has(id)),
  } : undefined
  const limited = result.retained ? false : limitations ? Boolean(limitations.duplicateIds.length || limitations.unknownMonthCount
    || limitations.invalidMonthCount || limitations.totalsOverflow) : result.limited
  return {
    ...result, expenses, limitations, limited, categoryTotals: limited ? {} : totalsFor(expenses),
    status: isSuccess(result) ? (expenses.length ? 'success' : 'empty') : result.status,
  }
}

// This controller owns component-local state only. Pending requests need not
// be aborted to become harmless: obsolete completions cannot publish anything.
export const HISTORY_TIMEOUT_MS = 15_000

export function createHistoryLoader(readMonth, publish, {
  timeoutMs = HISTORY_TIMEOUT_MS, scheduleTimeout = setTimeout, cancelTimeout = clearTimeout,
} = {}) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new TypeError('A finite positive History timeout is required')
  let active = true
  let version = 0
  let state = null
  let lastSuccess = null
  let pendingDeletions = null
  let cancelPending = null
  const emit = next => { state = next; publish(next) }
  return {
    async load(month) {
      if (!active) return
      const request = ++version
      // Superseded wrappers settle immediately, even if their readers hang.
      cancelPending?.()
      // Only deletions confirmed while this read is pending suppress its rows.
      // A later fresh read has a new set; no persistent tombstones are needed.
      const deletedDuringRead = new Set()
      pendingDeletions = deletedDuringRead
      const previous = lastSuccess?.month === month ? lastSuccess : null
      emit({ ...(previous ?? initialHistoryState(month)), status: 'loading', error: null, retained: Boolean(previous) })
      let cancelThisRead
      const outcome = await new Promise(resolve => {
        let settled = false
        let timer
        const finish = value => {
          if (settled) return
          settled = true
          cancelTimeout(timer)
          resolve(value)
        }
        cancelThisRead = () => finish({ cancelled: true })
        cancelPending = cancelThisRead
        timer = scheduleTimeout(() => finish({
          result: { ...initialHistoryState(month), status: 'error', error: 'TIMEOUT' },
        }), timeoutMs)
        try {
          Promise.resolve(readMonth(month)).then(
            result => finish({ result }),
            () => finish({ result: { ...initialHistoryState(month), status: 'error', error: 'UNKNOWN' } }),
          )
        } catch {
          finish({ result: { ...initialHistoryState(month), status: 'error', error: 'UNKNOWN' } })
        }
      })
      if (cancelPending === cancelThisRead) cancelPending = null
      if (outcome.cancelled) return
      let result = outcome.result
      if (!active || request !== version) return
      pendingDeletions = null
      if (!result || result.month !== month) {
        result = { ...initialHistoryState(month), status: 'error', error: 'MONTH' }
      }
      if (deletedDuringRead.size) result = withoutDeleted(result, deletedDuringRead)
      if (isSuccess(result)) lastSuccess = result
      else if (lastSuccess?.month === month) {
        const retainedIds = new Set(lastSuccess.expenses.map(expense => expense.id))
        const limitations = result.limitations ? {
          ...result.limitations,
          duplicateIds: (result.collisionIds ?? result.limitations.duplicateIds).filter(id => retainedIds.has(id)),
        } : undefined
        result = {
          ...result, expenses: lastSuccess.expenses, categoryTotals: lastSuccess.categoryTotals,
          source: 'previous-response', retained: true, limited: false, limitations,
        }
      }
      emit(result)
    },
    // Preserve existing post-delete UI updates without changing any API/store
    // mutation. Also keep the retained snapshot from resurrecting that row.
    removeExpense(id) {
      if (!active || !state) return
      pendingDeletions?.add(id)
      const ids = new Set([id])
      if (lastSuccess) lastSuccess = withoutDeleted(lastSuccess, ids)
      emit(withoutDeleted(state, ids))
    },
    invalidate() {
      active = false
      version++
      pendingDeletions = null
      cancelPending?.()
      cancelPending = null
    },
  }
}
