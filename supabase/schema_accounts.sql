CREATE TABLE IF NOT EXISTS public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  district_id UUID NOT NULL REFERENCES public.districts(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (btrim(name) <> ''),
  code TEXT,
  type TEXT NOT NULL CHECK (type IN ('cash', 'bank', 'mobile_money', 'petty_cash')),
  currency public.currency_code NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (code IS NULL OR btrim(code) <> '')
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_district_name_unique
  ON public.accounts (district_id, lower(name));
CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_district_code_unique
  ON public.accounts (district_id, lower(code))
  WHERE code IS NOT NULL AND btrim(code) <> '';
CREATE INDEX IF NOT EXISTS idx_accounts_district ON public.accounts(district_id);
CREATE INDEX IF NOT EXISTS idx_accounts_district_status ON public.accounts(district_id, status);

DROP TRIGGER IF EXISTS trg_accounts_updated_at ON public.accounts;
CREATE TRIGGER trg_accounts_updated_at
  BEFORE UPDATE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_manage_accounts" ON public.accounts;
DROP POLICY IF EXISTS "district_manage_own_accounts" ON public.accounts;
CREATE POLICY "admin_manage_accounts" ON public.accounts
  FOR ALL USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());
CREATE POLICY "district_manage_own_accounts" ON public.accounts
  FOR ALL
  USING (district_id = public.current_district_id())
  WITH CHECK (district_id = public.current_district_id());
