# Read-only effective-role verification

Status: **UNVERIFIED**. Neither table ownership, the local URL's username,
the Supabase management connection, nor a successful health check establishes
the deployed FastAPI connection's effective role. Existing source does not log
the role. The prior bounded runtime-log search found no role entry.

## Minimum operator procedure

An authorized operator needs a private SQL client connection configured from
the **exact existing Vercel backend database login**, including its connection
options, database, endpoint/pooler and SSL requirements. Use the original
approved secret source or an already configured private connection. Do not
retrieve or send any secret through this chat, command-line arguments, logs,
screenshots or a repository file. Do not change the Vercel setting.

1. Select that saved backend connection. Do not use the Supabase dashboard SQL
   editor's management/admin connection as a substitute. Do not use `SET ROLE`,
   a different login, or the rejected local configuration.
2. Use a query-only client without automatic schema discovery or connection
   diagnostics, and avoid exporting its session. Keep required organizational
   audit logging enabled; this query contains no credentials. Execute only:

   ```sql
   SELECT current_user;
   ```

3. Record only the resulting role name, then disconnect. The query reads no
   application rows and makes no data or permission changes. Do not run the
   migration or test writes as part of this check.

If a secure libpq connection service is already configured for that exact
backend login, a terminal alternative is:

```powershell
psql -X -qAt --dbname=service=fft_backend_verified -v ON_ERROR_STOP=1 -c "SELECT current_user;"
```

`fft_backend_verified` is an operator-created local service alias, **not an
existing project setting**. Do not create an alias using guessed credentials.
`-X` avoids startup commands from a psql configuration file. Never paste a DSN
or password into this command. If no saved authorized connection is available,
stop and retain **UNVERIFIED**; request access to that exact login through the
organization's secret-management/access process, not through chat.

## What this establishes and what it does not

Source inspection shows `backend/database.py` passes `SUPABASE_DATABASE_URL`
directly to SQLAlchemy `create_engine(..., pool_pre_ping=True)` and binds each
request's `SessionLocal` to it. No application `SET ROLE` exists. Both psycopg2
and psycopg 3 are installed; the URL selects the driver. The deployed driver
and effective role cannot be inferred from installed packages alone.

The query establishes only the effective role for the exact connection used.
If the deployed runtime has role-changing connection options or external
middleware, those must match; a generic new admin connection is insufficient.
There is no currently available authorized execution tool bound to the
existing deployed SQLAlchemy connection. No diagnostic endpoint is proposed.

Before approving the migration, separately inspect catalog metadata for the
verified role: schema USAGE, table ownership/BYPASSRLS and **independent CRUD
privileges that survive the proposed revocation**, including inherited grants.
Do not infer these permissions from the role name. The optional existing
`check_backend_role.py` performs broader metadata inspection, not this minimal
one-query procedure, and is not proof of deployment identity when run locally.
Rehearse the actual role/grants in an isolated database before production.
