# Isolated local financial-document RAG

This is a synthetic-only local demo. It runs separately from the finance backend
and React entry point. It does not use family profiles, expenses, finance
credentials, production databases or deployment settings. Use harmless synthetic
documents and a separate Gemini demo credential.

## Architecture and file boundaries

- `rag_demo/`: standalone FastAPI API, configuration, authentication, PDF worker,
  parsing/chunking, Gemini adapter, PostgreSQL repository, schema, evaluation and
  isolated backend tests. Runtime code never falls back to mock providers/storage.
- `familyfinancetracker/rag-demo.html`, `src/ragDemo/`, `vite.rag.config.js` and
  `tests/ragDemo.test.mjs`: separate React UI, raw-file API client and frontend tests.
- API: `127.0.0.1:8001`, `/rag/*`. UI: `127.0.0.1:5174/rag-demo.html`.
- Gemini embeddings: `gemini-embedding-001`, 768 normalized dimensions. Documents
  and queries use their corresponding retrieval task types. Other embedding
  models are rejected; the stored model/dimension contract must match.
- Retrieval: exact pgvector cosine search with owner/document filters, top five
  passages and a 0.65 minimum score. This threshold is not calibrated.
- Generation: `gemini-3.5-flash-lite` by default, with an explicit JSON answer and
  citation schema. Exact source indexes and quote substrings are validated locally.
  Missing/invalid evidence causes abstention; provider failures remain errors.

## Existing dedicated local database

The reviewed environment has already been initialized. **Do not rerun schema.sql,
create another service with these names, or reset/delete the database or volume.**

| Item | Verified local configuration |
|---|---|
| PostgreSQL endpoint | `127.0.0.1:5544` |
| Database / schema | `fft_rag_demo` / `rag_demo` |
| Application / bootstrap role | `rag_app` / `rag_bootstrap` |
| Container | `fft-rag-demo-local` |
| Volume / network | `fft_rag_demo_data` / `fft-rag-demo-net` |
| PostgreSQL / pgvector | 16.15 / 0.8.7 |
| Container limits | 512 MiB memory, one CPU, 128 processes; loopback port binding |

The reviewed image is pinned to
`pgvector/pgvector@sha256:a97d77306ff47cc1d8add4d000cec2207da2e110746318df3137ce53c337ca30`.
No infrastructure is created automatically by this code.

For a fresh environment, first review and provision a new isolated service without
reusing unrelated resources, credentials or storage. The required application role
has LOGIN, NOSUPERUSER, NOCREATEDB, NOCREATEROLE, NOINHERIT, NOREPLICATION,
NOBYPASSRLS, connection limit 10 and no administrator-role memberships. It requires
CONNECT on this database and no database/public-schema creation rights. Database
PUBLIC privileges and public-schema CREATE must be reviewed separately;
`schema.sql` does not provision roles or database-level restrictions.

`schema.sql` is a one-time, non-idempotent initialization artifact. Review it before
applying it as the dedicated bootstrap administrator, with stop-on-error enabled
and in a transaction. Stop if any RAG schema objects already exist. Do not apply it
as `rag_app`. It enables vector, creates five tables and indexes, inserts the
embedding contract, forces RLS on documents/chunks and grants limited application
access. Document/chunk owners must match transaction-local `rag.owner`; the
repository sets that context inside each owner-scoped transaction. Schema/table
ownership remains with the bootstrap administrator, not the application role.

## Normal local launch

Use Python 3.12+ and the existing frontend Node dependencies. Create a new isolated
RAG environment only if that directory does not already exist; do not reuse the
finance backend environment or change its dependencies:

```powershell
python -m venv .venv-rag-demo
.\.venv-rag-demo\Scripts\python.exe -m pip install -r rag_demo/requirements.txt
```

Once the dedicated database is ready, run from the repository root:

```powershell
$env:RAG_ANSWER_MODEL = "gemini-3.5-flash-lite"
.\.venv-rag-demo\Scripts\python.exe -B -m rag_demo.run_local
```

The normal launcher prompts privately for the local `rag_app` password and the
separate Gemini key. It does not load `.env` or save credentials. It fixes the
database endpoint to port 5544 and binds the API to loopback. `RAG_ANSWER_MODEL`
overrides the answer default for that process; do not set permanent user/machine
variables. Model availability depends on the demo key: verify access before
selecting a different model. No silent generation-model fallback is provided.

Leave the API running. In a second terminal:

```powershell
cd familyfinancetracker
node node_modules/vite/bin/vite.js --config vite.rag.config.js
```

Open **http://127.0.0.1:5174/rag-demo.html**. Create a demo-only account with a new
12+ character password, upload a short synthetic TXT or text PDF, ask questions
and expand the citation evidence. Confirm an unsupported question abstains.
The UI uses its own entry, loads no finance `.env` files and has no service worker.

