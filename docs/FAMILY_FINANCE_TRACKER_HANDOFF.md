# Finora — project handoff

Updated **21 October 2026**, Asia/Calcutta. **Finora** is the coined product name; tagline: **Your finances, clearly understood.** No dictionary meaning or legal availability is asserted. The navy `#12263A` / mint `#74D4BD` F monogram is shared by sidebar, personal entry, favicon and PWA icons. Existing layout, controls, authentication, storage keys, financial logic and project/repository names are preserved. Scope: the existing finance portfolio demo and separate personal browser workspace. This record supersedes historical finance instructions that describe an email-login frontend or working personal cloud synchronization. Preserve the separate RAG handoff.

## 1. Purpose, status and evidence labels

An interactive finance portfolio covering expenses, budgets, assets, milestones, employment, reports and Gemini chat. The public entry is a synthetic demo with Finora branding published and verified live; the personal workspace preserves profile/PIN interaction and is device-local.

- **Verified live:** observed on 21 October in the hosted app or authenticated GitHub/hosting metadata.
- **Verified source:** confirmed in committed code, not necessarily exercised against production.
- **Recorded local test:** actually run on 20 October at `f794d8a`; functional behavior is unchanged, but the current branding pass has separate focused verification below. Not a new full-suite run today.
- **Deployed, not end-to-end verified:** hosted code whose complete workflow was not safely exercised.
- **Owner-reported / unverified:** earlier owner evidence or unresolved environment facts, not independent verification.

**Status:** the synthetic portfolio demo is live and demonstrated. Personal cloud financial management is incomplete; this is not a security certification.

## 2. Repository, branches and protected working tree

**Verified Git/GitHub at preparation:**

- Repository: https://github.com/Nithish-kumar-git/family-finance-tracker
- Local directory: `C:\Users\itsni\Desktop\family-finance-tracker`.
- Default and current working branch: `main`. The previous `codex/finance-reliability-20261016` branch is preserved.
- HEAD/remote main at this documentation refresh: `5d60cc33219576260e3ccc4742428f68e6f1b456` (published Finora branding). Functional application checkpoint: `f794d8a666f00c3e5b768dcdbbee528d8bbef834`. The preserved implementation branch remains at `8187c5b`.
- The earlier portfolio pass fast-forwarded `main` to `8187c5b`; GitHub confirmed PR #1 merged/closed: https://github.com/Nithish-kumar-git/family-finance-tracker/pull/1.
- Current task: refresh genuine Finora production screenshots and current documentation, then commit/push only those files on the existing default branch. No runtime change, manual deployment, force-push, history rewrite, repository rename or hosting-settings change. Pre-existing work is retained.

The documentation commit cannot contain its own hash. Obtain its exact SHA with `git log -1 --format=%H -- docs/FAMILY_FINANCE_TRACKER_HANDOFF.md`; obtain the current remote default-branch SHA with `git ls-remote origin refs/heads/main`. Verify actual refs when resuming; the values above are preparation checkpoints.

Preserve and exclude from this release: modifications to `security/PREVIEW_TEST_RUNBOOK.md` and `security/VERIFY_BACKEND_ROLE.md`; the six root notes (`BUGFIX_NAV_AI.md`, `DATA_RECOVERY_GUIDE.md`, `DEPLOYMENT_AUDIT_REPORT.md`, `DO_THIS_NOW.md`, `FINAL_FIX_ALL_ISSUES.md`, `QUICK_FIX_GUIDE.md`); `portfolio/`; untracked security notes and local artifacts. Historical notes may contain credential-bearing material: never print, copy, stage or publish their contents. Never use broad staging, reset or clean.

## 3. Production URLs and deployment configuration

| Service | Verified configuration | Public URL |
| --- | --- | --- |
| Frontend | Netlify `scintillating-donut-a597ff`; site ID `e8d1cc6e-d586-4fdf-b7d4-0d74594fca9b`; base `familyfinancetracker`; build `npm run build`; publish `dist`; branch `main`; auto-publishing paused | https://scintillating-donut-a597ff.netlify.app/ |
| Backend | Vercel `family-finance-tracker`; team `nithish-kumar-gits-projects`; project ID `prj_X1yVl4BBRN9415GqUdwE70ObCfIG`; FastAPI; existing Git integration | https://family-finance-tracker-pearl.vercel.app/ |

