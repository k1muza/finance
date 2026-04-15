CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS public.districts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_districts_updated_at ON public.districts;
CREATE TRIGGER trg_districts_updated_at
  BEFORE UPDATE ON public.districts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  district_id UUID REFERENCES public.districts(id) ON DELETE SET NULL,
  role TEXT NOT NULL DEFAULT 'district' CHECK (role IN ('admin', 'district')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (role = 'admin' AND district_id IS NULL)
    OR (role = 'district' AND district_id IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS public.income_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.expense_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.funds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  district_id UUID NOT NULL REFERENCES public.districts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_restricted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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

CREATE TABLE IF NOT EXISTS public.budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  district_id UUID NOT NULL REFERENCES public.districts(id) ON DELETE CASCADE,
  fund_id UUID REFERENCES public.funds(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  category TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (period_end >= period_start)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_funds_district_name_unique
  ON public.funds (district_id, lower(name));
CREATE INDEX IF NOT EXISTS idx_income_district ON public.income(district_id);
CREATE INDEX IF NOT EXISTS idx_income_date ON public.income(date DESC);
CREATE INDEX IF NOT EXISTS idx_income_fund ON public.income(fund_id);
CREATE INDEX IF NOT EXISTS idx_expenses_district ON public.expenses(district_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON public.expenses(date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_fund ON public.expenses(fund_id);
CREATE INDEX IF NOT EXISTS idx_profiles_district ON public.profiles(district_id);
CREATE INDEX IF NOT EXISTS idx_funds_district ON public.funds(district_id);
CREATE INDEX IF NOT EXISTS idx_budgets_district ON public.budgets(district_id);
CREATE INDEX IF NOT EXISTS idx_budgets_fund ON public.budgets(fund_id);
CREATE INDEX IF NOT EXISTS idx_budgets_period_start ON public.budgets(period_start DESC);

DROP TRIGGER IF EXISTS trg_funds_updated_at ON public.funds;
CREATE TRIGGER trg_funds_updated_at
  BEFORE UPDATE ON public.funds
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_budgets_updated_at ON public.budgets;
CREATE TRIGGER trg_budgets_updated_at
  BEFORE UPDATE ON public.budgets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.income_categories (name, sort_order)
VALUES
  ('Donations', 1),
  ('Offerings', 2),
  ('Fees', 3),
  ('Fundraising', 4),
  ('Other', 5)
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.expense_categories (name, sort_order)
VALUES
  ('Transport', 1),
  ('Accommodation', 2),
  ('Venue', 3),
  ('Utilities', 4),
  ('Administration', 5),
  ('Other', 6)
ON CONFLICT (name) DO NOTHING;

CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.current_district_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT district_id
  FROM public.profiles
  WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.validate_fund_district_match()
RETURNS TRIGGER AS $$
DECLARE
  fund_district_id UUID;
BEGIN
  IF NEW.fund_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT district_id
  INTO fund_district_id
  FROM public.funds
  WHERE id = NEW.fund_id;

  IF fund_district_id IS NULL THEN
    RAISE EXCEPTION 'Selected fund does not exist';
  END IF;

  IF fund_district_id <> NEW.district_id THEN
    RAISE EXCEPTION 'Selected fund must belong to the same district';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_income_fund_district ON public.income;
CREATE TRIGGER trg_income_fund_district
  BEFORE INSERT OR UPDATE OF district_id, fund_id ON public.income
  FOR EACH ROW EXECUTE FUNCTION public.validate_fund_district_match();

DROP TRIGGER IF EXISTS trg_expenses_fund_district ON public.expenses;
CREATE TRIGGER trg_expenses_fund_district
  BEFORE INSERT OR UPDATE OF district_id, fund_id ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.validate_fund_district_match();

DROP TRIGGER IF EXISTS trg_budgets_fund_district ON public.budgets;
CREATE TRIGGER trg_budgets_fund_district
  BEFORE INSERT OR UPDATE OF district_id, fund_id ON public.budgets
  FOR EACH ROW EXECUTE FUNCTION public.validate_fund_district_match();

CREATE OR REPLACE FUNCTION public.seed_default_fund_for_district()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.funds (district_id, name, description, is_restricted)
  VALUES (NEW.id, 'General Fund', 'Default operating fund for this district.', FALSE)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_default_fund_for_district ON public.districts;
CREATE TRIGGER trg_seed_default_fund_for_district
  AFTER INSERT ON public.districts
  FOR EACH ROW EXECUTE FUNCTION public.seed_default_fund_for_district();

INSERT INTO public.funds (district_id, name, description, is_restricted)
SELECT
  districts.id,
  'General Fund',
  'Default operating fund for this district.',
  FALSE
FROM public.districts AS districts
ON CONFLICT DO NOTHING;

UPDATE public.income AS income
SET fund_id = funds.id
FROM public.funds AS funds
WHERE income.fund_id IS NULL
  AND funds.district_id = income.district_id
  AND lower(funds.name) = 'general fund';

UPDATE public.expenses AS expenses
SET fund_id = funds.id
FROM public.funds AS funds
WHERE expenses.fund_id IS NULL
  AND funds.district_id = expenses.district_id
  AND lower(funds.name) = 'general fund';

ALTER TABLE public.districts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.income_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.income ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_manage_districts" ON public.districts;
DROP POLICY IF EXISTS "district_read_own_district" ON public.districts;
CREATE POLICY "admin_manage_districts" ON public.districts
  FOR ALL USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());
CREATE POLICY "district_read_own_district" ON public.districts
  FOR SELECT USING (id = public.current_district_id());

DROP POLICY IF EXISTS "users_read_own_profile" ON public.profiles;
DROP POLICY IF EXISTS "admin_manage_profiles" ON public.profiles;
CREATE POLICY "users_read_own_profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "admin_manage_profiles" ON public.profiles
  FOR ALL USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

DROP POLICY IF EXISTS "authenticated_manage_income_categories" ON public.income_categories;
DROP POLICY IF EXISTS "authenticated_manage_expense_categories" ON public.expense_categories;
CREATE POLICY "authenticated_manage_income_categories" ON public.income_categories
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_manage_expense_categories" ON public.expense_categories
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "admin_manage_funds" ON public.funds;
DROP POLICY IF EXISTS "district_manage_own_funds" ON public.funds;
CREATE POLICY "admin_manage_funds" ON public.funds
  FOR ALL USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());
CREATE POLICY "district_manage_own_funds" ON public.funds
  FOR ALL
  USING (district_id = public.current_district_id())
  WITH CHECK (district_id = public.current_district_id());

DROP POLICY IF EXISTS "admin_manage_income" ON public.income;
DROP POLICY IF EXISTS "district_manage_own_income" ON public.income;
CREATE POLICY "admin_manage_income" ON public.income
  FOR ALL USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());
CREATE POLICY "district_manage_own_income" ON public.income
  FOR ALL
  USING (district_id = public.current_district_id())
  WITH CHECK (district_id = public.current_district_id());

DROP POLICY IF EXISTS "admin_manage_expenses" ON public.expenses;
DROP POLICY IF EXISTS "district_manage_own_expenses" ON public.expenses;
CREATE POLICY "admin_manage_expenses" ON public.expenses
  FOR ALL USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());
CREATE POLICY "district_manage_own_expenses" ON public.expenses
  FOR ALL
  USING (district_id = public.current_district_id())
  WITH CHECK (district_id = public.current_district_id());

DROP POLICY IF EXISTS "admin_manage_budgets" ON public.budgets;
DROP POLICY IF EXISTS "district_manage_own_budgets" ON public.budgets;
CREATE POLICY "admin_manage_budgets" ON public.budgets
  FOR ALL USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());
CREATE POLICY "district_manage_own_budgets" ON public.budgets
  FOR ALL
  USING (district_id = public.current_district_id())
  WITH CHECK (district_id = public.current_district_id());