The optional environment launcher is
`uvicorn rag_demo.app:app --host 127.0.0.1 --port 8001 --no-access-log` in the RAG
environment. Configure only these RAG process variables securely; never paste real
values into source, command history, Git or chat:

| Variable | Purpose / default |
|---|---|
| `RAG_DEMO_ENABLED` | Required `1` for the environment launcher; otherwise fail closed |
| `RAG_DATABASE_URL` | Dedicated local PostgreSQL connection for `rag_app` / `fft_rag_demo` |
| `RAG_GEMINI_API_KEY` | Separate demo Gemini credential |
| `RAG_EMBEDDING_MODEL` | `gemini-embedding-001`; only supported embedding model |
| `RAG_EMBEDDING_DIMENSIONS` | 768; must match the database contract |
| `RAG_ANSWER_MODEL` | `gemini-3.5-flash-lite` |
| `RAG_CHUNK_SIZE` | 900 characters; validated range 100–2000 |
| `RAG_CHUNK_OVERLAP` | 150 characters; less than chunk size |

The URL validator requires loopback, the dedicated database and role, an explicit
port and no URL query/fragment. The environment path can accept another explicit
local port; operators must keep the reviewed service on 5544 and must not tunnel
it to another database. The normal launcher always selects 5544.

## Authentication, resource bounds and cleanup

Accounts use scrypt password hashes. Opaque bearer tokens are stored only in UI
memory; the database stores SHA-256 digests with one-hour expiry. Refresh loses
the UI token. Logout forgets it immediately and requests server revocation; an
unreachable server can leave the old session valid until expiry. Revoke remaining
sessions during reviewed synthetic cleanup. Host/Origin checks supplement server
authentication and do not replace it. Login throttling is process-local.

Maximums: 2 MiB input, 40 PDF pages, 100,000 extracted characters, 160 chunks,
2 MiB per decoded stream, 8 MiB accumulated page-content bytes, and 20 documents
per account. Chunking normalizes whitespace and retains page/ordinal metadata.
Only one upload/parser job runs at a time per server process. SQL serializes quota
checks and writes each indexed document/chunks atomically.

PDF extraction runs in a killable, credential-free Python subprocess, with a
five-second wall deadline and a 256 MiB memory cap plus CPU/process limits through
Windows Job Objects or Linux resource limits. Unsupported/unavailable limits
reject the PDF. Decoder, stream, page-tree and form work are bounded through
pypdf configuration. Network, subprocess and `.env` access are blocked in the
worker. These controls are not a complete OS sandbox. No OCR; scanned/encrypted
PDFs are rejected. Raw files are not retained; extracted text is stored.

Indexing has a cooperative 60-second deadline. Each Gemini request has a
20-second timeout and no automatic retries; the UI deadline is 30 seconds.
A UI timeout does not establish whether an in-flight operation completed.
Refresh the list before repeating a write. There is no idempotency guarantee.

Delete only verified synthetic documents through the authenticated owner UI/API
or the existing owner-scoped repository method. Chunk deletion cascades. Sign out
and confirm that owner's documents, chunks and sessions are gone. `rag_app` has
no account DELETE grant: removal of empty test accounts requires a separately
reviewed bootstrap operation constrained to exact account UUID + username pairs.
Do not grant extra application privileges or add a general database wipe command.
Confirm global zero test-data counts while preserving the single
`embedding_contract` row. Do not delete the database, container or volume.

## Tests, builds and synthetic evaluation

Run offline checks from the repository root with the isolated environment:

```powershell
.\.venv-rag-demo\Scripts\python.exe -I -B rag_demo/run_tests.py
cd familyfinancetracker
node --jitless --experimental-vm-modules --test tests/ragDemo.test.mjs tests/expenseSave.test.mjs tests/expenseHistory.test.mjs tests/dataRecovery.test.mjs tests/ammaChat.test.mjs
cd ..
node rag_demo/build_frontends.mjs
git diff --check
```

The Python runner accepts `--dependencies <isolated-install-directory>` when the
packages are installed outside a virtual environment. It removes inherited
RAG/Supabase/Gemini settings and blocks network/database and `.env` reads. Windows
asyncio's internal stdlib socketpair is the sole loopback exception. Route tests
use ASGI TestClient. Test fakes and their results are not live-integration proof.

Both production builds use temporary output directories, disabled `.env` loading
and synthetic finance API configuration. Existing `dist` is preserved. The finance
bundle-size warning remains. Do not deploy these outputs. No separate static
type-check target is configured for this JavaScript/Python demo.

`evaluation/corpus.json` contains six invented policy documents, 18 gold sections
and 30 questions: 24 answerable, including six multi-section questions, and six
unsupported questions. PDFs are generated in memory. The label-blind lexical mock
intentionally exposes weak same-topic abstention; it is not a semantic benchmark:

```powershell
.\.venv-rag-demo\Scripts\python.exe -I -B rag_demo/run_tests.py --evaluate-mock
```

Live mode uses real Gemini and PostgreSQL and requires explicit authorization for
provider calls/charges. Do not run it as part of an ordinary offline review:

```powershell
.\.venv-rag-demo\Scripts\python.exe -B -m rag_demo.evaluate --live --allow-provider-requests
```

Append `--environment` to use the RAG process variables; otherwise private prompts
request the dedicated credentials. The standard prompt path uses Settings defaults;
use `--environment` to select a non-default evaluation answer model. A complete
default run uses 43 embeddings and up to 30 generations. The shipped CLI has no
request pacing/retries; confirm quota before running. The successful paced run
below used a separate validation driver, not a new CLI pacing option.

The evaluator creates two accounts, uploads only the shipped synthetic corpus,
checks isolation/deletion, asks all questions and logs out both sessions. It
retains two accounts and five documents; it neither initializes schema nor cleans
pre-existing data. Plan a reviewed owner-scoped cleanup before any live run.
Generated credentials and account identifiers are not printed in the aggregate
report. Do not repeatedly create orphaned test accounts or delete rows by a broad
username prefix. Live cleanup tooling/private credential handoffs are not included
in this checkpoint.

Question transport/HTTP/JSON/schema errors, mandatory request failures, missing
isolation checks or failed logout produce nonzero exit status. Expected unsupported
abstention is measured normally. Operational success does not certify answer
quality. Errors remain in denominators. Hit@1 and Recall@5 use full labeled sections
inside retrieved passages; citation integrity checks literal quotes/metadata and
gold-source precision checks supporting-section overlap. Neither proves semantic
entailment of each generated claim. Always inspect the cited passages.

## Verification record and remaining limitations

Recorded on October 16, 2026:

| Evidence | Result / provenance |
|---|---|
| Offline regressions | 77 backend tests; 101 frontend tests, including 10 RAG and 91 finance checks; both builds and 18 Python syntax checks passed |
| Real API integration | 24 checks passed using real Gemini, local PostgreSQL and TCP HTTP to Uvicorn |
| Latest paced live evaluation | 30 questions; 0 request errors; Hit@1 83.33%; Recall@5 100%; relevant citations 35/35; unsupported abstention 6/6; false abstention 0/24; security checks 10/10 |
| PDF UI rehearsal | Actual browser upload/indexing, grounded answer and expanded exact citation inspected |
| TXT UI rehearsal | **MANUAL UI VERIFICATION — user-reported pass** for sign-in, browser upload, indexing, expected answers and unsupported-question handling; not an automated test |
| Manual-test closeout | Ownership verified for the sole synthetic account; supported UI deletion/logout; global accounts/sessions/documents/chunks all 0, embedding contract preserved at 1 |

The historical live checks used real providers/storage, while ASGI evaluation
transport remained in-process. The manual TXT report did not separately attest
displayed-citation inspection; no automated TXT browser pass is claimed. The old
q07 failure was reproduced as citation field-name drift; a required response
schema fixed the reproduced case without relaxing quote validation.

An earlier run encountered confirmed Gemini HTTP 429. An earlier q12/diagnostic
error remains inconclusive. Successful later runs do not establish its root cause.
Sanitized provider failure handling remains generic; the adapter assumes the first
candidate text part contains JSON. Detailed provider response-shape handling and
bounded retry/pacing policies require separate work. The 0.65 retrieval threshold
needs calibration. Generation has no distributed abuse controls. Linux parser
resource-limit behavior has not been exercised in the recorded Windows checks.

Only top-level Python dependencies are pinned; there is no full transitive lock.
`pypdf==6.20.1` includes the inline-image infinite-loop fix first released in 6.1.3:
[pypdf advisory](https://github.com/py-pdf/pypdf/security/advisories/GHSA-vr63-x8vc-m265).
The reviewed FastAPI 0.115.12 constraint resolves Starlette 0.46.2, which falls in
the affected range of the [multipart file-parsing advisory](https://github.com/Kludex/starlette/security/advisories/GHSA-2c2j-9gv5-cj73).
RAG accepts raw bodies and does not invoke multipart/form parsing; this is not a
claim that the dependency itself is patched. Review and upgrade the RAG dependency
set before exposing new parsing paths or considering deployment. This review is
not a complete dependency vulnerability certification.

Secret scan results are pattern-based checks, not a guarantee that every possible
credential format is recognized. Keep `.env*`, database credentials, keys, tokens,
private handoffs, generated PDFs/builds, caches and local diagnostic reports out of
Git. Do not stage directories broadly. The code and fixtures in this checkpoint
contain synthetic data only. Production deployment, TLS, a full parser sandbox,
operational hardening and complete semantic/security validation remain outside
the approved local-demo scope.