**Verified source:** `backend/vercel.json` routes backend paths to `main.py` using `@vercel/python`. The filtered connector did not independently expose the dashboard root-directory value; preserve it. The frontend has explicit SPA rewrites in `familyfinancetracker/public/_redirects`, including owner deep links, without a blanket API rewrite.

No hosting settings were changed for this Finora release. Keep Netlify publishing paused unless authorized otherwise. Vercel Git integration may build automatically when refs move; inspect generated deployment metadata rather than assuming nothing deployed. Documentation-only work does not require manual app redeployment.

## 4. Exact deployed revision evidence

**Verified hosting metadata at the Finora documentation refresh, 21 October:**

| Service | Application commit | Deployment ID | Status |
| --- | --- | --- | --- |
| Netlify production | `5d60cc33219576260e3ccc4742428f68e6f1b456` | `6ad8221b2fc74aafb1111c3d` | ready, manually published, auto-publishing locked/paused |
| Vercel production | `5d60cc33219576260e3ccc4742428f68e6f1b456` | `dpl_D6YFVFihFKuDN6DKhsuVPUqmRAdB` | READY, Git-triggered main build; backend source identical to `f794d8a` |

Vercel's immutable checkpoint URL: `https://family-finance-tracker-ozhmbguc5-nithish-kumar-gits-projects.vercel.app`. Immutable/preview URLs can have deployment protection. These are point-in-time observations; later Git-triggered builds may have new IDs/SHAs with unchanged application source. Read platform metadata before claiming the current hosted revision.

Finora’s frontend publication is complete and its live branding was checked. Netlify automatic publishing remains paused. This documentation/screenshot-only commit needs no manual app deployment; main pushes can still trigger the existing Vercel Git integration.

## 5. Architecture and main source locations

**Verified source:** React 18, Vite 6, React Router 7, Zustand, Tailwind, Recharts and Lucide; FastAPI, Pydantic, SQLAlchemy and psycopg drivers; Gemini through `google-genai==1.16.1`; PostgreSQL hosted on Supabase. An installed Supabase JS dependency is not an active frontend authentication/Data API integration.

```text
Public / → automatic synthetic demo → React pages
  Financial operations → authorizedFetch browser branch → browserRepository
    → selected Zustand workspace → durable localStorage acknowledgement
  Chat → readChat → /api/demo/ai/chat → server-owned synthetic context → Gemini

Owner /personal/ → profile/PIN → browser repository → fft_data
  Personal AI → guarded transport → no server credential → fails closed

Separate protected API → server-verified household identity → SQLAlchemy → PostgreSQL
```

| File/path | Responsibility |
| --- | --- |
| `familyfinancetracker/src/App.jsx` | Routing, basename, layout and banners |
| `src/components/FamilySession.jsx`, `src/pages/Auth.jsx` | Demo auto-entry and personal profile/PIN |
| `src/utils/workspace.js`, `src/store/useStore.js` | Workspace selection, synthetic fixture and persistence |
| `src/utils/browserRepository.js`, `src/utils/authorizedFetch.js`, `src/utils/api.js` | Browser financial contracts and server transport boundary |
| `src/utils/recordRecovery.js`, `src/components/RecoveryPanel.jsx` | Original-byte preservation and explicit recovery |
| `public/icons/finora.svg`, `public/icons/icon-192.svg`, `public/icons/icon-512.svg` | Shared original geometric Finora mark, navy/mint; no added dependencies |
| `src/components/WorkspaceEditor.jsx`, `src/components/DemoTools.jsx` | Editable details, demo reset and discreet owner access |
| `src/pages/Dashboard.jsx`, `src/utils/ammaChat.js` | Chat UI, context selection, timeout/cancellation/retry |
| `backend/main.py`, `backend/auth.py`, `backend/database.py` | Middleware, routes, authorization and SQLAlchemy |
| `backend/routers/demo_ai.py`, `backend/routers/ai.py`, `backend/services/ai_service.py` | Public synthetic chat, protected AI and Gemini |

