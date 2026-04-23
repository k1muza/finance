-- Phase 4: budgets -> budget headers + budget lines
-- 1. Migrates the legacy flat budgets table into budget headers and lines.
-- 2. Adds draft/active/closed lifecycle states.
-- 3. Enforces district-safe line references and draft-only edits.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'budgets'
  )
  AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'budgets'
      AND column_name = 'fund_id'
  )
  AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'budgets'
      AND column_name = 'type'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'budgets'
      AND column_name = 'status'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'legacy_flat_budgets'
  ) THEN
    ALTER TABLE public.budgets RENAME TO legacy_flat_budgets;
  END IF;
END $$;

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
  currency public.currency_code NOT NULL DEFAULT 'USD',
  budget_kind TEXT NOT NULL CHECK (budget_kind IN ('income', 'expense')),
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  scope_member_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_budget_headers_client_generated_id
  ON public.budgets(client_generated_id)
  WHERE client_generated_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_budget_headers_district_status_period
  ON public.budgets(district_id, status, start_date DESC, end_date DESC);

CREATE INDEX IF NOT EXISTS idx_budget_headers_period
  ON public.budgets(start_date DESC, end_date DESC);

CREATE INDEX IF NOT EXISTS idx_budget_lines_budget
  ON public.budget_lines(budget_id);

CREATE INDEX IF NOT EXISTS idx_budget_lines_district_kind_currency
  ON public.budget_lines(district_id, budget_kind, currency);

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
    budget_kind,
    COALESCE(scope_member_id, '00000000-0000-0000-0000-000000000000'::UUID)
  );

DROP TRIGGER IF EXISTS trg_budget_headers_updated_at ON public.budgets;
CREATE TRIGGER trg_budget_headers_updated_at
  BEFORE UPDATE ON public.budgets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_budget_lines_updated_at ON public.budget_lines;
CREATE TRIGGER trg_budget_lines_updated_at
  BEFORE UPDATE ON public.budget_lines
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

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

CREATE OR REPLACE FUNCTION public.validate_budget_line_district_match()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_budget_district UUID;
  v_fund_district UUID;
  v_member_district UUID;
BEGIN
  SELECT district_id
  INTO v_budget_district
  FROM public.budgets
  WHERE id = NEW.budget_id;

  IF v_budget_district IS NULL THEN
    RAISE EXCEPTION 'Selected budget does not exist';
  END IF;

  IF v_budget_district <> NEW.district_id THEN
    RAISE EXCEPTION 'Budget line district must match its budget district';
  END IF;

  SELECT district_id
  INTO v_fund_district
  FROM public.funds
  WHERE id = NEW.fund_id;

  IF v_fund_district IS NULL THEN
    RAISE EXCEPTION 'Selected fund does not exist';
  END IF;

  IF v_fund_district <> NEW.district_id THEN
    RAISE EXCEPTION 'Selected fund must belong to the same district';
  END IF;

  IF NEW.scope_member_id IS NOT NULL THEN
    SELECT district_id
    INTO v_member_district
    FROM public.members
    WHERE id = NEW.scope_member_id;

    IF v_member_district IS NULL THEN
      RAISE EXCEPTION 'Selected member scope does not exist';
    END IF;

    IF v_member_district <> NEW.district_id THEN
      RAISE EXCEPTION 'Selected member scope must belong to the same district';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_budget_lines_validate_district ON public.budget_lines;
CREATE TRIGGER trg_budget_lines_validate_district
  BEFORE INSERT OR UPDATE OF district_id, budget_id, fund_id, scope_member_id
  ON public.budget_lines
  FOR EACH ROW EXECUTE FUNCTION public.validate_budget_line_district_match();

