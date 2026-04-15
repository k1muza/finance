CREATE TABLE IF NOT EXISTS public.income (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  district_id UUID NOT NULL REFERENCES public.districts(id) ON DELETE CASCADE,
  account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  fund_id UUID REFERENCES public.funds(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  category TEXT,
  currency public.currency_code NOT NULL DEFAULT 'USD',
  payment_method public.payment_method NOT NULL DEFAULT 'cash',
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_income_district ON public.income(district_id);
CREATE INDEX IF NOT EXISTS idx_income_date ON public.income(date DESC);
CREATE INDEX IF NOT EXISTS idx_income_account ON public.income(account_id);
CREATE INDEX IF NOT EXISTS idx_income_account_currency ON public.income(account_id, currency);
CREATE INDEX IF NOT EXISTS idx_income_fund ON public.income(fund_id);
CREATE INDEX IF NOT EXISTS idx_income_fund_currency ON public.income(fund_id, currency);

ALTER TABLE public.income ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.validate_account_transaction_match()
RETURNS TRIGGER AS $$
DECLARE
  account_district_id UUID;
  account_currency public.currency_code;
  account_status TEXT;
BEGIN
  IF NEW.account_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT district_id, currency, status
  INTO account_district_id, account_currency, account_status
  FROM public.accounts
  WHERE id = NEW.account_id;

  IF account_district_id IS NULL THEN
    RAISE EXCEPTION 'Selected account does not exist';
  END IF;

  IF account_district_id <> NEW.district_id THEN
    RAISE EXCEPTION 'Selected account must belong to the same district';
  END IF;

  IF account_currency <> NEW.currency THEN
    RAISE EXCEPTION 'Selected account currency must match the transaction currency';
  END IF;

  IF account_status <> 'active' THEN
    RAISE EXCEPTION 'Selected account must be active';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_income_fund_district ON public.income;
CREATE TRIGGER trg_income_fund_district
  BEFORE INSERT OR UPDATE OF district_id, fund_id ON public.income
  FOR EACH ROW EXECUTE FUNCTION public.validate_fund_district_match();

DROP TRIGGER IF EXISTS trg_income_account_match ON public.income;
CREATE TRIGGER trg_income_account_match
  BEFORE INSERT OR UPDATE OF district_id, account_id, currency ON public.income
  FOR EACH ROW EXECUTE FUNCTION public.validate_account_transaction_match();

DROP POLICY IF EXISTS "admin_manage_income" ON public.income;
DROP POLICY IF EXISTS "district_manage_own_income" ON public.income;
CREATE POLICY "admin_manage_income" ON public.income
  FOR ALL USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());
CREATE POLICY "district_manage_own_income" ON public.income
  FOR ALL
  USING (district_id = public.current_district_id())
  WITH CHECK (district_id = public.current_district_id());