`src/` paths are relative to `familyfinancetracker/`. `rag_demo/` and `src/ragDemo/` are a separate local project; they are not this finance assistant. Preserve them and `docs/RAG_PROJECT_HANDOFF.md`.

## 6. Frontend routes and data flow

**Verified source; dashboard/history/budgets/chat also verified live:**

| Public route | Purpose |
| --- | --- |
| `/` → `/dashboard` | Direct recruiter entry, no account or query parameter |
| `/dashboard` | Financial overview, reserve progress, milestones and chat |
| `/expenses` | Add, History and Summary tabs; month/member/category controls |
| `/budgets` | Editable limits, progress and near-limit alerts |
| `/assets` | Deposits, funds, insurance, savings groups, gold and reserves |
| `/milestones`, `/employment` | Goals and application/income projections |
| `/report` | Cash flow, asset reports, local snapshots and export |
| `/settings` | Workspace details, local backup, demo reset, collapsed owner access |

Owner routes mirror these under `/personal/`, which is the personal router basename. Demo navigation does not show a primary household login menu. A full navigation creates the other workspace's store/session; it does not reuse private state in the demo.

## 7. Backend API and database connection

**Verified source; authenticated hosted CRUD is not verified.** All grouped routes below begin `/api`.

| Paths | Methods / behavior |
| --- | --- |
| `/auth/me` | GET, verified household identity |
| `/expenses` | GET/POST, guarded |
| `/expenses/bulk`, `/expenses/{expense_id}` | DELETE, guarded; strict YYYY-MM for bulk/listing |
| `/assets/summary` | GET, guarded |
| `/assets/fixeddeposits`, `/assets/mutualfunds`, `/assets/lic`, `/assets/chitfunds` | GET/POST; corresponding `/{id}` PUT/DELETE; guarded |
| `/assets/mutualfunds/{mf_id}/update-value`, `/assets/lic/{lic_id}/mark-paid`, `/assets/gold` | PATCH, guarded |
| `/milestones` | GET/POST; `/{milestone_id}` DELETE; `/{milestone_id}/status` PATCH; guarded |
| `/employment` | GET/POST; `/{app_id}` PUT/DELETE; `/{app_id}/status` PATCH; `/bulk` DELETE; `/stats` GET; guarded |
| `/reports/snapshot`, `/reports/snapshots` | Singular GET/POST, plural GET; guarded |
| `/settings/income` | PATCH, guarded validation/echo; **does not write the income table** |
| `/ai/chat`, `/ai/parse-transaction`, `/ai/monthly-insights` | POST, guarded |
| `/demo/ai/chat` | POST, deliberately public, synthetic-only; no database dependency/tools |
| `/reset` | DELETE, always 403; destructive reset disabled |

`/health` is public GET outside `/api`. It uses SQLAlchemy `SELECT 1`; inspect its `database` field, not just HTTP 200. This is not a role/ACL or financial CRUD test. Session acquisition can fail before the handler catches query failures.

`backend/database.py` loads `SUPABASE_DATABASE_URL`, calls `create_engine(..., pool_pre_ping=True)` and yields/closes `SessionLocal`. The deployed effective PostgreSQL role is **UNVERIFIED**. Table ownership, SQL Editor identity and `/health` do not prove it.

## 8. Profile/PIN authentication and authorization

**Verified source + recorded local tests:** `localLogin.js` preserves the original three profile IDs and four-digit personal PIN interaction. Existing legacy PIN behavior is retained; new browser PINs use a random salt and PBKDF2-SHA256 (100,000 iterations). No new fixed password was embedded. Unlock selection is session-scoped.

The PIN is only a browser convenience lock, not protection from device/script access. `authClient.js` has no active Supabase client and `getAccessToken()` returns null. No email-link screen, callback initialization or recruiter login is active.

**Verified source + live missing-token rejection:** the backend independently verifies a bearer using Supabase `/auth/v1/user`, requires a confirmed non-anonymous authenticated identity, and maps it through server-controlled `FAMILY_EMAIL_PROFILES`. Missing/provider-rejected tokens return 401; outsiders 403; verification outages fail closed. Editable user metadata and supplied profile IDs do not grant access.

