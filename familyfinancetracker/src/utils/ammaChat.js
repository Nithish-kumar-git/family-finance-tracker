import { workspaceMode } from './workspace.js'
import { serverAuthorizedFetch } from './authorizedFetch.js'
// Chat-only transport: no shared offline flag, persistence or local fallback.
export const CHAT_TIMEOUT_MS = 30_000

function chatError(code, status, retryable = code !== 'CANCELLED') {
  return Object.assign(new Error(code), { code, retryable, ...(status === undefined ? {} : { status }) })
}

export function getChatErrorMessage(error) {
  switch (error?.code) {
    case 'AI_NOT_CONFIGURED':
    case 'AI_CONFIGURATION':
      return 'Amma AI needs configuration by the app administrator. Please contact them before trying again.'
    case 'AI_RATE_LIMITED':
      return 'Amma AI is busy. Wait a minute, then try again.'
    case 'AI_UNAVAILABLE':
      return 'Amma AI is temporarily unavailable. Please try again shortly.'
    case 'AI_TIMEOUT':
      return 'Amma AI took too long to respond. Please try again.'
    case 'AI_INVALID_RESPONSE':
      return 'Amma AI returned an unreadable or incomplete response. Please try again.'
    case 'NETWORK':
      return 'Amma AI could not reach the service. Check your connection and try again.'
    case 'AUTH_REQUIRED':
      return 'Personal AI requires a server-authorized household session. This device PIN does not authorize cloud access. The public demo is available separately.'
    case 'HTTP':
      if (error.status === 401 || error.status === 403) {
        return `Amma AI access was rejected (HTTP ${error.status}). Retry after checking your access.`
      }
      return `Amma AI returned an error (HTTP ${error.status}). Please try again.`
    case 'TIMEOUT':
      return 'Amma AI took too long to respond. Please try again.'
    case 'INVALID_RESPONSE':
      return 'Amma AI returned an unreadable or incomplete response. Please try again.'
    default:
      return 'Amma AI could not complete this request. Please try again.'
  }
}

// Injectable dependencies are used only by isolated, network-blocked tests.
export async function readChat({
  baseUrl, question, context, history, signal, mode = workspaceMode,
  fetchImpl, timeoutMs = CHAT_TIMEOUT_MS,
  setTimer = setTimeout, clearTimer = clearTimeout,
}) {
  const controller = new AbortController()
  let timer
  let rejectDeadline
  const deadline = new Promise((_, reject) => { rejectDeadline = reject })
  const cancel = () => {
    // Reject before aborting so a fetch AbortError cannot hide the classification.
    rejectDeadline(chatError('CANCELLED'))
    controller.abort()
  }
  signal?.addEventListener('abort', cancel, { once: true })
  if (signal?.aborted) cancel()
  else {
    timer = setTimer(() => {
      rejectDeadline(chatError('TIMEOUT'))
      controller.abort()
    }, timeoutMs)
  }

  const request = async () => {
    if (controller.signal.aborted) throw chatError('CANCELLED')
    let response
    try {
      const transport = fetchImpl ?? (mode === 'demo' ? fetch : serverAuthorizedFetch)
      response = await transport(baseUrl + (mode === 'demo' ? '/api/demo/ai/chat' : '/api/ai/chat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify(mode === 'demo' ? { question, history } : { question, context, history }),
        signal: controller.signal,
      })
    } catch (error) {
      if (error?.code === 'AUTH_REQUIRED') throw Object.assign(error, { retryable: false })
      throw chatError('NETWORK')
    }
    if (!response.ok) {
      let body
      try { body = await response.json() } catch { /* Older/non-JSON servers use status fallback. */ }
      const code = body?.error?.code
      // Never display arbitrary upstream text, even in a recognized envelope.
      const permanent = ['AI_NOT_CONFIGURED', 'AI_CONFIGURATION']
      const transient = ['AI_RATE_LIMITED', 'AI_UNAVAILABLE', 'AI_TIMEOUT', 'AI_INVALID_RESPONSE']
      if (permanent.includes(code)) throw chatError(code, response.status, false)
      if (transient.includes(code)) throw chatError(code, response.status, true)
      throw chatError('HTTP', response.status, response.status === 429 || response.status >= 500)
    }
    let result
    try { result = await response.json() } catch { throw chatError('INVALID_RESPONSE') }
    if (!result || typeof result.answer !== 'string' || !result.answer.trim()) {
      throw chatError('INVALID_RESPONSE')
    }
    return result
  }

  try {
    // Includes JSON parsing. Late completion is observed but cannot win this race.
    return await Promise.race([deadline, request()])
  } finally {
    if (timer !== undefined) clearTimer(timer)
    signal?.removeEventListener('abort', cancel)
  }
}
