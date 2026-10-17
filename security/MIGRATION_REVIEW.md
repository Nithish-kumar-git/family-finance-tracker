# Review of lockdown_data_api.sql

**Not applied. Conditionally appropriate, not yet cleared for production.**
The backend effective role remains UNVERIFIED. Review baseline is the existing
13-table catalog evidence recorded in `RELEASE_READINESS.md`; this review did
not change or query production records. Recheck metadata immediately before an
approved change because policies, grants and role membership can change.

## Scope and statement effects

The explicit table list is `users`, `expenses`, `budgets`, `fixed_deposits`,
`mutual_funds`, `lic_policies`, `chit_funds`, `gold`, `emergency_fund`,
`monthly_income`, `milestones`, `job_applications`, `monthly_snapshots`.
Every listed table currently has RLS disabled, no policies, and explicit ALL
grants to both anon and authenticated. PUBLIC is an implicit group of every
role; revoking it also removes access otherwise inherited by backend roles.

| Statement | Effect and application impact |
| --- | --- |
| BEGIN / COMMIT | One atomic permission/DDL change; no application row modification. A failed statement aborts the transaction. The operator must stop on error and roll back/close rather than continue manually. |
| SET LOCAL lock_timeout = 5s | Bounds time waiting for each lock. ALTER TABLE ENABLE RLS requires an exclusive table lock and can briefly block concurrent requests; this is not a zero-downtime guarantee. |
| SET LOCAL statement_timeout = 30s | Bounds each statement, not the entire script. Settings expire with the transaction. A timeout aborts the change. |
| ALTER TABLE ... ENABLE ROW LEVEL SECURITY (13 statements) | Applies row checks to ordinary roles. With no policies, ordinary roles see zero rows and cannot insert; updates/deletes find no eligible rows. Owners normally bypass because FORCE is not enabled; BYPASSRLS also bypasses. |
| REVOKE ALL ... FROM PUBLIC, anon, authenticated | Removes all table privileges available through these direct grants. The backend must retain an independent authorized access path. Schema USAGE alone does not grant table access. |

On the confirmed PostgreSQL 18 catalog, ALL comprises:

| Privilege removed | What is blocked through these grants |
| --- | --- |
| SELECT | Reading table rows. |
| INSERT | Adding rows. |
| UPDATE | Changing rows. |
| DELETE | Deleting rows. |
| TRUNCATE | Emptying whole tables; RLS alone does not protect this operation. |
| REFERENCES | Creating foreign-key references; RLS does not govern this privilege. |
| TRIGGER | Creating triggers. |
| MAINTAIN | Table maintenance operations, subject to each command's other restrictions. |

This is **not** a CREATE POLICY migration. No browser policy is needed because
this frontend uses Supabase Auth only; financial requests go to authenticated
FastAPI. Adding `TO authenticated USING (true)` would authorize every Supabase
account, bypassing the server's family allowlist. No broad policy is added.
No FORCE RLS, role creation, ownership change, schema revoke, sequence/function
revoke, external dependency change, seed, data migration or service_role revoke
is included. Independent privileged roles, owners and service keys remain
sensitive. Existing views/functions or other grants must be checked separately;
the previous metadata check found no public views or SECURITY DEFINER functions.

The commented ALTER DEFAULT PRIVILEGES is **not executed**. It would affect
future tables created by postgres, not existing tables or objects created by
other roles. Current postgres and supabase_admin defaults can expose newly
created tables again. Those defaults require a separate approved change; this
script alone is not permanent protection for future schema additions.

## Role dependencies and shared-household compatibility

The migration requires the named roles and tables to exist and an authorized
operator executing as the actual table owner/grantor (`postgres` in the reviewed
catalog). REVOKE is grantor-specific: a generic "admin" label or ambiguous role
membership is insufficient, and may leave grants intact. Verify the execution
identity and resulting ACL metadata rather than relying on a success message.
This is separate from verifying the application's effective connection role.
Unexpected grant dependencies can make REVOKE fail
under its default RESTRICT behavior; do not add CASCADE to force it through.

Backend access must pass **both** checks after revocation:

1. Database connection/schema USAGE and required table CRUD privileges survive,
   independently of PUBLIC/anon/authenticated. BYPASSRLS grants no CRUD rights.
2. The effective role owns the tables (without FORCE), has BYPASSRLS, or has a
   separately reviewed role-specific policy. The current script adds no policy.

If the backend is an ordinary separately granted role, it will lose row access.
If it has BYPASSRLS but relies only on revoked grants, queries fail permission
checks. Neither scenario is safe to release. Confirm the role using
`VERIFY_BACKEND_ROLE.md`, inspect its grant paths, and rehearse them locally.
Do not add a broad browser policy to repair a backend outage.

The approved model is one shared household per dedicated database. Approved
members may view/change each other's expenses; `userId` records attribution,
not an ownership boundary. There are no family/tenant columns. This migration
preserves that model **if backend access survives**. It does not implement
multi-family row isolation. Expanding the allowlist to another household would
require a separately approved data-model change.

Production FastAPI still runs the old unauthenticated commit 175c0b7. Closing
the Data API does not secure that independent API path. Coordinate the guarded
backend and matching frontend release after the remaining checks; do not call
production secure merely because RLS was enabled.

## Local regression evidence and limits

`security/tests` runs the exact script against ephemeral PGlite PostgreSQL
18.6 with synthetic tables, rows and roles. It never reads env files or opens
a network/database connection. Install with `npm ci --ignore-scripts`, then
`npm test` from that directory. This dependency is isolated from application
runtime and frontend build dependencies.

Tests cover all 13 tables, all eight table privileges, anon/authenticated CRUD
and TRUNCATE denial, unchanged synthetic rows, non-superuser owner access,
independently granted BYPASSRLS/service-role CRUD, both unsafe backend-role
scenarios, and atomic rollback on a mid-script missing-table error.
The full migration/denial test executes as the non-superuser table owner,
not only as the fixture's bootstrap superuser.
This rehearses SQL semantics, **not** the deployed role, Supabase pooler,
production lock contention, or authenticated live UI workflows.

Before an explicitly approved application: verify role/grant paths and external
Data API consumers, capture permission/policy metadata for a reviewed recovery
plan, rehearse the actual role in isolation, and choose a maintenance window.
Do not blindly reverse RLS or restore anonymous ALL privileges after an error.
Disabling the unused Supabase Data API is another containment option requiring
explicit configuration approval; it is not performed by this script.

References:
- https://www.postgresql.org/docs/current/ddl-rowsecurity.html
- https://www.postgresql.org/docs/current/sql-revoke.html
- https://supabase.com/docs/guides/api/securing-your-api
- https://pglite.dev/docs/api
