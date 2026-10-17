// No network, environment variables, connection strings or household records.
// Run the exact proposed migration only inside an ephemeral WASM PostgreSQL.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { PGlite } from '@electric-sql/pglite'

const migration = await readFile(new URL('../lockdown_data_api.sql', import.meta.url), 'utf8')
const tables = ['users', 'expenses', 'budgets', 'fixed_deposits', 'mutual_funds',
  'lic_policies', 'chit_funds', 'gold', 'emergency_fund', 'monthly_income',
  'milestones', 'job_applications', 'monthly_snapshots']

async function fixture(t) {
  const db = await PGlite.create('memory://')
  t.after(() => db.close())
  await db.exec(`
    CREATE ROLE anon;
    CREATE ROLE authenticated;
    CREATE ROLE service_role BYPASSRLS;
    CREATE ROLE backend_bypass BYPASSRLS;
    CREATE ROLE backend_limited;
    CREATE ROLE backend_inherited BYPASSRLS;
    CREATE ROLE backend_no_grants BYPASSRLS;
    CREATE ROLE table_owner NOSUPERUSER NOBYPASSRLS;
    GRANT anon TO backend_inherited;
    GRANT USAGE ON SCHEMA public TO PUBLIC;
    ${tables.map(table => `
      CREATE TABLE public.${table} (id text PRIMARY KEY, value integer NOT NULL);
      INSERT INTO public.${table} VALUES ('synthetic-shared', 1);
      GRANT ALL ON public.${table} TO PUBLIC, anon, authenticated;
      GRANT SELECT, INSERT, UPDATE, DELETE ON public.${table}
        TO backend_bypass, backend_limited, service_role;
      ALTER TABLE public.${table} OWNER TO table_owner;
    `).join('')}
  `)
  return db
}

async function asRole(db, role, action) {
  // Role names below are fixed test constants, never externally supplied.
  await db.exec(`SET ROLE ${role}`)
  try { return await action() }
  finally { await db.exec('RESET ROLE') }
}

test('migration revokes all browser privileges on all 13 tables without changing rows', async t => {
  const db = await fixture(t)
  await asRole(db, 'anon', async () => {
    assert.equal((await db.query('SELECT * FROM public.expenses')).rows.length, 1)
  })
  await asRole(db, 'table_owner', () => db.exec(migration))
  const metadata = (await db.query(`
    SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity,
      (SELECT count(*)::int FROM pg_policy p WHERE p.polrelid=c.oid) AS policies
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind='r' ORDER BY c.relname
  `)).rows
  assert.equal(metadata.length, 13)
  for (const row of metadata) {
    assert.equal(row.relrowsecurity, true)
    assert.equal(row.relforcerowsecurity, false)
    assert.equal(row.policies, 0)
  }
  for (const table of tables) {
    assert.deepEqual((await db.query(`SELECT * FROM public.${table}`)).rows,
      [{ id: 'synthetic-shared', value: 1 }])
    for (const role of ['anon', 'authenticated']) {
      await asRole(db, role, async () => {
        for (const statement of [
          `SELECT * FROM public.${table}`,
          `INSERT INTO public.${table} VALUES ('denied', 2)`,
          `UPDATE public.${table} SET value=2`,
          `DELETE FROM public.${table}`,
          `TRUNCATE public.${table}`,
        ]) await assert.rejects(db.query(statement), { code: '42501' })
      })
      const grants = (await db.query(`
        SELECT privilege FROM unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE',
          'TRUNCATE','REFERENCES','TRIGGER','MAINTAIN']) privilege
        WHERE has_table_privilege($1, $2, privilege)
      `, [role, `public.${table}`])).rows
      assert.deepEqual(grants, [])
    }
  }
})

test('non-superuser owner and independently granted BYPASSRLS roles retain shared-household CRUD', async t => {
  const db = await fixture(t)
  await db.exec(migration)
  for (const role of ['table_owner', 'backend_bypass', 'service_role']) {
    await asRole(db, role, async () => {
      for (const table of tables) {
        assert.equal((await db.query(`SELECT * FROM public.${table}`)).rows.length, 1)
        await db.query(`INSERT INTO public.${table} VALUES ('synthetic-write', 2)`)
        assert.equal((await db.query(`UPDATE public.${table} SET value=3 WHERE id='synthetic-write'`)).affectedRows, 1)
        assert.equal((await db.query(`DELETE FROM public.${table} WHERE id='synthetic-write'`)).affectedRows, 1)
      }
    })
  }
})

test('ordinary backend role with CRUD but no policy loses row access', async t => {
  const db = await fixture(t)
  await db.exec(migration)
  await asRole(db, 'backend_limited', async () => {
    assert.deepEqual((await db.query('SELECT * FROM public.expenses')).rows, [])
    await assert.rejects(db.query("INSERT INTO public.expenses VALUES ('denied', 2)"), { code: '42501' })
    assert.equal((await db.query('UPDATE public.expenses SET value=2')).affectedRows, 0)
    assert.equal((await db.query('DELETE FROM public.expenses')).affectedRows, 0)
  })
})

test('BYPASSRLS alone or grants inherited from revoked roles cannot preserve backend access', async t => {
  const db = await fixture(t)
  await db.exec(migration)
  for (const role of ['backend_no_grants', 'backend_inherited']) {
    await asRole(db, role, async () => {
      await assert.rejects(db.query('SELECT * FROM public.expenses'), { code: '42501' })
    })
  }
})

test('a mid-migration missing-table error rolls back preceding RLS changes and revocation', async t => {
  const db = await fixture(t)
  await db.exec('DROP TABLE public.monthly_snapshots')
  await assert.rejects(db.exec(migration), { code: '42P01' })
  await db.exec('ROLLBACK')
  assert.equal((await db.query("SELECT relrowsecurity FROM pg_class WHERE oid='public.expenses'::regclass")).rows[0].relrowsecurity, false)
  await asRole(db, 'anon', async () => {
    assert.equal((await db.query('SELECT * FROM public.expenses')).rows.length, 1)
  })
})
