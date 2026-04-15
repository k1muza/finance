CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  district_id UUID NOT NULL REFERENCES public.districts(id) ON DELETE CASCADE,
  fund_id UUID REFERENCES public.funds(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  category TEXT,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expenses_district ON public.expenses(district_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON public.expenses(date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_fund ON public.expenses(fund_id);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_expenses_fund_district ON public.expenses;
CREATE TRIGGER trg_expenses_fund_district
  BEFORE INSERT OR UPDATE OF district_id, fund_id ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.validate_fund_district_match();

DROP POLICY IF EXISTS "admin_manage_expenses" ON public.expenses;
DROP POLICY IF EXISTS "district_manage_own_expenses" ON public.expenses;
CREATE POLICY "admin_manage_expenses" ON public.expenses
  FOR ALL USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());
CREATE POLICY "district_manage_own_expenses" ON public.expenses
  FOR ALL
  USING (district_id = public.current_district_id())
  WITH CHECK (district_id = public.current_district_id());