CREATE OR REPLACE FUNCTION public.enforce_budget_header_editability()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status <> 'draft' THEN
      RAISE EXCEPTION 'Only draft budgets may be deleted';
    END IF;

    IF NOT public.can_manage_budget_drafts(OLD.district_id) THEN
      RAISE EXCEPTION 'You do not have permission to delete draft budgets';
    END IF;

    RETURN OLD;
  END IF;

  IF OLD.status = 'draft' THEN
    IF NEW.status = OLD.status THEN
      IF NOT public.can_manage_budget_drafts(OLD.district_id) THEN
        RAISE EXCEPTION 'You do not have permission to edit draft budgets';
      END IF;

      RETURN NEW;
    END IF;

    IF NEW.status = 'active' THEN
      IF NOT public.can_activate_budget_lifecycle(OLD.district_id) THEN
        RAISE EXCEPTION 'You do not have permission to activate budgets';
      END IF;

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

    IF NOT public.can_close_budget_lifecycle(OLD.district_id) THEN
      RAISE EXCEPTION 'You do not have permission to close budgets';
    END IF;

    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Closed budgets are immutable';
END;
$$;

DROP TRIGGER IF EXISTS trg_budget_headers_editability ON public.budgets;
CREATE TRIGGER trg_budget_headers_editability
  BEFORE UPDATE OR DELETE ON public.budgets
  FOR EACH ROW EXECUTE FUNCTION public.enforce_budget_header_editability();

CREATE OR REPLACE FUNCTION public.enforce_budget_line_editability()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_budget_status TEXT;
  v_district_id UUID;
BEGIN
  SELECT status, district_id
  INTO v_budget_status, v_district_id
  FROM public.budgets
  WHERE id = COALESCE(NEW.budget_id, OLD.budget_id);

  IF v_budget_status IS NULL THEN
    RAISE EXCEPTION 'Parent budget not found';
  END IF;

  IF v_budget_status <> 'draft' THEN
    RAISE EXCEPTION 'Only draft budgets may be edited';
  END IF;

  IF NOT public.can_manage_budget_drafts(v_district_id) THEN
    RAISE EXCEPTION 'You do not have permission to edit draft budget lines';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_budget_lines_editability ON public.budget_lines;
CREATE TRIGGER trg_budget_lines_editability
  BEFORE INSERT OR UPDATE OR DELETE ON public.budget_lines
  FOR EACH ROW EXECUTE FUNCTION public.enforce_budget_line_editability();

ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_lines ENABLE ROW LEVEL SECURITY;

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

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'legacy_flat_budgets'
  ) THEN
    INSERT INTO public.budgets (
      district_id,
      name,
      start_date,
      end_date,
      status,
      description,
      created_at,
      updated_at
    )
    SELECT
      legacy.district_id,
      CONCAT(
        'Migrated Budget ',
        TO_CHAR(legacy.period_start, 'YYYY-MM-DD'),
        ' to ',
        TO_CHAR(legacy.period_end, 'YYYY-MM-DD')
      ) AS name,
      legacy.period_start,
      legacy.period_end,
      'draft',
      'Migrated from legacy flat budgets.',
      MIN(legacy.created_at),
      MAX(legacy.updated_at)
    FROM public.legacy_flat_budgets AS legacy
    GROUP BY legacy.district_id, legacy.period_start, legacy.period_end;

    INSERT INTO public.budget_lines (
      district_id,
      budget_id,
      fund_id,
      currency,
      budget_kind,
      amount,
      notes,
      created_at,
      updated_at
    )
    SELECT
      legacy.district_id,
      budget.id,
      legacy.fund_id,
      legacy.currency,
      legacy.type,
      legacy.amount,
      CASE
        WHEN legacy.category IS NOT NULL AND legacy.notes IS NOT NULL THEN
          CONCAT('Legacy category: ', legacy.category, E'\n', legacy.notes)
        WHEN legacy.category IS NOT NULL THEN
          CONCAT('Legacy category: ', legacy.category)
        ELSE legacy.notes
      END,
      legacy.created_at,
      legacy.updated_at
    FROM public.legacy_flat_budgets AS legacy
    JOIN public.budgets AS budget
      ON budget.district_id = legacy.district_id
     AND budget.start_date = legacy.period_start
     AND budget.end_date = legacy.period_end
     AND budget.description = 'Migrated from legacy flat budgets.';

    UPDATE public.budgets
    SET status = 'active'
    WHERE description = 'Migrated from legacy flat budgets.'
      AND status = 'draft';

    DROP TABLE public.legacy_flat_budgets;
  END IF;
END $$;
