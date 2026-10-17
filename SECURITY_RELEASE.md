# Coordinated security release — 17 October 2026

Follow-up verification and the current release blockers are recorded in
[security/RELEASE_READINESS.md](security/RELEASE_READINESS.md). The evidence below
describes the original aee36c95 candidate; the follow-up adds authorization
regressions and dependency fixes without changing production.

## Source and scope

These changes build on verified fix commit b5dfa08397ada9681f3985db6df6c90865880691.
They preserve its strict expense save/delete acknowledgements, retry identities,
sanitized Gemini errors, lazy provider configuration, and disabled reset endpoint.

The former browser PIN did not authorize server requests. The new frontend uses
Supabase email-link sign-in with PKCE and existing-account-only requests. FastAPI
verifies each bearer token through the project's Auth service, then requires a
confirmed, nonanonymous email in a server-owned email-to-profile allowlist.
Editable user metadata and browser profile selection never grant access. All
financial and AI routes require this identity. Household members share household
records; profile IDs label family activity rather than separate tenants.

The frontend waits for `/api/auth/me` before mounting financial pages, attaches
bearer tokens to API calls, and cancels pending authorization on logout or denial.
API authentication failures cannot become successful offline saves. Financial
API responses no longer use service-worker caches. Existing `fft_data` storage is
preserved; new installations start empty rather than embedding seeded household
records or login PINs. Hardcoded financial threshold notes were removed.

## Required configuration (names only)

Existing backend names: `SUPABASE_DATABASE_URL`, `GEMINI_API_KEY`, `FRONTEND_URL`.
Additional backend names: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`,
`FAMILY_EMAIL_PROFILES` (a JSON object mapping enrolled emails to existing profiles).

Frontend build names: `VITE_API_URL`, `VITE_SUPABASE_URL`,
`VITE_SUPABASE_PUBLISHABLE_KEY`. Only a modern public publishable key belongs in
the frontend; never use a database URL, service-role key, or Supabase secret key.

The supplied family email is intended to map to `nithish`. A read-only enrollment
check found no corresponding Supabase Auth user. The administrator must enroll
the account in this project's Authentication dashboard, verify email delivery,
and allow the existing Netlify origin's `/` callback in Auth URL configuration.
No invitations, login emails, account creation, or password changes were performed.

## Production blockers

1. The existing Netlify site cannot currently be accessed by the user in the
   available browser. Its exact deployed SHA, settings and publishing permissions
   remain unverified. Do not switch the backend to mandatory sign-in while this
   older frontend still cannot send bearer tokens.
2. Supabase metadata and its security advisor confirm all 13 public application
   tables have RLS disabled, with SELECT and INSERT privileges for `anon` and
   SELECT for `authenticated`. Backend authentication alone does not close this
   separate Data API exposure. No household rows were queried to prove it.
   `security/lockdown_data_api.sql` is a review-only access-control script. It has
   NOT been applied because production migrations were prohibited. Before any
   authorized application, verify the deployed backend database role is the
   table owner or has BYPASSRLS. The script changes permissions, not records.
3. The approved email needs enrollment, redirect configuration and a real sign-in
   verification before authenticated production workflows can be exercised.
4. Dependency audit reports 18 affected packages (13 high, 5 moderate), including
   development tools and React Router. No forced major dependency upgrades were
   performed in this coordinated auth change. This is not a clean security audit.

RLS advisor guidance:
https://supabase.com/docs/guides/database/database-linter?lint=0013_rls_disabled_in_public

## Validation

Backend: `.venv/Scripts/python.exe -I -B -m unittest discover -s backend/tests -v`:
28 passed, 0 failed, 0 skipped. Uses synthetic identities, mocked Auth/Gemini,
and isolated expense databases. `pip check` passes. A trial `pytest` invocation
could not run because pytest is not installed; the repository uses unittest.

Frontend: `npm test`: 137 passed, 0 failed, 0 skipped. `npm run build` passes. The
production build emits an existing bundle-size warning (about 1 MB after adding
Supabase Auth). Security audit returns nonzero for the 18 findings above.

Live production remains on Vercel commit
175c0b7bf6fc968afed583739e46bcd324b42f3e, deployment
dpl_nWwEL7aAYj94vNchXeja2wgKu9RR (READY), branch main. Vercel access is working
for the existing team/project. `/health` returned connected; `/` is an expected
FastAPI 404. The public frontend and its expense route returned HTTP 200. These
checks do not verify authenticated creation, deletion, or failure handling in
production. No destructive production tests or real household AI submissions
were performed. Frontend production is still the existing Netlify site.

Frontend: https://scintillating-donut-a597ff.netlify.app/
Backend: https://family-finance-tracker-pearl.vercel.app/

Do not promote a backend preview until the frontend, Auth configuration, database
access protections and safe end-to-end validation can be completed together.
