# Security release readiness — 17 October 2026

Production changes: none. No SQL applied, records written/deleted, credentials
reset, accounts enrolled, invitations sent, or production deployments promoted.
The six existing untracked notes and `portfolio/` remain outside the change.

## Database evidence and minimum containment

All 13 tables below are owned by `postgres`, have RLS disabled, and have zero
policies. Explicit grants from `postgres` give both `anon` and `authenticated`
SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER and MAINTAIN.
Both roles have public-schema USAGE. Neither role inherits a privileged role.
The `authenticator` role can switch to anon/authenticated/service_role for Data
API requests; `anon` and `authenticated` themselves cannot log in to PostgreSQL.

| Public table | RLS | Anonymous/authenticated table grants |
| --- | --- | --- |
| users | Off | All eight privileges above |
| expenses | Off | All eight privileges above |
| budgets | Off | All eight privileges above |
| fixed_deposits | Off | All eight privileges above |
| mutual_funds | Off | All eight privileges above |
| lic_policies | Off | All eight privileges above |
| chit_funds | Off | All eight privileges above |
| gold | Off | All eight privileges above |
| emergency_fund | Off | All eight privileges above |
| monthly_income | Off | All eight privileges above |
| milestones | Off | All eight privileges above |
| job_applications | Off | All eight privileges above |
| monthly_snapshots | Off | All eight privileges above |

Confirmed the REST path independently: anonymous requests using the project's
public publishable key to each `/rest/v1/<table>?select=id&limit=0` returned HTTP
200 and an empty array. The limit prevented household records being returned.
SQL metadata proves the privileges and absence of row restrictions; no write,
truncate, or positive-row read was attempted. No public views or public
SECURITY DEFINER functions were found in the metadata check.

The frontend's Supabase client calls Auth only. All financial API operations use
FastAPI, which uses SQLAlchemy with `SUPABASE_DATABASE_URL` and direct Postgres
drivers. No frontend `.from`, `.rpc`, REST/GraphQL database calls, Realtime or
Storage usage was found. The direct Data API is unnecessary for this repo.

Minimum immediate containment, subject to explicit approval and confirmation
that no external consumers need the Data API: disable Data API in Supabase's
Data API integration overview. That closes the REST data path without altering
records or the SQL connection. Auth uses its separate Auth API and must still
be checked through an enrolled account before release.

The prepared SQL alternative/defense in depth is `lockdown_data_api.sql`:
enable RLS on the 13 tables and revoke table grants from PUBLIC, anon and
authenticated, while retaining owner/service-role privileges. It adds bounded
lock/statement timeouts and no broad authenticated policy. It is NOT APPLIED.
Default grants from postgres and supabase_admin also expose future tables;
future-default hardening is documented separately in SQL comments for review.

Guidance: https://supabase.com/docs/guides/api/securing-your-api
RLS advisor: https://supabase.com/docs/guides/database/database-linter?lint=0013_rls_disabled_in_public

## Backend role: confirmed facts and unresolved access

The local backend connection configuration names `postgres` for this project.
The database catalog confirms postgres owns all 13 tables and has BYPASSRLS,
CREATEROLE and CREATEDB; it is not a superuser. Such a connection has elevated
privileges and does not gain per-family protection from RLS. All application
authorization must be correct before its queries execute.

The local connection attempt failed authentication. No credential was changed.
The existing Vercel setting is sensitive; its inspection returns metadata with
`decrypted:false` and no value. Consequently the actual deployed login/effective
role is NOT confirmed. Do not equate the connector's mgmt-api role or the local
configured username with proof of the deployed role.

`check_backend_role.py` runs SELECT-only catalog queries in a read-only
transaction using the backend's actual environment. It reports login/effective
roles, BYPASSRLS and each CRUD privilege without printing credentials. The owner
must confirm the deployed role using the original connection configuration or
run this check in that environment before applying the prepared RLS script.
A dedicated backend role with only required permissions is preferable as a
separate approved change; no production roles or grants were changed here.

## Authorization and test evidence

The user explicitly confirmed shared-household access. Profiles mother, nithish
and abeerami are shared-family activity labels, not isolated families. The entire
configured database is the household boundary. No tenant/household scope column
exists. There is no per-user row isolation and no multi-family tenancy support;
do not store another family's records in this database or extend the email
allowlist to another household. Shared family members may view/manage one
another's household records, as requested.

FastAPI calls this project's `/auth/v1/user` for supplied bearer tokens and
requires a confirmed nonanonymous user in a server-owned email/profile map.
Editable metadata and supplied IDs do not confer access. Every financial/AI
operation includes this dependency. Reset always denies access before acquiring
a DB, including for an approved family member.

