# RAG project handoff

Prepared: October 16, 2026. Scope: the isolated, synthetic-only local RAG demo
inside the existing Finora repository (formerly Family Finance Tracker). The repository name and local environment paths remain unchanged; see the [finance project handoff](FAMILY_FINANCE_TRACKER_HANDOFF.md) for the current product identity.

## 1. Status and how to interpret this record

The RAG implementation and its targeted Starlette remediation are committed
locally. Historical live integration, evaluation and a supervised local UI
rehearsal passed with the qualifications below. The RAG work is suitable for a
supervised local demo; it is not production-ready or security-certified.

The RAG commits have not been pushed in this session, and no public RAG deployment
has occurred. This handoff is initially an unstaged file. Its creation does not
authorize staging, committing, fetching, pushing or deploying.

Evidence labels used here:

- **Current source/Git inspection:** verified while preparing this document.
- **Recorded verification:** performed in earlier phases; not rerun merely to
  create this handoff. Dates, counts and scope are preserved rather than promoted
  to a claim about today's provider availability or database contents.
- **Manual verification:** explicitly user-reported browser activity, not an
  automated browser test.
- **Unverified:** current remote server state, hosting triggers, live credentials,
  current service liveness and current database counts were not checked here.

Future chats should read this file, verify actual Git/source state, preserve
existing work and request authorization for actions outside their current task.
Do not reopen the RAG implementation without a concrete defect or a new request.

## 2. Repository, branch and immutable checkpoints

- Repository: `C:\Users\itsni\Desktop\family-finance-tracker`.
- Branch at preparation: `main`.
- HEAD at preparation: `44ea6a47545421fa7348f6b09af942b9751b1065`.
- Original base: `175c0b7bf6fc968afed583739e46bcd324b42f3e`.

| Commit | Purpose | Committed scope |
|---|---|---|
| `ebe3a492d87226eb19e26b7b2cd04cc30ea16c13` | `feat(rag): add isolated local RAG demo` | Exactly 32 RAG implementation, UI, fixture, test and README files; 3,086 inserted lines |
| `44ea6a47545421fa7348f6b09af942b9751b1065` | `fix(rag): patch Starlette multipart vulnerability` | Only `rag_demo/requirements.txt`; separate commit, not an amendment |

The second commit's parent is the first commit. Preserve both hashes/history.
The appendix lists the exact 32 paths. Neither commit includes the outstanding
finance modifications or unrelated untracked material.

## 3. Protected working tree and GitHub readiness

Five pre-existing modified finance files must remain unstaged and unchanged:

1. `familyfinancetracker/src/hooks/useExpenses.js`
2. `familyfinancetracker/src/pages/Dashboard.jsx`
3. `familyfinancetracker/src/pages/Expenses.jsx`
4. `familyfinancetracker/src/utils/api.js`
5. `familyfinancetracker/tests/expenseHistory.test.mjs`

Ten pre-existing unrelated untracked entries must be preserved:

1. `BUGFIX_NAV_AI.md`
2. `DATA_RECOVERY_GUIDE.md`
3. `DEPLOYMENT_AUDIT_REPORT.md`
4. `DO_THIS_NOW.md`
5. `FINAL_FIX_ALL_ISSUES.md`
6. `QUICK_FIX_GUIDE.md`
7. `familyfinancetracker/src/utils/ammaChat.js`
8. `familyfinancetracker/tests/ammaChat.test.mjs`
9. `familyfinancetracker/tests/expenseSave.test.mjs`
10. `portfolio/` (an independent portfolio project and its assets).

Do not stage those entries for a RAG checkpoint. Some historical root documents
contain obsolete deployment/recovery advice. The untracked deployment audit also
contains password-bearing database URLs; their validity was not tested. Do not
copy or stage its contents. No credential values are reproduced in this handoff.

Sanitized configured remote identity:
`https://github.com/Nithish-kumar-git/family-finance-tracker` (`origin`, fetch and
push identities agree). The local branch tracks `origin/main`. At preparation,
the locally recorded remote tip is the original base above: main is **2 ahead,
0 behind**, and the outgoing range contains only the two RAG commits.

No fetch, pull, push or branch switch was performed. These counts describe local
tracking refs and do not prove that GitHub is unchanged. A future push of the
reviewed range would not include the five unstaged finance changes or untracked
files. This document itself is excluded until separately staged and committed.

