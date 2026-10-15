export const DEMO_BASE = 'http://127.0.0.1:8001'

export async function demoRequest(path, { token, method = 'GET', body, filename, fetchImpl = globalThis.fetch, deadlineMs = 30000 } = {}) {
  if (!/^\/rag\/(register|login|logout|documents(?:\/[a-f0-9-]{36})?|ask)$/.test(path)) throw new Error('Invalid demo endpoint')
  const controller = new AbortController()
  let timer
  try {
    const headers = {}
    if (token) headers.Authorization = `Bearer ${token}`
    if (filename) {
      headers['Content-Type'] = filename.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'text/plain'
      headers['X-Synthetic-Document'] = 'true'
    } else if (body !== undefined) headers['Content-Type'] = 'application/json'
    const request = fetchImpl(`${DEMO_BASE}${path}${filename ? `?filename=${encodeURIComponent(filename)}` : ''}`, {
      method, headers, body: filename ? body : body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal, cache: 'no-store', credentials: 'omit', redirect: 'error',
    }).then(async response => {
      let result
      try { result = await response.json() } catch { throw new Error('The demo returned an invalid response.') }
      if (!response.ok) {
        const detail = typeof result?.detail === 'string' ? result.detail : 'Demo request was rejected.'
        throw new Error(response.status === 401 ? 'Session invalid or expired. Sign out and sign in again.' : detail)
      }
      if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error('The demo returned an invalid response.')
      return result
    })
    const deadline = new Promise((_, reject) => {
      timer = setTimeout(() => { controller.abort(); reject(new Error('Demo request timed out. Its completion is unconfirmed; refresh the document list before repeating an upload or deletion.')) }, deadlineMs)
    })
    return await Promise.race([request, deadline])
  } catch (error) {
    if (error instanceof TypeError) throw new Error('The local RAG service could not be reached. Check the separate demo server.')
    throw error
  } finally { clearTimeout(timer) }
}

export function validateFile(file) {
  if (!file || !/\.(pdf|txt)$/i.test(file.name) || file.size <= 0 || file.size > 2 * 1024 * 1024) {
    throw new Error('Choose a nonempty synthetic PDF or TXT file, at most 2 MiB.')
  }
}

// One operation owner at a time; logout/unmount invalidates publication.
export function createOperationGate() {
  let active = null
  return {
    start() { if (active) return null; active = {}; return active },
    current(id) { return id !== null && active === id },
    finish(id) { if (active === id) active = null },
    invalidate() { active = null },
  }
}
