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

ALTER TABLE public.income_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_manage_income_categories" ON public.income_categories;
DROP POLICY IF EXISTS "authenticated_manage_expense_categories" ON public.expense_categories;
CREATE POLICY "authenticated_manage_income_categories" ON public.income_categories
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_manage_expense_categories" ON public.expense_categories
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
