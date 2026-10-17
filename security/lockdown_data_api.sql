-- REVIEW ONLY: not applied. No records are inserted, changed, or deleted.
-- This application accesses financial tables through its authenticated FastAPI
-- server. Browser Supabase credentials are for Auth, never for the Data API.
-- Before applying, verify the deployed SQLAlchemy database role owns these
-- tables or has BYPASSRLS. Do not use FORCE ROW LEVEL SECURITY here.
-- Existing Data API consumers using anon/authenticated would lose access.
-- Verified 2026-10-17: all 13 tables are owned by postgres, have RLS off,
-- no policies, and ALL table privileges granted to anon/authenticated.
-- Local backend configuration names postgres (BYPASSRLS); the deployed
-- connection role still needs confirmation because Vercel hides sensitive envs.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fixed_deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mutual_funds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lic_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chit_funds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gold ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emergency_fund ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_income ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_snapshots ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.users, public.expenses, public.budgets,
  public.fixed_deposits, public.mutual_funds, public.lic_policies,
  public.chit_funds, public.gold, public.emergency_fund, public.monthly_income,
  public.milestones, public.job_applications, public.monthly_snapshots
FROM PUBLIC, anon, authenticated;
COMMIT;

-- Do not add a broad authenticated policy: family authorization is enforced
-- by FastAPI and the browser does not use this Data API.
-- Default public-schema grants also expose future postgres-created tables.
-- Review separately after explicit approval; not part of this transaction:
-- ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
--   REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;
-- Supabase_admin also has public-table default grants; have the project
-- administrator assess those managed-role defaults separately.