The repository has `backend/vercel.json` for the finance backend. External GitHub,
Vercel/Netlify integration settings and automatic deployment triggers are
unverified. A push to a shared main branch could trigger hosting automation;
review that before authorizing any push. Do not equate pushing with permission to
deploy. Do not fetch or change remote settings merely because this file mentions
them. Future remote contact requires the user's authorization for that step.

## 4. Architecture and request flow

The RAG API is a separate FastAPI application under `rag_demo/`. It is never
registered with `backend/main.py`. The separate React/Vite UI does not import the
finance app entry point, profile/PIN authentication, store or finance API client.

Main components:

| File | Responsibility |
|---|---|
| `rag_demo/app.py` | Local-only API, body limits, login/session verification and routes |
| `rag_demo/auth.py` | Scrypt password hashes and SHA-256 session digests |
| `rag_demo/config.py` | RAG-only settings, resource ceilings and local database validation |
| `rag_demo/run_local.py` | Normal interactive launcher with private credential prompts |
| `rag_demo/service.py` | Upload quota/concurrency/deadline orchestration and ownership preflight |
| `rag_demo/pipeline.py` | TXT/PDF extraction, chunking, embeddings, generation and citation checks |
| `rag_demo/pdf_worker.py` | Separate resource-bounded PDF extraction process |
| `rag_demo/repository.py` | Parameterized SQL and transaction-scoped owner context |
| `rag_demo/schema.sql` | Reviewed one-time schema artifact; never auto-executed |
| `rag_demo/evaluate.py` | Explicit synthetic mock/live evaluation and operational failure status |

Upload flow: authenticated raw PDF/TXT bytes -> bounded extraction -> normalized
page-aware chunks -> real Gemini document embeddings -> checked 768-dimensional
vectors -> atomic owner-scoped document/chunk insert in PostgreSQL.

Question flow: authenticated owner and explicit document checks -> real query
embedding -> exact pgvector cosine search -> generation from retrieved passages
-> local exact source/quote validation -> answer/citations or abstention.

Retrieval uses the top five passages and minimum similarity 0.65. Chunk size is
900 characters with 150-character overlap by default. Neither retrieval threshold
calibration nor complete semantic answer correctness has been established.

## 5. Frontend and build boundaries

- HTML entry: `familyfinancetracker/rag-demo.html`.
- React entry/UI: `familyfinancetracker/src/ragDemo/main.jsx`.
- Raw-file transport and operation gate: `src/ragDemo/client.js`.
- Styles: `src/ragDemo/style.css`.
- Separate configuration: `familyfinancetracker/vite.rag.config.js`.
- Browser URL: `http://127.0.0.1:5174/rag-demo.html`.
- Separate API: `http://127.0.0.1:8001`, routes under `/rag/*`.

Vite binds to loopback with a strict port. Its RAG configuration disables `.env`
loading, the shared public directory and the finance PWA/service-worker plugin.
Its direct build target is `rag-demo-dist`; prefer the verification build helper
below, which writes both build outputs to temporary directories outside the repo.
No build output is a production deployment authorization.

## 6. Authentication, sessions and ownership

Use newly created synthetic demo accounts with distinct passwords. Account
passwords are salted scrypt hashes. Login returns an opaque random bearer token;
only its SHA-256 digest and one-hour expiration are stored in the dedicated DB.
The UI holds tokens in memory, not localStorage or cookies. Each protected request
checks the server-side session. Logout requests revocation and forgets the token
locally. If server logout is unreachable, the old session may survive until
expiry; cleanup must verify revocation rather than assuming local sign-out did it.

Owner IDs come from verified sessions, not a caller-supplied owner header. SQL
binds values and sets transaction-local `rag.owner`. Documents/chunks have forced
RLS owner policies and matching owner/model/dimension foreign-key constraints.
Explicit foreign document IDs fail before provider calls. Historical live tests
exercised cross-owner reads/deletes and session expiry/revocation. Merely seeing
RLS policies in source is not evidence of a fresh live isolation test.

RLS is defense in depth for this trusted application server, not protection from
an attacker already possessing its database role credentials. Login throttling
and upload concurrency are process-local. This is not a multi-tenant production
authentication or distributed abuse-control design.

## 7. Dedicated local PostgreSQL and pgvector

The following is the recorded verified RAG-only service, not the finance DB:

| Item | Recorded configuration |
|---|---|
| Host / port | `127.0.0.1` / `5544`, bound to loopback only |
| Database / schema | `fft_rag_demo` / `rag_demo` |
| Restricted app / bootstrap role | `rag_app` / `rag_bootstrap` |
| Container | `fft-rag-demo-local` |
| Volume | `fft_rag_demo_data` |
| Network | `fft-rag-demo-net` |
| PostgreSQL / installed vector extension | 16.15 / pgvector 0.8.7 |
| Container limits | 512 MiB memory, one CPU, 128 processes |

Recorded image:
`pgvector/pgvector@sha256:a97d77306ff47cc1d8add4d000cec2207da2e110746318df3137ce53c337ca30`.

Five tables: `accounts`, `sessions`, `embedding_contract`, `documents`, `chunks`.
Schema/table ownership stays with the bootstrap role. The app role is restricted:
NOSUPERUSER, NOCREATEDB, NOCREATEROLE, NOINHERIT, NOREPLICATION, NOBYPASSRLS,
connection limit 10, and no administrator memberships or database/schema CREATE.
It has limited account/session/document/chunk grants and read-only contract access.
Role provisioning and database-level privileges are separate from `schema.sql`.

The database is already initialized. **Do not rerun schema.sql**, recreate any
resources, reset data, or use a finance connection as a convenience. Inspect
resource names/ownership safely before any future service operation. Never dump
Docker environment settings, which can contain bootstrap credentials. No SQL or
Docker operation was performed to prepare this document. Current liveness,
privileges and row counts must be reverified only when an authorized task needs it.

## 8. Models and configuration names

Embedding model: **gemini-embedding-001**. The application contract requires
**768 dimensions**, with separate retrieval-document and retrieval-query task
types, finite-value checks and normalization. Preserve the stored contract;
do not change dimensions/models or re-embed data as routine setup.

Answer model: **gemini-3.5-flash-lite**. The normal launcher reads
`RAG_ANSWER_MODEL` from the current process and otherwise uses the source default.
Do not set persistent user/machine variables. Availability is credential-specific;
the historical generation success does not guarantee future availability.

Only the following RAG configuration variable names are relevant here. Their
values, credentials and connection strings are deliberately omitted:

| Name | Use |
|---|---|
| `RAG_DEMO_ENABLED` | Explicit opt-in for the optional environment-based API path |
| `RAG_DATABASE_URL` | Dedicated local application-role connection, environment path only |
| `RAG_GEMINI_API_KEY` | Separate RAG demo credential, environment path only |
| `RAG_EMBEDDING_MODEL` | Embedding model selection, environment path only |
| `RAG_EMBEDDING_DIMENSIONS` | Contract dimensions, environment path only |
| `RAG_ANSWER_MODEL` | Answer-model override; also honored by the normal launcher |
| `RAG_CHUNK_SIZE` | Bounded chunk setting, environment path only |
| `RAG_CHUNK_OVERLAP` | Bounded overlap setting, environment path only |

The normal interactive launcher uses its fixed local database target, embedding
defaults and private prompts; it does not read all environment-path overrides.
The optional `rag_demo.app:app` environment path requires the RAG settings above.
It never loads finance `.env` files. Its URL validator accepts another explicit
loopback port, so operators must keep the reviewed RAG target on 5544. The normal
launcher fixes that port. Never tunnel the target to an unrelated database.

## 9. Secure local environment and normal launch

Use an isolated Python 3.12+ environment and the existing frontend Node packages.
Do not change finance dependencies or reuse finance credentials. The targeted
remediation was tested in a fresh environment outside the repository; older
environments were deliberately not upgraded in place. Verify versions before
resuming. No complete transitive Python lock is committed.

The commands below use an example external environment location. They are future
operator instructions, not actions executed for this handoff. Verify the intended
Python interpreter first. For first-time provisioning only, and only if this new
environment path is absent:

```powershell
Set-Location 'C:\Users\itsni\Desktop\family-finance-tracker'
$ragEnv = Join-Path $env:LOCALAPPDATA 'FamilyFinanceTrackerRagDemo'
if (Test-Path -LiteralPath $ragEnv) { throw 'Inspect the existing environment; do not overwrite it.' }
python -m venv $ragEnv
$ragPython = Join-Path $ragEnv 'Scripts\python.exe'
& $ragPython -m pip install -r rag_demo/requirements.txt
& $ragPython -m pip check
```

For an already provisioned, verified isolated environment, open an interactive
terminal at the repository root and select its interpreter:

