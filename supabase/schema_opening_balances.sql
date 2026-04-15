-- Reference copy — see supabase/migrations/20260415030000_add_opening_balances.sql for history

CREATE TABLE IF NOT EXISTS public.account_opening_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  district_id UUID NOT NULL REFERENCES public.districts(id) ON DELETE CASCADE,
  effective_date DATE NOT NULL,
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  currency public.currency_code NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (account_id, effective_date)
);

CREATE INDEX IF NOT EXISTS idx_opening_balances_account
  ON public.account_opening_balances(account_id);
CREATE INDEX IF NOT EXISTS idx_opening_balances_district
  ON public.account_opening_balances(district_id);
CREATE INDEX IF NOT EXISTS idx_opening_balances_account_date
  ON public.account_opening_balances(account_id, effective_date DESC);

DROP TRIGGER IF EXISTS trg_opening_balances_updated_at ON public.account_opening_balances;
CREATE TRIGGER trg_opening_balances_updated_at
  BEFORE UPDATE ON public.account_opening_balances
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.validate_opening_balance_currency()
RETURNS TRIGGER AS $$
DECLARE
  account_currency public.currency_code;
  account_district_id UUID;
BEGIN
  SELECT currency, district_id
  INTO account_currency, account_district_id
  FROM public.accounts
  WHERE id = NEW.account_id;

  IF account_currency IS NULL THEN
    RAISE EXCEPTION 'Account does not exist';
  END IF;

  IF account_currency <> NEW.currency THEN
    RAISE EXCEPTION 'Opening balance currency must match the account currency (%)', account_currency;
  END IF;

  IF account_district_id <> NEW.district_id THEN
    RAISE EXCEPTION 'Opening balance district must match the account district';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_opening_balance_currency ON public.account_opening_balances;
CREATE TRIGGER trg_opening_balance_currency
  BEFORE INSERT OR UPDATE OF account_id, currency, district_id ON public.account_opening_balances
  FOR EACH ROW EXECUTE FUNCTION public.validate_opening_balance_currency();

ALTER TABLE public.account_opening_balances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_manage_opening_balances" ON public.account_opening_balances;
DROP POLICY IF EXISTS "district_manage_own_opening_balances" ON public.account_opening_balances;

CREATE POLICY "admin_manage_opening_balances" ON public.account_opening_balances
  FOR ALL USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

CREATE POLICY "district_manage_own_opening_balances" ON public.account_opening_balances
  FOR ALL
  USING (district_id = public.current_district_id())
  WITH CHECK (district_id = public.current_district_id());