Added complete-app HTTP regressions showing an authenticated outsider cannot
reach any protected operation by changing profile, record, family, header or
metadata IDs. Invalid/expired-provider responses deny every protected operation
before a database is acquired. Synthetic SQLite HTTP checks cover shared-family
save acknowledgements, retry deduplication, deletion/missing deletion, reset
denial and retryable sanitized AI failures. Fixed a malformed Auth URL previously
raising an internal configuration exception; it now gives a sanitized 503.

- Backend: 34 passed, 0 failed, 0 skipped.
- Frontend: 139 passed, 0 failed, 0 skipped, including existing draft-preservation,
  duplicate-submit and deletion-error tests and new actual-router gate tests.
- Production build: passes with Vite 6.4.3 / PWA 0.21.2 and service-worker
  generation. Bundle-size warning remains (approximately 1.04 MB JS).
- Local final browser build: `/expenses` redirects to `/`, family email form
  renders, missing configuration is actionable, and no console errors appeared.
- Dependency audit: 5 high / 2 moderate remain, all build-only; production-only
  audit zero. See `dependency_review.md` for all original packages and versions.

## Live preview: what was and was not tested

Existing preview is READY at commit
`aee36c95e34d2b5e596cc36a3ab80806a55735b2`, deployment
`dpl_9GBa1UEvhnGSQJYhq2Afxeu2hgGc`:
https://family-finance-tracker-1bj9p2xo5-nithish-kumar-gits-projects.vercel.app

The authorized temporary Vercel link was used only to initialize a memory cookie
jar. Subsequent direct `/api/auth/me` requests with missing and forged synthetic
tokens each returned application HTTP 401 / AUTH_REQUIRED. This resolves the
earlier connector ambiguity about whether the 401 came from deployment
protection. No keys, cookies or access links were printed; temporary files were
deleted. The preview was not replaced or promoted by this follow-up.

The approved email is still not enrolled. No authenticated test account/session
is available. Also, preview and production inherit the same single database
connection variable. Therefore no live save/delete, draft-recovery, duplicate
submission, AI failure or signed-in cross-user workflow is claimed verified.
Real expired signed-token behavior also remains untested live; local tests
simulate rejection by Supabase. No test user was created and no provider request
containing real household data was sent.

## Frontend blocker and required release sequence

The existing Netlify configuration URL still shows Log in:
https://app.netlify.com/projects/scintillating-donut-a597ff/configuration/deploys
No connected Netlify plugin was found. Actual repo, production branch, base,
build/output settings, deployed SHA and environment values cannot be inspected
behind that login. The owner must sign in to that site's existing owning team,
with Owner or Developer access to this specific project. A Reviewer or Git
Contributor alone cannot edit project configuration/environment variables.
https://docs.netlify.com/manage/accounts-and-billing/team-management/roles-and-permissions/

Expected source-derived build configuration to compare against the dashboard:
base `familyfinancetracker`, `npm run build`, output `dist`, SPA fallback from
`public/_redirects`. Node 22 is declared in the candidate. These are expected
settings, not verified remote settings. Do not transfer or recreate the site.

Required variable names:
- Backend: SUPABASE_DATABASE_URL, GEMINI_API_KEY, FRONTEND_URL, SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY, FAMILY_EMAIL_PROFILES.
- Frontend build: VITE_API_URL, VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY.

Vercel inspection confirms the three Auth names exist for preview only; production
still has only the original database, Gemini and frontend-origin names. Netlify
must use the same Supabase project and a public publishable key, never an admin
key. FRONTEND_URL and Supabase Auth callback allowlists must match the actual
approved frontend origin. Do not put any server key or connection URL in VITE_*.

Release steps in order:
1. Confirm the deployed backend role, and explicitly approve minimum database
   access containment; verify anonymous zero-row probes are then denied and
   authorized SQL connectivity is retained. No SQL approval is implied here.
2. Provide an isolated preview database and enrolled synthetic Auth test user;
   stop inheriting the production DB for write tests. Configure Auth callbacks
   and email delivery without sending secrets through chat.
3. Deploy the final tested candidate to the existing preview configuration and
   run the authenticated UI/API workflows against that isolated data store.
4. Restore Netlify access and verify its actual configuration. Build/deploy the
   matching candidate frontend to that existing site's preview and complete
   browser sign-in/save/failure/delete checks with the isolated backend.
5. Address or explicitly assess the remaining build-tool findings, configure
   production Auth names, enroll approved family accounts, verify release SHA
   on both services, and coordinate production release only after authorization.

Production backend remains at commit
`175c0b7bf6fc968afed583739e46bcd324b42f3e`. No promotion is authorized by this
verification work. Production frontend SHA remains unknown.