```powershell
Set-Location 'C:\Users\itsni\Desktop\family-finance-tracker'
$ragEnv = Join-Path $env:LOCALAPPDATA 'FamilyFinanceTrackerRagDemo'
$ragPython = Join-Path $ragEnv 'Scripts\python.exe'
& $ragPython -I -B -c "from importlib.metadata import version; print({p: version(p) for p in ('fastapi', 'starlette', 'pypdf')})"
& $ragPython -B -m rag_demo.run_local
```

Use the launcher's two private prompts for the dedicated application-role password
and separate RAG Gemini key. Confirm masking/no echo; stop if private input is not
available. Never paste secrets into chat, command lines, source, logs, screenshots
or committed files. Do not copy credentials from finance environments. Temporary
private credential handoffs used in earlier verification were removed; do not
assume that a usable Gemini key remains available locally.

In a second terminal, using existing frontend dependencies:

```powershell
Set-Location 'C:\Users\itsni\Desktop\family-finance-tracker\familyfinancetracker'
node node_modules/vite/bin/vite.js --config vite.rag.config.js
```

Open the browser URL in section 5. The launcher starts only the RAG API, not the
UI or database. Stop if required credentials/service dependencies are missing;
never substitute mocks or a finance database. Last manual-test closeout stopped
temporary API/UI launchers and preserved the database service/volume. Their state
has not been rechecked for this documentation task.

## 10. Offline tests and builds

From the repository root, using the verified interpreter selected above:

```powershell
& $ragPython -I -B rag_demo/run_tests.py
Push-Location familyfinancetracker
node --jitless --experimental-vm-modules --test tests/ragDemo.test.mjs
Pop-Location
node rag_demo/build_frontends.mjs
git --no-optional-locks diff --check
```

The Python runner optionally accepts `--dependencies <isolated-install-directory>`.
It strips inherited application settings and blocks network/database and `.env`
reads. Windows asyncio's internal stdlib socketpair is the bounded exception.
Mocked route tests are not live Gemini/PostgreSQL proof. No separate static type
checker is configured; recorded Python syntax checks parsed 18 RAG Python files.

The RAG frontend suite has 10 tests and is committed. The historical combined
101-test frontend run additionally exercised 91 finance checks in the local
working tree. Two finance test files and their chat utility are still untracked,
and the finance sources have five unstaged changes. **Do not claim that the 101
tests describe a clean clone of the RAG commits.** Do not stage finance work to
make that number reproducible. Existing tracked finance tests can be reviewed
separately; the safe RAG-only command above does not require the untracked files.

For this exact preserved working tree only, the earlier combined command was:

```powershell
Push-Location familyfinancetracker
node --jitless --experimental-vm-modules --test tests/ragDemo.test.mjs tests/expenseSave.test.mjs tests/expenseHistory.test.mjs tests/dataRecovery.test.mjs tests/ammaChat.test.mjs
Pop-Location
```

The build helper disables `.env` loading, uses synthetic finance API configuration
and writes both finance/RAG production builds to temporary output directories.
It preserves existing `dist`. Both builds passed in the recorded local working
tree; a clean-clone build was not separately established. The existing finance
bundle-size warning was nonfatal. Do not deploy these verification outputs.

## 11. Evaluation and verified results

Corpus: `rag_demo/evaluation/corpus.json`, six synthetic policy documents, 18 gold
sections, 30 questions (24 answerable, six unsupported; six multi-section cases).

| Recorded evidence | Result and qualification |
|---|---|
| Live API integration | 24 checks passed with real Gemini, local DB and TCP HTTP to Uvicorn |
| Latest paced live evaluation | 30 questions, zero request errors |
| Hit@1 / Recall@5 | 83.33% / 100%; labeled retrieval metrics, not answer accuracy |
| Relevant citations | 35/35; supporting-source relevance and exact quotes, not proof every answer claim is entailed |
| Unsupported abstention | 6/6 |
| False abstention | 0/24 answerable questions |
| Evaluation security checks | 10/10 |
| Offline backend regression | 77 passed, zero skips, including after the dependency remediation |
| Combined local frontend regression | 101 passed, zero failures/skips; working-tree qualification in section 10 |
| Build / syntax / whitespace | Both builds, 18 RAG Python syntax checks and whitespace checks passed |

Evaluation transport used authenticated in-process ASGI routes with real external
providers/storage in live mode. It is distinct from the separate TCP API checks
and browser rehearsal. The successful paced run used an external validation
driver; pacing/retry options were not added to the shipped CLI.

Mock evaluation is explicitly synthetic and does not prove semantic quality:

```powershell
& $ragPython -I -B rag_demo/run_tests.py --evaluate-mock
```

Do not run live evaluation without fresh authorization for provider calls/charges
and an owner-scoped cleanup plan. Once authorized, the actual CLI is:

```powershell
& $ragPython -B -m rag_demo.evaluate --live --allow-provider-requests
```

Its default private-prompt path uses Settings defaults. Append `--environment`
only for privately configured RAG process settings; that is how non-default
evaluation model selection is supported. A normal complete run uses 43 embeddings
and up to 30 generations. The CLI creates two synthetic accounts and normally
retains five documents after one deletion check; it is not a self-cleaning demo.
Generated credentials/identifiers are not included in its aggregate output.

Unexpected request/schema failures, failed mandatory checks or isolation/logout
checks cause a nonzero exit. Unsupported-question abstention is measured rather
than treated as a request error. Operational success is not a quality threshold
or production sign-off. Do not relax thresholds or hide errors to improve scores.

## 12. Manual UI rehearsal and cleanup

**MANUAL UI VERIFICATION — user-reported pass:** the normal application opened;
the user signed in, selected `rag-upload-test.txt` through the browser picker,
indexed it, obtained answers matching the synthetic facts and saw expected
unsupported-question behavior. This is not an automated browser TXT-upload test.
The manual report did not separately attest expanded-citation inspection.

Recorded PDF browser rehearsal separately inspected upload/indexing, a grounded
answer and expanded exact citation. TXT API ingestion also passed earlier, but an
API test alone was never used to claim browser TXT verification.

Recorded closeout verified the TXT document belonged to the intended sole
synthetic account. It used authenticated owner-scoped document deletion and
logout, followed by a reviewed bootstrap cleanup of the verified empty account.
Final global counts were zero accounts, sessions, documents and chunks, while
`embedding_contract` remained one row. Temporary API/UI launchers and private
Gemini handoff material were removed. The database/container/volume were retained.
These are historical cleanup results, not a fresh row-count assertion.

For future tests: use synthetic data only; record identities privately; delete
documents through supported owner UI/API/repository operations; verify cascading
chunk cleanup and session revocation. The app role cannot delete accounts.
Removing empty synthetic accounts requires separately reviewed bootstrap access
constrained to exact verified account ID/username pairs. Never delete by a broad
prefix, wipe tables, remove the contract or reset infrastructure to clean a test.

## 13. Dependency remediation and security scope

Current RAG declaration: `rag_demo/requirements.txt` pins FastAPI 0.116.1,
Starlette 0.47.2, Uvicorn 0.34.3, HTTPX 0.28.1, psycopg[binary] 3.2.9 and
pypdf 6.20.1. No finance dependency file was changed.

The targeted security commit fixes **GHSA-2c2j-9gv5-cj73 / CVE-2025-54121**,
the multipart file rollover event-loop blocking vulnerability. The official
advisory names Starlette 0.47.2 as patched:
https://github.com/Kludex/starlette/security/advisories/GHSA-2c2j-9gv5-cj73

FastAPI 0.115.12 previously constrained Starlette below 0.47.0; FastAPI 0.116.1
permits the patched pin. A fresh isolated test installation resolved exactly
FastAPI 0.116.1 / Starlette 0.47.2 and preserved every other previously tested
dependency version. `pip check` found no conflicts. A harmless nine-byte rollover
probe confirmed thread dispatch in the patched package and synchronous rollover
in the untouched old package. Existing environments were not upgraded in place.

This is a targeted advisory fix, not a complete dependency security upgrade.
Later Starlette advisories still include this version in affected ranges for
other functionality. Current RAG routes do not use form parsing, StaticFiles,
FileResponse, HTTPEndpoint subclasses or security-sensitive request.url decisions.
Review current advisories before adding such paths or considering deployment:
https://github.com/Kludex/starlette/security/advisories

The older dependency paragraph in `rag_demo/README.md` records the pre-remediation
review; the committed requirements and this section state the current pins.
pypdf 6.20.1 includes the reported inline-image infinite-loop fix; parser resource
bounds remain essential and do not constitute a complete operating-system sandbox.

## 14. Known limitations and facts not to overstate

- Earlier Gemini HTTP 429 was confirmed. Provider quota/availability is not
  guaranteed, and the shipped adapter has no automatic retry or model fallback.
- The earlier q12/diagnostic error remains inconclusive. Later success does not
  establish its root cause or prove that it was the same as the HTTP 429.
