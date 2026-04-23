CREATE TABLE IF NOT EXISTS public.funds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  district_id UUID NOT NULL REFERENCES public.districts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT,
  description TEXT,
  is_restricted BOOLEAN NOT NULL DEFAULT FALSE,
  nature public.fund_nature NOT NULL DEFAULT 'mixed',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  requires_individual_member BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  district_id UUID NOT NULL REFERENCES public.districts(id) ON DELETE CASCADE,
  client_generated_id TEXT,
  device_id TEXT,
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'closed')),
  description TEXT,
  created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (end_date >= start_date)
);

CREATE TABLE IF NOT EXISTS public.budget_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  district_id UUID NOT NULL REFERENCES public.districts(id) ON DELETE CASCADE,
  budget_id UUID NOT NULL REFERENCES public.budgets(id) ON DELETE CASCADE,
  fund_id UUID NOT NULL REFERENCES public.funds(id) ON DELETE RESTRICT,
  line_description TEXT NOT NULL CHECK (char_length(BTRIM(line_description)) > 0),
  currency public.currency_code NOT NULL DEFAULT 'USD',
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  scope_member_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.income
  ADD COLUMN IF NOT EXISTS fund_id UUID REFERENCES public.funds(id) ON DELETE SET NULL;

ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS fund_id UUID REFERENCES public.funds(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_funds_district_name_unique
  ON public.funds (district_id, lower(name));
CREATE INDEX IF NOT EXISTS idx_funds_district
  ON public.funds(district_id);
CREATE INDEX IF NOT EXISTS idx_budget_headers_district_status_period
  ON public.budgets(district_id, status, start_date DESC, end_date DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_budget_headers_client_generated_id
  ON public.budgets(client_generated_id)
  WHERE client_generated_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_budget_lines_budget
  ON public.budget_lines(budget_id);
CREATE INDEX IF NOT EXISTS idx_budget_lines_district_currency
  ON public.budget_lines(district_id, currency);
CREATE INDEX IF NOT EXISTS idx_budget_lines_fund_currency
  ON public.budget_lines(fund_id, currency);
CREATE INDEX IF NOT EXISTS idx_budget_lines_scope_member
  ON public.budget_lines(scope_member_id)
  WHERE scope_member_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_budget_lines_unique_scope
  ON public.budget_lines(
    budget_id,
    fund_id,
    currency,
    COALESCE(scope_member_id, '00000000-0000-0000-0000-000000000000'::UUID),
    LOWER(BTRIM(line_description))
  );
CREATE INDEX IF NOT EXISTS idx_income_fund
  ON public.income(fund_id);
CREATE INDEX IF NOT EXISTS idx_expenses_fund
  ON public.expenses(fund_id);

DROP TRIGGER IF EXISTS trg_funds_updated_at ON public.funds;
CREATE TRIGGER trg_funds_updated_at
  BEFORE UPDATE ON public.funds
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_budget_headers_updated_at ON public.budgets;
CREATE TRIGGER trg_budget_headers_updated_at
  BEFORE UPDATE ON public.budgets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_budget_lines_updated_at ON public.budget_lines;
CREATE TRIGGER trg_budget_lines_updated_at
  BEFORE UPDATE ON public.budget_lines
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

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

CREATE OR REPLACE FUNCTION public.validate_budget_line_district_match()
RETURNS TRIGGER AS $$
DECLARE
  v_budget_district UUID;
  v_fund_district UUID;
  v_fund_nature public.fund_nature;
  v_member_district UUID;
BEGIN
  SELECT district_id INTO v_budget_district FROM public.budgets WHERE id = NEW.budget_id;
  IF v_budget_district IS NULL THEN
    RAISE EXCEPTION 'Selected budget does not exist';
  END IF;
  IF v_budget_district <> NEW.district_id THEN
    RAISE EXCEPTION 'Budget line district must match the parent budget';
  END IF;

  SELECT district_id, nature INTO v_fund_district, v_fund_nature FROM public.funds WHERE id = NEW.fund_id;
  IF v_fund_district IS NULL THEN
    RAISE EXCEPTION 'Selected fund does not exist';
  END IF;
  IF v_fund_district <> NEW.district_id THEN
    RAISE EXCEPTION 'Selected fund must belong to the same district';
  END IF;
  IF v_fund_nature = 'income_only' THEN
    RAISE EXCEPTION 'Income-only funds cannot be used for expense budgets';
  END IF;

  IF NEW.scope_member_id IS NOT NULL THEN
    SELECT district_id INTO v_member_district FROM public.members WHERE id = NEW.scope_member_id;
    IF v_member_district IS NULL THEN
      RAISE EXCEPTION 'Selected member scope does not exist';
    END IF;
    IF v_member_district <> NEW.district_id THEN
      RAISE EXCEPTION 'Selected member scope must belong to the same district';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.can_manage_budget_drafts(p_district_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin_user() OR auth.uid() IS NULL OR EXISTS (
    SELECT 1
    FROM public.district_users du
    WHERE du.user_id = auth.uid()
      AND du.district_id = p_district_id
      AND du.is_active = TRUE
      AND du.role IN ('admin', 'secretary', 'treasurer', 'clerk')
  );
$$;

CREATE OR REPLACE FUNCTION public.can_activate_budget_lifecycle(p_district_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin_user() OR auth.uid() IS NULL OR EXISTS (
    SELECT 1
    FROM public.district_users du
    WHERE du.user_id = auth.uid()
      AND du.district_id = p_district_id
      AND du.is_active = TRUE
      AND du.role IN ('admin', 'treasurer')
  );
$$;

CREATE OR REPLACE FUNCTION public.can_close_budget_lifecycle(p_district_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin_user() OR auth.uid() IS NULL OR EXISTS (
    SELECT 1
    FROM public.district_users du
    WHERE du.user_id = auth.uid()
      AND du.district_id = p_district_id
      AND du.is_active = TRUE
      AND du.role IN ('admin', 'treasurer')
  );
$$;

CREATE OR REPLACE FUNCTION public.enforce_budget_creator_identity()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF auth.uid() IS NOT NULL THEN
      NEW.created_by_user_id := auth.uid();
    END IF;

    RETURN NEW;
  END IF;

  IF auth.uid() IS NOT NULL
     AND NEW.created_by_user_id IS DISTINCT FROM OLD.created_by_user_id THEN
    RAISE EXCEPTION 'Budget creator cannot be changed';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_budget_header_editability()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status <> 'draft' THEN
      RAISE EXCEPTION 'Only draft budgets may be deleted';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.status = 'draft' THEN
    IF NEW.status = OLD.status THEN
      RETURN NEW;
    END IF;
    IF NEW.status = 'active' THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Draft budgets may only transition to active';
  END IF;

  IF OLD.status = 'active' THEN
    IF NEW.status <> 'closed' THEN
      RAISE EXCEPTION 'Active budgets may only transition to closed';
    END IF;
    IF NEW.name IS DISTINCT FROM OLD.name
      OR NEW.start_date IS DISTINCT FROM OLD.start_date
      OR NEW.end_date IS DISTINCT FROM OLD.end_date
      OR NEW.description IS DISTINCT FROM OLD.description
      OR NEW.client_generated_id IS DISTINCT FROM OLD.client_generated_id
      OR NEW.device_id IS DISTINCT FROM OLD.device_id
      OR NEW.created_by_user_id IS DISTINCT FROM OLD.created_by_user_id
      OR NEW.district_id IS DISTINCT FROM OLD.district_id
    THEN
      RAISE EXCEPTION 'Active budgets are immutable except for closure';
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Closed budgets are immutable';
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.enforce_budget_line_editability()
RETURNS TRIGGER AS $$
DECLARE
  v_budget_status TEXT;
BEGIN
  SELECT status
  INTO v_budget_status
  FROM public.budgets
  WHERE id = COALESCE(NEW.budget_id, OLD.budget_id);

  IF v_budget_status <> 'draft' THEN
    RAISE EXCEPTION 'Only draft budgets may be edited';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
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

DROP TRIGGER IF EXISTS trg_budget_lines_validate_district ON public.budget_lines;
CREATE TRIGGER trg_budget_lines_validate_district
  BEFORE INSERT OR UPDATE OF district_id, budget_id, fund_id, scope_member_id ON public.budget_lines
  FOR EACH ROW EXECUTE FUNCTION public.validate_budget_line_district_match();

DROP TRIGGER IF EXISTS trg_budget_headers_editability ON public.budgets;
CREATE TRIGGER trg_budget_headers_editability
  BEFORE UPDATE OR DELETE ON public.budgets
  FOR EACH ROW EXECUTE FUNCTION public.enforce_budget_header_editability();

DROP TRIGGER IF EXISTS trg_budget_headers_creator_identity ON public.budgets;
CREATE TRIGGER trg_budget_headers_creator_identity
  BEFORE INSERT OR UPDATE OF created_by_user_id ON public.budgets
  FOR EACH ROW EXECUTE FUNCTION public.enforce_budget_creator_identity();

DROP TRIGGER IF EXISTS trg_budget_lines_editability ON public.budget_lines;
CREATE TRIGGER trg_budget_lines_editability
  BEFORE INSERT OR UPDATE OR DELETE ON public.budget_lines
  FOR EACH ROW EXECUTE FUNCTION public.enforce_budget_line_editability();

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

ALTER TABLE public.funds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_manage_funds" ON public.funds;
DROP POLICY IF EXISTS "district_manage_own_funds" ON public.funds;
DROP POLICY IF EXISTS "district_member_manage_funds" ON public.funds;
CREATE POLICY "district_member_manage_funds" ON public.funds
  FOR ALL
  USING (public.is_district_member(district_id) OR public.is_admin_user())
  WITH CHECK (public.is_district_member(district_id) OR public.is_admin_user());

DROP POLICY IF EXISTS "admin_manage_budgets" ON public.budgets;
DROP POLICY IF EXISTS "district_manage_own_budgets" ON public.budgets;
DROP POLICY IF EXISTS "district_member_manage_budgets" ON public.budgets;
DROP POLICY IF EXISTS "district_member_read_budgets" ON public.budgets;
DROP POLICY IF EXISTS "district_member_insert_budgets" ON public.budgets;
DROP POLICY IF EXISTS "district_member_update_budgets" ON public.budgets;
DROP POLICY IF EXISTS "district_member_delete_budgets" ON public.budgets;

CREATE POLICY "district_member_read_budgets" ON public.budgets
  FOR SELECT
  USING (public.is_district_member(district_id) OR public.is_admin_user());

CREATE POLICY "district_member_insert_budgets" ON public.budgets
  FOR INSERT
  WITH CHECK (public.can_manage_budget_drafts(district_id));

CREATE POLICY "district_member_update_budgets" ON public.budgets
  FOR UPDATE
  USING (
    public.can_manage_budget_drafts(district_id)
    OR public.can_activate_budget_lifecycle(district_id)
    OR public.can_close_budget_lifecycle(district_id)
  )
  WITH CHECK (
    public.can_manage_budget_drafts(district_id)
    OR public.can_activate_budget_lifecycle(district_id)
    OR public.can_close_budget_lifecycle(district_id)
  );

CREATE POLICY "district_member_delete_budgets" ON public.budgets
  FOR DELETE
  USING (public.can_manage_budget_drafts(district_id));

DROP POLICY IF EXISTS "district_member_manage_budget_lines" ON public.budget_lines;
DROP POLICY IF EXISTS "district_member_read_budget_lines" ON public.budget_lines;
DROP POLICY IF EXISTS "district_member_insert_budget_lines" ON public.budget_lines;
DROP POLICY IF EXISTS "district_member_update_budget_lines" ON public.budget_lines;
DROP POLICY IF EXISTS "district_member_delete_budget_lines" ON public.budget_lines;

CREATE POLICY "district_member_read_budget_lines" ON public.budget_lines
  FOR SELECT
  USING (public.is_district_member(district_id) OR public.is_admin_user());

CREATE POLICY "district_member_insert_budget_lines" ON public.budget_lines
  FOR INSERT
  WITH CHECK (public.can_manage_budget_drafts(district_id));

CREATE POLICY "district_member_update_budget_lines" ON public.budget_lines
  FOR UPDATE
  USING (public.can_manage_budget_drafts(district_id))
  WITH CHECK (public.can_manage_budget_drafts(district_id));

CREATE POLICY "district_member_delete_budget_lines" ON public.budget_lines
  FOR DELETE
  USING (public.can_manage_budget_drafts(district_id));