Approved members intentionally share one household's records. Expense `userId` is attribution, not a per-member access boundary. There are no tenant/family columns; do not extend the allowlist to unrelated households and claim isolation.

## 9. Real Gemini request flow

**Verified source + real provider response observed live:** Dashboard sends question/history through `ammaChat.js`, which chooses transport from the URL-selected workspace, bounds the client wait to 30 seconds and supports cancellation/explicit retry. Demo requests contain no financial context. `DemoChatRequest` rejects extra context/metadata (422), limits the question to 4,000 characters and history to six bounded user/model messages.

`/api/demo/ai/chat` supplies the original fictional example and imports no database/session model. `ai_service.chat` invokes `gemini-2.5-flash-lite` through the existing SDK with backend-only `GEMINI_API_KEY` and a 20-second provider timeout. Success returns `{ answer }`; errors are sanitized/retryable when appropriate. No local summary is disguised as a provider answer.

The fixed example: income ₹70,000; expenses ₹23,580; surplus ₹46,420; recorded assets ₹2,67,500; household spending ₹14,000. Browser edits are excluded and the UI discloses that. User questions/history go to Google: do not enter private details. Personal AI remains blocked without a genuine server session; never route its private context through the public demo endpoint.

## 10. Demo/personal storage and API isolation

**Verified source + recorded local tests:**

| Boundary | Demo | Personal |
| --- | --- | --- |
| Data key | `fft_demo_data_v2` | `fft_data` |
| Session unlock | `fft_demo_v2_unlocked` | `fft_personal_unlocked` |
| Other workspace keys | `fft_demo_v2_` prefix | Existing personal key names |
| Initial data | Fictional fixture only | Preserved records or empty personal defaults |
| Financial cloud transport | None | None from the current PIN frontend |

Only `/personal` or `/personal/...` selects private mode. Stale markers cannot change the public root's boundary. Demo startup/reset never reads personal records, PINs or recovery archives. `resetDemoWorkspace` refuses personal mode and writes only the demo namespace. Never clear all site storage for testing or a service-worker update.

## 11. Local persistence versus PostgreSQL

**Verified source:** normal browser financial forms in both modes use local durable writes before acknowledging success; failures preserve drafts/deletion state. Missing rows from a read are not authoritative deletions; recovery keeps conflicting versions for review. Chat history is in component memory, not a saved-chat feature.

The separate guarded API has PostgreSQL operations for expenses/assets/milestones/employment/report snapshots, but the PIN frontend cannot provide its required identity. Income is validation/echo only, and profiles/budgets have no registered cloud-sync API. A local save does not prove a database write or cross-device persistence.

No production records were queried for screenshots, seeded, reset, overwritten or changed in this release. Authenticated production financial writes were not tested.

## 12. Tables, migrations and unresolved role facts

**Verified model declarations, not a fresh production catalog query:** `backend/models.py` defines 13 tables: `users`, `expenses`, `budgets`, `fixed_deposits`, `mutual_funds`, `lic_policies`, `chit_funds`, `gold`, `emergency_fund`, `monthly_income`, `milestones`, `job_applications`, `monthly_snapshots`.

No verified complete baseline migration history is tracked. Do not assume branching or `create_all` safely reconstructs production constraints/grants/data. Never run `backend/seed.py` or historical reset scripts against production.

`security/lockdown_data_api.sql` is an **unapplied review-only proposal**: enables RLS and revokes application-table grants from PUBLIC/anon/authenticated, without broad policies. It depends on verifying the exact backend role's independent CRUD privileges and RLS access path. See `security/MIGRATION_REVIEW.md`, but prefer this handoff over its historical frontend-auth assumptions.

**Historical, not re-probed today:** 13 tables were reported RLS-disabled, policy-free and anonymously privileged. **Owner-reported containment:** Data API disabled/saved. This was not independently rechecked in this pass and does not prove all alternate access paths safe. Effective backend role remains unverified. No production SQL/migration, permission, schema or credential change was made here.

## 13. Environment-variable names

**Verified source; keep all credential/configuration values private:**

