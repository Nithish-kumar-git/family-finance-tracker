import React, { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { demoRequest, validateFile, createOperationGate } from './client.js'
import './style.css'

export function RagDemo() {
  const [token, setToken] = useState(null) // Memory only; never localStorage/cookies.
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [documents, setDocuments] = useState([])
  const [file, setFile] = useState(null)
  const [synthetic, setSynthetic] = useState(false)
  const [question, setQuestion] = useState('')
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const gate = useRef(createOperationGate())
  const fileInput = useRef(null)
  useEffect(() => () => gate.current.invalidate(), [])

  async function run(label, action) {
    const id = gate.current.start()
    if (!id) return
    setBusy(label); setError(''); setNotice('')
    try {
      const publish = callback => { if (gate.current.current(id)) callback() }
      await action(publish)
    } catch (failure) { if (gate.current.current(id)) setError(failure.message || 'Demo operation failed.') }
    finally { if (gate.current.current(id)) { gate.current.finish(id); setBusy('') } }
  }
  async function list(session, publish) {
    const response = await demoRequest('/rag/documents', { token: session })
    if (!Array.isArray(response.documents)) throw new Error('Invalid document list.')
    publish(() => setDocuments(response.documents))
  }
  function authenticate(register) {
    return run(register ? 'Creating demo account' : 'Signing in', async publish => {
      const credentials = { username, password }
      if (register) await demoRequest('/rag/register', { method: 'POST', body: credentials })
      const response = await demoRequest('/rag/login', { method: 'POST', body: credentials })
      if (typeof response.token !== 'string' || !response.token) throw new Error('Invalid login response.')
      publish(() => { setToken(response.token); setPassword(''); setResult(null) })
      await list(response.token, publish)
    })
  }
  function signOut() {
    const previous = token
    gate.current.invalidate()
    setToken(null); setPassword(''); setDocuments([]); setResult(null); setFile(null)
    setQuestion(''); setSynthetic(false); setBusy(''); setError(''); setNotice('')
    // Token is immediately forgotten locally; revoke on the server too.
    void demoRequest('/rag/logout', { method: 'POST', token: previous }).catch(() => {
      // Do not repopulate state after a later sign-in; server expiry is bounded.
    })
  }
  return <main className="demo-shell">
    <header><p className="eyebrow">Family Finance Tracker · isolated local demo</p>
      <h1>Ask your synthetic documents</h1>
      <p>Upload a sample document, ask a question, and inspect the evidence behind the answer.</p></header>
    <aside className="safety">Synthetic documents only. This demo does not use family profiles, expenses, browser storage or the production database.
      Uploaded text and questions are sent to Gemini when configured. Do not include personal information.</aside>
    {error && <p role="alert" className="error">{error}</p>}
    <p role="status" aria-live="polite">{busy || notice}</p>
    {!token ? <section className="card"><h2>Separate demo account</h2>
      <form onSubmit={event => { event.preventDefault(); authenticate(false) }}>
        <fieldset disabled={Boolean(busy)}><label>Demo username<input value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" required pattern="[a-z][a-z0-9_-]{2,31}" maxLength={32} /></label>
          <p className="hint">3–32 lowercase letters, numbers, underscores or hyphens; start with a letter.</p>
          <label>Demo password<input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required minLength={12} maxLength={128} /></label>
          <p className="hint">Use a new demo-only password, at least 12 characters. Do not reuse a family PIN.</p>
          <div className="actions"><button type="submit">Sign in</button><button type="button" className="secondary" disabled={!username || password.length < 12} onClick={() => authenticate(true)}>Create demo account</button></div>
        </fieldset>
      </form></section> : <>
      <div className="actions"><p>Signed in to the isolated demo.</p><button className="secondary" onClick={signOut}>Sign out</button></div>
      <div className="grid">
        <section className="card"><h2>1. Add synthetic evidence</h2>
          <form onSubmit={e => { e.preventDefault(); run('Extracting and indexing document', async publish => {
            validateFile(file)
            if (!synthetic) throw new Error('Confirm synthetic content before uploading.')
            await demoRequest('/rag/documents', { method: 'POST', token, body: file, filename: file.name })
            publish(() => { setFile(null); setSynthetic(false); if (fileInput.current) fileInput.current.value = '' })
            await list(token, publish)
            publish(() => { setNotice('Document indexed.'); setResult(null) })
          }) }}>
            <fieldset disabled={Boolean(busy)}><label>Synthetic PDF or TXT<input ref={fileInput} type="file" accept=".pdf,.txt" onChange={e => setFile(e.target.files[0] || null)} /></label>
              <p className="hint">UTF-8 TXT or text-based PDF; at most 2 MiB / 40 pages. No OCR.</p>
              <label className="check"><input type="checkbox" checked={synthetic} onChange={e => setSynthetic(e.target.checked)} />This file is synthetic and contains no family or personal data.</label>
              <button disabled={!file || !synthetic}>Upload and index</button></fieldset></form>
          <div className="actions"><h3>Your demo documents</h3><button className="secondary" disabled={Boolean(busy)} onClick={() => run('Refreshing document list', publish => list(token, publish))}>Refresh list</button></div>
          {!documents.length && <p>No indexed documents. Upload a synthetic fixture first.</p>}
          <ul>{documents.map(document => <li key={document.id}><span>{document.filename} <small>({document.chunks} chunks)</small></span>
            <button className="secondary" disabled={Boolean(busy)} aria-label={`Delete synthetic document ${document.filename}`} onClick={() => {
              if (!window.confirm('Delete this synthetic demo document and its chunks?')) return
              run('Deleting synthetic document', async publish => { await demoRequest(`/rag/documents/${document.id}`, { method: 'DELETE', token });
                publish(() => setResult(null)); await list(token, publish) })
            }}>Delete</button></li>)}</ul>
        </section>
        <section className="card"><h2>2. Ask a grounded question</h2>
          <form onSubmit={e => { e.preventDefault(); run('Retrieving evidence and generating answer', async publish => {
            publish(() => setResult(null))
            const answer = await demoRequest('/rag/ask', { method: 'POST', token, body: { question } })
            if (typeof answer.answer !== 'string' || typeof answer.abstained !== 'boolean' || !Array.isArray(answer.citations)) throw new Error('Invalid answer response.')
            publish(() => setResult(answer))
          }) }}><fieldset disabled={Boolean(busy)}><label>Question about your synthetic documents<textarea value={question} onChange={e => setQuestion(e.target.value)} required maxLength={1000} rows={4} /></label>
            <button disabled={!documents.length || !question.trim()}>Ask / retry question</button></fieldset></form>
          {result && <article aria-live="polite"><h3>{result.abstained ? 'Insufficient evidence' : 'Document-grounded answer'}</h3><p className="answer">{result.answer}</p>
            {result.citations.map((citation, i) => <details key={i}><summary>Source {citation.source}: {citation.filename}, page {citation.page}</summary>
              <blockquote>{citation.quote}</blockquote><p className="passage">{citation.passage}</p></details>)}
            <p className="hint">Check the supporting passages. Citations are validated, but an AI answer can still be wrong.</p></article>}
        </section>
      </div></>}
  </main>
}

createRoot(document.getElementById('root')).render(<RagDemo />)
