# Authenticated preview verification — pending execution

No authenticated live workflow is marked passed in this document. Existing
local tests use mocked identities and synthetic SQLite/PostgreSQL data. They
do not establish that deployed sign-in or database permissions work.

## Required access and isolation

The existing backend preview was last verified at aee36c95; the local follow-up
source is newer. Its database setting was shared with production. On this
review, the provider returned no development branches for the Supabase project.
Do not write to that preview, even with synthetic data, until isolation has been
verified. Do not copy household rows into a test database.

An authorized operator must provide, through approved private configuration:

1. An empty, separate preview PostgreSQL database or branch with the application's
   schema and synthetic data only. Record its nonsecret project/branch identity
   and confirm the preview's database setting references it, independently of
   the production setting. A different hostname alone is not sufficient proof
   when poolers or database aliases are involved. Provisioning/schema setup and
   preview environment changes require separate authorization; none are done
   by this runbook.
2. A test role/grant arrangement matching the verified backend connection, with
   the proposed lockdown rehearsed there under an approved owner identity.
   Confirm authorized backend CRUD survives and Data API roles are denied.
   The production role is still UNVERIFIED; follow VERIFY_BACKEND_ROLE.md.
3. An enrolled, confirmed test account at an operator-controlled test mailbox,
   mapped to nithish in the preview's server-side FAMILY_EMAIL_PROFILES, plus
   an enrolled outsider account in the same preview Auth project which is
   absent from that allowlist. The sign-in UI uses shouldCreateUser:false;
   entering a new email does not enroll it. Do not invite/create accounts or
   send email without authorization. Sign in through the normal private
   browser flow; do not paste passwords, email links or access/refresh tokens
   into chat, commands, screenshots, test fixtures or logs.
4. Permission for a later deployment of the committed candidate to the existing
   Vercel preview and a matching Netlify preview, with their source SHAs recorded.
   Existing Vercel deployment protection must remain enabled. Access to the
   existing Netlify project's owning team is needed (Owner or Developer with
   this project assigned); no replacement project or transfer is required.

Names to configure and verify without revealing values:

- Backend preview: SUPABASE_DATABASE_URL, SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY, FAMILY_EMAIL_PROFILES, FRONTEND_URL;
  GEMINI_API_KEY only when approved synthetic provider testing is required.
- Frontend preview: VITE_API_URL, VITE_SUPABASE_URL,
  VITE_SUPABASE_PUBLISHABLE_KEY. Use the matching Auth project; never a service
  key or database connection string. Auth callback allowlists and FRONTEND_URL
  must allow the actual preview frontend origin.

These are release prerequisites, not permission to change production or preview
configuration now. An authorized operator must attest isolation before any
write test. If any prerequisite is missing, record BLOCKED and stop that test.

## Synthetic fixture and evidence rules

Create a fresh random UUID for each test run and name records
`security-preview-<run UUID>-<case>`. Use amount 1, category other, date
2099-01-01, userId mother and description `Synthetic release verification`.
Do not use existing IDs or enumerate real records. In an empty isolated test
database, list only the synthetic month 2099-01. Record status codes, row counts
and synthetic IDs; do not export Authorization headers, cookies, Auth responses,
environment values, HAR files or raw provider errors.

## Ordered checks and expected observations

| Check | Action after all prerequisites pass | Evidence required |
| --- | --- | --- |
| Source and connectivity | Record both deployed candidate SHAs. Load the preview frontend; request backend health. | Matching SHAs, page renders, health reports database connected. Health alone does not prove role or authorization. |
| Sign-in | Use the enrolled approved test mailbox and complete the email flow. | /api/auth/me returns 200 with profileId nithish; protected pages load. No token recorded. |
| Rejected identities | In a private test client, omit a token, send an obviously forged test string, then use the real outsider session with a guessed synthetic expense ID/profile/family parameter. | Missing/forged return 401; valid outsider returns 403, including list/create/delete and bulk routes. No data is returned or modified. A forged token is not an expired signed-token test. |
| Expiry | With a separately obtained genuinely expired test session, attempt a protected request without allowing automatic refresh. | 401. If no expired signed token can be obtained safely, record BLOCKED; do not change project-wide expiry to manufacture one. |
| Save acknowledgement | In the preview browser, submit one synthetic expense and delay its response using a test transport. | Pending UI until the server's 201 includes the expected ID; exactly one synthetic database row after acknowledgement. |
| Duplicate submissions | Rapidly activate Save while that first request is pending. Then repeat the identical API submission ID/payload in the isolated test client. | One in-flight UI submission; repeated identical API request returns the same ID; list/count still shows one row. A changed payload using that ID returns 409. |
| Failed save and draft | Block only expense requests in the browser after sign-in, submit a new synthetic draft, then restore connectivity and retry. | Actionable error, draft fields remain, no saved badge before acknowledgement, successful retry produces exactly one row. Also verify a controlled synthetic HTTP 500 and mismatched acknowledgement with preview-only interception. Label those responses as simulated. |
| Failed deletion | For a known synthetic row, block its delete request; separately simulate HTTP 500 and 200 with deleted:false. | Row remains visible with an error. After restoring connectivity, read the isolated database/API and confirm the real row remains. Simulated failure checks are frontend evidence, not real backend fault tests. |
| Successful deletion | Delete only the known row created by this run. | Server returns deleted:true and the row disappears. Repeating that delete returns 404 and is not shown as a new success. |
| Shared household | While signed in as nithish, view/manage the synthetic expense attributed to mother. | Access succeeds by design. An outsider changing userId to mother remains denied. No separate-family data model is claimed. |
| AI error UI | Intercept only a synthetic chat response with the documented retryable AI_RATE_LIMITED error and HTTP 429; repeat with nonretryable AI_NOT_CONFIGURED/503. | Meaningful message, retry behavior matches retryable; no draft loss or exception details. Mark this as simulated UI evidence. |
| Actual provider failure | Only with separately approved preview-only fault setup, send synthetic text and empty synthetic context through the backend. | Backend returns sanitized typed code/message/retryable. If no safe setup exists, record BLOCKED and retain local mocked-provider evidence; do not break production credentials or intentionally exhaust provider quota. |
| Reset | After isolation is confirmed, request reset with and without an approved identity/confirmation header. | Always 403; synthetic records remain. Never perform this check against the old production backend. |
| Sign-out | Sign out while access verification is pending; revisit a protected route. | Sign-in gate appears and a stale verification response cannot reopen it. |

Cleanup is limited to specific synthetic IDs recorded for this run, in the
verified isolated database. Do not use reset, bulk deletion or truncate as
cleanup. Keep a result table with PASS/FAIL/BLOCKED, deployed SHA and evidence
type (live backend, simulated frontend, or local regression). Do not convert a
local/simulated result into a live result.