| Name | Scope and purpose |
| --- | --- |
| `VITE_API_URL` | Frontend build; backend origin for real AI requests |
| `GEMINI_API_KEY` | Backend-only provider credential; never VITE-prefixed |
| `FRONTEND_URL` | Explicit backend CORS origin allowlist |
| `SUPABASE_DATABASE_URL` | Backend SQLAlchemy connection |
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` | Backend identity verification |
| `FAMILY_EMAIL_PROFILES` | Backend approved identity/profile mapping; never publish values |

The current public frontend needs neither `VITE_SUPABASE_URL` nor `VITE_SUPABASE_PUBLISHABLE_KEY`. Existing unused hosting variables do not create an active cloud session. Do not retrieve/decrypt hosting secrets for documentation or request credentials in chat.

## 14. Local setup and development

**Verified package/source commands, not setup executed by this documentation pass:** Node 22+ is required; Node 24 is recommended for Windows tests. From root:

```sh
cd familyfinancetracker
npm ci
npm run dev
```

The demo data needs no database. For real local AI, privately set frontend `VITE_API_URL` to the local backend origin, include the Vite origin in backend `FRONTEND_URL`, configure the backend-only Gemini credential and restart the servers.

For backend work use a local or isolated development DB. Existing `.env` files may reference real household infrastructure: verify the target privately before starting anything. Do not use production-connected previews for financial write tests.

```sh
python -m venv .venv
# Activate the environment using the shell's normal mechanism.
python -m pip install -r backend/requirements.txt
cd backend
uvicorn main:app --reload
```

No dependency was installed/upgraded for this branding release. The private npm package name remains unchanged for compatibility; only its description was updated. No license/status badges are invented: no tracked license file or CI workflow was found; README badges link the live demo and confirmed technologies only. The Vercel root is not the React application; `/health` is the actual supported health endpoint.

## 15. Tests/build: actual evidence and commands

| Evidence | Actual result | Scope |
| --- | --- | --- |
| Recorded full backend run at `f794d8a`, 20 October | 95 passed, zero failures/skips | Mocked providers, SQL-free guards or synthetic SQLite; not hosted PostgreSQL CRUD |
| Recorded full frontend run at `f794d8a`, 20 October | 189 passed, zero failures/skips | Node 24, synthetic state/mocked transports |
| Recorded production build at `f794d8a` | Passed | Approx. 847 kB main JS; bundle-size warning remains |
| Recorded Finora branding pass at `5d60cc3` | 17 focused tests passed, zero failures/skips | Actual router/session/demo tests; full suites not repeated |
| Recorded Finora production build at `5d60cc3` | Passed; main JS approx. 847 kB, existing bundle warning | Same installed dependencies; 11 PWA precache entries including the Finora icon |
| Finora publication and screenshot refresh | Live brand, dashboard, expense history, budgets, genuine Gemini answer | Synthetic data only, no personal financial writes; four refreshed captures |
| Documentation-only refresh | Markdown/image references, screenshot format and diff/preservation checks | Runtime unchanged; no test-suite or build rerun |

Commands: from root, `python -m unittest discover -s backend/tests -p "test_*.py"`; from `familyfinancetracker/`, `npm test` and `npm run build`.

The recorded successful Windows runs used `.venv/Scripts/python.exe` and the existing Codex-cache Node 24 runtime, directly invoking Node with `--experimental-vm-modules --test --test-concurrency=1 tests/*.test.mjs`. Windows Node 22.20 previously crashed in the experimental VM-module harness; interrupted runs are not passes. On this machine, TestClient tests required execution outside the filesystem sandbox while their SQL/external-network guards remained active.

The recorded Vite build used `--configLoader native` and a temporary output folder for the Windows sandbox. Normal `npm run build` remains the project script. Rerun relevant checks if runtime/tests change; do not claim these counts for modified source. Earlier dependency audits are historical, not a fresh audit or current security certification.

## 16. Important commits and history

| Commit | Change |
| --- | --- |
| `175c0b7bf6fc968afed583739e46bcd324b42f3e` | Historical source lacking guarded household auth; never redeploy as a login shortcut |
| `aee36c95e34d2b5e596cc36a3ab80806a55735b2` | Earlier server-verified Supabase household authentication |
| `6d869d92e37c196252177bec12c4e09bbcc9881d` | Review/test checkpoint before final hardening commit |
| `30ea07f41eea80c3932a6304d8677ad9d0aaebe7` | 13-file backend request/response hardening |
| `ded7493` | Restored profile/PIN interaction and isolated browser demo |
| `dcd666a` | Corrected savings totals and app-shell cache revalidation |
| `be0e8c9058dd007d3ac86b8f1a367e72c19f6089` | Preserved personal records/recovery and unified restrained UI |
| `647da62571e9306a83f71245e52583f38afd8ac0` | Direct demo-first public entry |
| `3f4076677bba17ce0afe2498a179a963e6ac5fd8` | Explicit private deep-link rewrites |
| `f794d8a666f00c3e5b768dcdbbee528d8bbef834` | Real isolated Gemini demo, guarded personal AI transport, chat UI/tests |
| `8187c5bd40b7518652c6a46144c6279cee01c581` | Portfolio documentation and project handoff |
| `5d60cc33219576260e3ccc4742428f68e6f1b456` | Finora name, tagline, F monogram, favicon/PWA icons and branding docs; published to existing Netlify site |

Older email-login commits remain in normal history; they do not describe the current UI. Preserve history and avoid restoring that obsolete flow unnecessarily.

## 17. README and screenshot provenance

`README.md` is the public overview; this file is the maintenance handoff. These four repository-relative images were refreshed from the live Finora production frontend at `5d60cc3` on 21 October 2026:

| Path | Genuine captured content |
| --- | --- |
| `docs/screenshots/demo-dashboard.jpg` | Finora wordmark/F monogram and synthetic household dashboard |
| `docs/screenshots/demo-expenses.jpg` | Finora fictional October history and member filters |
| `docs/screenshots/demo-budgets.jpg` | Finora category limits, progress and near-limit alert |
| `docs/screenshots/demo-assistant.jpg` | Finora with a genuine Gemini response explaining the ₹46,420 surplus |

Captured through the browser screenshot API, not generated mockups. The assistant capture preserves the real response observed during publication verification; no extra provider request was needed for the refresh. The other three captures show full pages. JPEGs use the screenshot encoder’s compression, remain legible at native size and are individually below 150 KiB. No devtools, credentials or private household records appear. Previous unlinked images remain historical artifacts; repository/project paths and technical identifiers retain their existing names.

## 18. Live checks actually completed

**Finora publication and documentation refresh, 21 October:**

- Root enters `/dashboard` without login or query parameters. Live title is `Finora · Personal Finance Demo`; wordmark/F monogram, SVG favicon and PWA manifest identify Finora.
- Synthetic banner/names; income ₹70,000, expenses ₹23,580, savings ₹46,420, recorded assets ₹2,67,500.
- Expense History shows eight fictional records with month/member controls. Budgets shows category limits/progress and the near-limit alert. Both were reopened for the branded screenshots without editing records.
- A real Gemini response during publication verification explained the monthly surplus as ₹70,000 income minus ₹23,580 expenses. It remains visible in the refreshed assistant screenshot and came through the deployed public provider path.
- Authenticated hosting metadata confirmed section 4’s production revisions and preserved paused Netlify publishing. GitHub description, homepage and topics were already Finora-aligned; no metadata change was needed.

**Recorded earlier live checks, not repeated for this documentation refresh:** missing-token `/api/auth/me` returned 401 with `Cache-Control: no-store`; `/health` returned `status: ok`, `database: connected` (only its SELECT 1 connectivity check).

No OTP emails, authenticated hosted financial writes, migrations/reset scripts or private-row queries were used for this documentation refresh.

## 19. Local-only, deployed-but-unverified and unknown behavior

**Recorded local coverage:** draft/acknowledgement handling, duplicate submissions, failed deletions, month validation, AI bounds, body/rate protection, authorization/reset, cache/CORS, isolation/reset, recovery and calculations.

**Deployed, not end-to-end verified:** authenticated PostgreSQL CRUD using a genuine approved identity; approved-versus-outsider hosted account workflows; personal cross-device loading/saving. The frontend currently cannot establish that identity.

**Unverified:** effective production DB role/grants, present catalog/RLS state, independent Data API containment confirmation, distributed Vercel rate rules, complete isolated PostgreSQL bootstrap. Existing Preview may share production configuration: never run authenticated writes without proven isolation.

Finora’s title, wordmark, monogram, favicon and manifest were verified after production publication; the four refreshed screenshots now show the deployed brand. This does not verify personal cloud workflows or resolve the database-role questions above. No database test or additional provider request was made for the documentation refresh.

## 20. Current limitations and security considerations

1. Personal cloud synchronization and personal AI need an approved server-authentication integration while preserving PIN UX. Do not make private APIs public or claim the PIN is a server credential.
2. Historical personal data will be re-entered manually later. Never seed demo examples into it, overwrite tables, or infer DB emptiness from an empty browser.
3. Public AI uses the fixed initial example, not edited browser records. Quotas/outages can cause errors; explicit Retry is available. A prior success is not a guarantee of future availability.
4. Bodies are limited to 256 KiB with narrower AI schema limits. The shared 20-AI-request/minute budget is per Python process, not a distributed limit or strict global cost ceiling. Provider quotas/billing and platform rules need separate owner verification.
5. Database role/RLS/grant questions remain unresolved despite owner-reported Data API disablement. Re-enabling that API without reviewed permissions could restore exposure; disablement does not prove every alternate path safe.
6. Browser financial data is not encrypted by the PIN, synchronized or protected from device/script access. Local backup/recovery is not complete disaster recovery. Do not paste backups, tokens, PINs or connection strings into chat/docs.
7. Bundle-size warning and historical development dependency findings are not silently resolved. No blanket dependency audit was repeated here.

## 21. Deferred historical-data recovery plan

The owner chose manual personal re-entry later. Do not export private rows through this chat or overwrite production from synthetic fixtures. Preserve original browser bytes and production records; an empty device does not mean the database is empty.

Before re-entry intended for cross-device use: finish approved server-auth sessions and missing persistence APIs; verify the exact DB role/access paths; implement acknowledged sync; then test with synthetic data in proven isolation. Entries today remain device-local. Owner-operated backups/imports need explicit scope and a private destination; merge non-destructively and surface conflicting versions.

## 22. Prioritized remaining tasks

- **Before genuine personal cloud use:** approved server-auth design without automatically restoring email-link UI; acknowledged persistence; DB-role/grant/containment evidence; safe approved/outsider testing.
- **Before hosted financial writes:** proven isolation using owner-approved infrastructure. No new Supabase project, plan upgrade, production SQL/reset or grants change is assumed by this handoff.
- **Public-demo operations:** owner-visible provider quotas/usage and investigation of concrete outages; preserve paused Netlify publishing unless authorized otherwise.
- **Optional portfolio improvements:** bundle splitting and screenshot refresh after material UI changes. These do not justify another generic audit or redesign.

## 23. Exact instructions for the next coding session

1. Read this file and `README.md`; preserve Finora naming and inspect actual branch/HEAD/status and remote default branch. This is historical evidence, not authorization for production mutations.
2. Preserve every modified/untracked file, independent portfolio, browser record and production record. Never reset/clean/force-push. Stage named task files only.
3. Identify demo versus personal scope. Keep URL/storage isolation and fixed synthetic chat context intact. No email login or mandatory recruiter login unless a new explicit request changes the product requirements.
4. For docs-only tasks, validate Markdown/images, runtime equivalence and preservation; reuse applicable test evidence. For a concrete code defect, reproduce with synthetic fixtures and blocked SQL/providers, test/build as relevant, then verify exact hosting revisions within the new task's authority.
5. For publication, inspect GitHub/hosting first. Existing projects only, production branch `main`, Netlify publishing paused. Never publish obsolete code or assume a preview is isolated.
6. For personal cloud work, begin at `authClient.js` (no credential), `authorizedFetch.js`, `backend/auth.py` and DB-role/migration review docs. Establish the needed design/access once; do not weaken the allowlist, fetch private records or run SQL without authorization.
7. Report exact files/commits, actually run versus reused tests, actual deployment IDs/SHAs and genuine blockers. Never call a browser save a PostgreSQL save.
