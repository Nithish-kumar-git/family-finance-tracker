-- REVIEW ONLY: not applied. No records are inserted, changed, or deleted.
-- This application accesses financial tables through its authenticated FastAPI
-- server. Browser Supabase credentials are for Auth, never for the Data API.
-- Before applying, verify the deployed SQLAlchemy database role owns these
-- tables or has BYPASSRLS. Do not use FORCE ROW LEVEL SECURITY here.
-- Existing Data API consumers using anon/authenticated would lose access.
BEGIN;
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
FROM anon, authenticated;
COMMIT;
