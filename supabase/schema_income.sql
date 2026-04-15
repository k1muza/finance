CREATE TABLE IF NOT EXISTS public.income (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  district_id UUID NOT NULL REFERENCES public.districts(id) ON DELETE CASCADE,
  fund_id UUID REFERENCES public.funds(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  category TEXT,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_income_district ON public.income(district_id);
CREATE INDEX IF NOT EXISTS idx_income_date ON public.income(date DESC);
CREATE INDEX IF NOT EXISTS idx_income_fund ON public.income(fund_id);

ALTER TABLE public.income ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_income_fund_district ON public.income;
CREATE TRIGGER trg_income_fund_district
  BEFORE INSERT OR UPDATE OF district_id, fund_id ON public.income
  FOR EACH ROW EXECUTE FUNCTION public.validate_fund_district_match();

DROP POLICY IF EXISTS "admin_manage_income" ON public.income;
DROP POLICY IF EXISTS "district_manage_own_income" ON public.income;
CREATE POLICY "admin_manage_income" ON public.income
  FOR ALL USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());
CREATE POLICY "district_manage_own_income" ON public.income
  FOR ALL
  USING (district_id = public.current_district_id())
  WITH CHECK (district_id = public.current_district_id());