- Earlier q07 false abstention was reproduced as citation field-name drift. A
  required response schema fixed that reproduced case without weakening the
  local source/quote checks. Latest recorded false abstentions were zero.
- Provider exceptions are sanitized generically; answer parsing assumes the first
  candidate text part contains JSON. Exact citations do not prove claim entailment
  or eliminate prompt-injection/answer-quality risk.
- Limits: 2 MiB upload, 40 PDF pages, 100,000 extracted characters, 160 chunks,
  bounded decoder work, five-second PDF deadline and 256 MiB parser memory cap.
  Windows resource controls were exercised; Linux controls were not established
  by those Windows tests. No OCR support or complete parser sandbox is claimed.
- Indexing has a cooperative 60-second deadline and provider requests have a
  20-second timeout; UI timeout is 30 seconds. A timed-out write may have completed.
  Refresh before resubmitting; there is no idempotency guarantee.
- No full transitive dependency lock, calibrated retrieval threshold, distributed
  abuse controls, public deployment, TLS deployment design or production sign-off.
- The separate finance audit found issues in unauthenticated reset/API access,
  deletion acknowledgements, Amma backend errors and historical credential-bearing
  documents. Those are not RAG fixes and were not authorized for implementation.
  The five finance modifications and all untracked entries remain protected.

## 15. Approval boundaries and exact next steps

Never change without explicit authorization: either existing RAG commit/history;
the protected finance work/untracked files; environment files or credentials;
database schema/data/ownership/embedding contract; Docker resources; authentication,
RLS, validation or resource ceilings; production/hosting configuration; or branches.
Do not stage broad directories, amend commits, reset, clean, push or deploy.

Next actions for this handoff, in order:

1. User reviews the complete new document diff and current Git status. Keep this
   file unstaged until explicitly approved.
2. If approved, stage only `docs/RAG_PROJECT_HANDOFF.md`; inspect the staged diff,
   scan for secrets and verify all protected files remain untouched. Commit only
   after approval covering that commit; preserve the separate remediation commit.
3. Before any push, obtain authorization to refresh remote information, review
   the complete outgoing commit/path range and check hosting auto-deploy behavior.
   Reconfirm the intended GitHub repository and require explicit push approval.
   Do not assume local tracking refs prove a fast-forward is still available.
4. A fresh chat should read this file, recheck branch/HEAD/status and current
   requirements, then stop unless the user requests a concrete next task. Do not
   restart or reevaluate RAG just to reconstruct prior evidence.
5. If a local rehearsal is requested, verify only the dedicated RAG service,
   resolve the pinned dependencies in an isolated environment, obtain credentials
   privately, start the normal launcher/UI, then perform owner-scoped cleanup and
   stop only the temporary processes created for that rehearsal.
6. Broader dependency hardening, provider diagnostics/pacing, full cleanup tooling,
   finance authentication or a public deployment require separately scoped work.

## Appendix: exact implementation commit paths

Commit `ebe3a492d87226eb19e26b7b2cd04cc30ea16c13` added exactly:

```text
familyfinancetracker/rag-demo.html
familyfinancetracker/src/ragDemo/client.js
familyfinancetracker/src/ragDemo/main.jsx
familyfinancetracker/src/ragDemo/style.css
familyfinancetracker/tests/ragDemo.test.mjs
familyfinancetracker/vite.rag.config.js
rag_demo/README.md
rag_demo/__init__.py
rag_demo/app.py
rag_demo/auth.py
rag_demo/build_frontends.mjs
rag_demo/config.py
rag_demo/evaluate.py
rag_demo/evaluation/corpus.json
rag_demo/pdf_worker.py
rag_demo/pipeline.py
rag_demo/repository.py
rag_demo/requirements.txt
rag_demo/run_local.py
rag_demo/run_tests.py
rag_demo/schema.sql
rag_demo/service.py
rag_demo/tests/__init__.py
rag_demo/tests/fakes.py
rag_demo/tests/fixtures/insurance.txt
rag_demo/tests/fixtures/savings.txt
rag_demo/tests/fixtures/travel.txt
rag_demo/tests/test_evaluation.py
rag_demo/tests/test_hardening.py
rag_demo/tests/test_rag.py
rag_demo/tests/test_response_schema.py
rag_demo/tests/test_settings.py
```

Commit `44ea6a47545421fa7348f6b09af942b9751b1065` modified exactly:

```text
rag_demo/requirements.txt
```
