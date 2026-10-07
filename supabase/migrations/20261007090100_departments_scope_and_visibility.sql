-- ============================================================
-- Departments, scoped role memberships, and private/public
-- financial visibility.
--
--   1. departments + department_members (Coordination)
--   2. district_users.scope_member_id / scope_department_id
--   3. funds.is_public and the private-financials read rules
--   4. district_events.department_id
--   5. Role checks updated to the capability matrix in
--      src/lib/auth/permissions.ts — keep both in sync.
-- ============================================================

-- ── 1. departments ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.departments (
  id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  district_id          UUID         NOT NULL REFERENCES public.districts(id) ON DELETE CASCADE,
  name                 TEXT         NOT NULL,
  code                 TEXT,
  description          TEXT,
  grants_finance_view  BOOLEAN      NOT NULL DEFAULT FALSE,
  is_active            BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT departments_name_not_blank CHECK (btrim(name) <> '')
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_departments_district_name
  ON public.departments(district_id, lower(name));

DROP TRIGGER IF EXISTS trg_departments_updated_at ON public.departments;
CREATE TRIGGER trg_departments_updated_at
  BEFORE UPDATE ON public.departments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.department_members (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id  UUID         NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  user_id        UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  added_by       UUID         REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE (department_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_department_members_user
  ON public.department_members(user_id);

-- ── 2. scope on district_users ───────────────────────────────

ALTER TABLE public.district_users
  ADD COLUMN IF NOT EXISTS scope_member_id     UUID REFERENCES public.members(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS scope_department_id UUID REFERENCES public.departments(id) ON DELETE RESTRICT;

-- Scoped roles must point at a unit of the right type in the same
-- district; every other role must be unscoped.
CREATE OR REPLACE FUNCTION public.validate_district_user_scope()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_required_member_type public.member_type;
  v_needs_department     BOOLEAN := NEW.role IN ('departmental_chairperson', 'departmental_secretary');
  v_member_type          public.member_type;
  v_member_district_id   UUID;
BEGIN
  v_required_member_type := CASE NEW.role
    WHEN 'regional_pastor'         THEN 'region'::public.member_type
    WHEN 'regional_coordinator'    THEN 'region'::public.member_type
    WHEN 'regional_secretary'      THEN 'region'::public.member_type
    WHEN 'assembly_coordinator'    THEN 'assembly'::public.member_type
    WHEN 'assembly_secretary'      THEN 'assembly'::public.member_type
    WHEN 'ministerial_chairperson' THEN 'department'::public.member_type
    WHEN 'ministerial_secretary'   THEN 'department'::public.member_type
    ELSE NULL
  END;

  IF v_required_member_type IS NULL AND NEW.scope_member_id IS NOT NULL THEN
    RAISE EXCEPTION 'Role % does not take a region, assembly or ministry', NEW.role;
  END IF;

  IF NOT v_needs_department AND NEW.scope_department_id IS NOT NULL THEN
    RAISE EXCEPTION 'Role % does not take a department', NEW.role;
  END IF;

  IF v_required_member_type IS NOT NULL THEN
    IF NEW.scope_member_id IS NULL THEN
      RAISE EXCEPTION 'Role % needs a % to be selected', NEW.role, v_required_member_type;
    END IF;

    SELECT type, district_id INTO v_member_type, v_member_district_id
    FROM public.members WHERE id = NEW.scope_member_id;
    IF v_member_type IS DISTINCT FROM v_required_member_type
       OR v_member_district_id IS DISTINCT FROM NEW.district_id THEN
      RAISE EXCEPTION 'Role % must be scoped to a % in this district', NEW.role, v_required_member_type;
    END IF;
  END IF;

  IF v_needs_department THEN
    IF NEW.scope_department_id IS NULL THEN
      RAISE EXCEPTION 'Role % needs a department to be selected', NEW.role;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.departments d
      WHERE d.id = NEW.scope_department_id AND d.district_id = NEW.district_id
    ) THEN
      RAISE EXCEPTION 'Role % must be scoped to a department in this district', NEW.role;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- The old default (ministerial_secretary) is now a scoped role, so
-- callers must always choose a role explicitly.
ALTER TABLE public.district_users ALTER COLUMN role DROP DEFAULT;

DROP TRIGGER IF EXISTS trg_validate_district_user_scope ON public.district_users;
CREATE TRIGGER trg_validate_district_user_scope
  BEFORE INSERT OR UPDATE OF role, scope_member_id, scope_department_id, district_id
  ON public.district_users
  FOR EACH ROW EXECUTE FUNCTION public.validate_district_user_scope();

-- ── 3. fund visibility ───────────────────────────────────────

ALTER TABLE public.funds
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT FALSE;

-- ── 4. events tagged to a department ─────────────────────────

ALTER TABLE public.district_events
  ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL;

-- ── 5. capability helpers ────────────────────────────────────

-- Member of a department that grants finance view (the Finance
-- Committee). Department leaders count as members.
CREATE OR REPLACE FUNCTION public.is_finance_committee_member(p_district_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.department_members dm
    JOIN public.departments d ON d.id = dm.department_id
    WHERE dm.user_id = auth.uid()
      AND d.district_id = p_district_id
      AND d.grants_finance_view = TRUE
      AND d.is_active = TRUE
      AND public.is_district_member(p_district_id)
  ) OR EXISTS (
    SELECT 1
    FROM public.district_users du
    JOIN public.departments d ON d.id = du.scope_department_id
    WHERE du.user_id = auth.uid()
      AND du.district_id = p_district_id
      AND du.is_active = TRUE
      AND d.grants_finance_view = TRUE
      AND d.is_active = TRUE
  );
$$;

-- financials.view_private
CREATE OR REPLACE FUNCTION public.can_view_private_financials(p_district_id UUID)
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
      AND du.role IN ('district_pastor', 'accounting_officer', 'assistant_accounting_officer')
  ) OR public.is_finance_committee_member(p_district_id);
$$;

CREATE OR REPLACE FUNCTION public.is_public_fund(p_fund_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT is_public FROM public.funds WHERE id = p_fund_id), FALSE);
$$;

-- departments.manage
CREATE OR REPLACE FUNCTION public.can_manage_departments(p_district_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin_user() OR EXISTS (
    SELECT 1
    FROM public.district_users du
    WHERE du.user_id = auth.uid()
      AND du.district_id = p_district_id
      AND du.is_active = TRUE
      AND du.role IN ('district_pastor', 'district_secretary', 'district_coordinator')
  );
$$;

CREATE OR REPLACE FUNCTION public.holds_department_role(p_department_id UUID, p_roles public.district_role[])
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.district_users du
    WHERE du.user_id = auth.uid()
      AND du.scope_department_id = p_department_id
      AND du.is_active = TRUE
      AND du.role = ANY (p_roles)
  );
$$;

-- events.manage (district-wide), plus departmental secretaries for
-- events tagged to their own department.
CREATE OR REPLACE FUNCTION public.can_manage_district_events(p_district_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin_user() OR EXISTS (
    SELECT 1
    FROM public.district_users du
    WHERE du.user_id = auth.uid()
      AND du.district_id = p_district_id
      AND du.is_active = TRUE
      AND du.role IN ('district_pastor', 'district_secretary', 'district_coordinator')
  );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_event(p_district_id UUID, p_department_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.can_manage_district_events(p_district_id)
    OR (
      p_department_id IS NOT NULL
      AND public.holds_department_role(p_department_id, ARRAY['departmental_secretary']::public.district_role[])
    );
$$;

DROP POLICY IF EXISTS "district_manager_insert_events" ON public.district_events;
CREATE POLICY "district_manager_insert_events"
  ON public.district_events FOR INSERT
  WITH CHECK (public.can_manage_event(district_id, department_id));

DROP POLICY IF EXISTS "district_manager_update_events" ON public.district_events;
CREATE POLICY "district_manager_update_events"
  ON public.district_events FOR UPDATE
  USING (public.can_manage_event(district_id, department_id))
  WITH CHECK (public.can_manage_event(district_id, department_id));

DROP POLICY IF EXISTS "district_manager_delete_events" ON public.district_events;
CREATE POLICY "district_manager_delete_events"
  ON public.district_events FOR DELETE
  USING (public.can_manage_event(district_id, department_id));

-- budgets.manage — the District Secretary no longer edits budgets
-- (budgets are private financials).
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
      AND du.role IN ('district_pastor', 'accounting_officer', 'assistant_accounting_officer')
  );
$$;

-- ── departments RLS ──────────────────────────────────────────

ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "district_member_read_departments" ON public.departments;
CREATE POLICY "district_member_read_departments"
  ON public.departments FOR SELECT
  USING (public.is_district_member(district_id) OR public.is_admin_user());

DROP POLICY IF EXISTS "district_manager_write_departments" ON public.departments;
CREATE POLICY "district_manager_write_departments"
  ON public.departments FOR ALL
  USING (public.can_manage_departments(district_id))
  WITH CHECK (public.can_manage_departments(district_id));

-- Only the District Pastor (or a superuser) decides which department
-- carries finance view rights.
CREATE OR REPLACE FUNCTION public.guard_department_finance_grant()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.grants_finance_view)
     OR (TG_OP = 'UPDATE' AND NEW.grants_finance_view IS DISTINCT FROM OLD.grants_finance_view) THEN
    IF NOT (auth.uid() IS NULL OR public.is_admin_user() OR public.is_district_admin(NEW.district_id)) THEN
      RAISE EXCEPTION 'Only the District Pastor can change which department has finance access';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_department_finance_grant ON public.departments;
CREATE TRIGGER trg_guard_department_finance_grant
  BEFORE INSERT OR UPDATE ON public.departments
  FOR EACH ROW EXECUTE FUNCTION public.guard_department_finance_grant();

ALTER TABLE public.department_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "district_member_read_department_members" ON public.department_members;
CREATE POLICY "district_member_read_department_members"
  ON public.department_members FOR SELECT
  USING (
    public.is_admin_user() OR EXISTS (
      SELECT 1 FROM public.departments d
      WHERE d.id = department_id AND public.is_district_member(d.district_id)
    )
  );

DROP POLICY IF EXISTS "department_manager_write_department_members" ON public.department_members;
CREATE POLICY "department_manager_write_department_members"
  ON public.department_members FOR ALL
  USING (
    public.holds_department_role(department_id, ARRAY['departmental_chairperson']::public.district_role[])
    OR EXISTS (
      SELECT 1 FROM public.departments d
      WHERE d.id = department_id AND public.can_manage_departments(d.district_id)
    )
  )
  WITH CHECK (
    public.holds_department_role(department_id, ARRAY['departmental_chairperson']::public.district_role[])
    OR EXISTS (
      SELECT 1 FROM public.departments d
      WHERE d.id = department_id AND public.can_manage_departments(d.district_id)
    )
  );

-- ── private financials RLS ───────────────────────────────────
-- Members without financials.view_private only see cashbook
-- activity on public funds; transfers, budgets and opening
-- balances are private.

DROP POLICY IF EXISTS "district_member_manage_cashbook_transactions" ON public.cashbook_transactions;
CREATE POLICY "district_member_manage_cashbook_transactions" ON public.cashbook_transactions
  FOR ALL
  USING (
    public.is_admin_user() OR (
      public.is_district_member(district_id)
      AND (public.can_view_private_financials(district_id) OR public.is_public_fund(fund_id))
    )
  )
  WITH CHECK (public.is_district_member(district_id) OR public.is_admin_user());

DROP POLICY IF EXISTS "district_member_read_cashbook_lines" ON public.cashbook_transaction_lines;
CREATE POLICY "district_member_read_cashbook_lines" ON public.cashbook_transaction_lines
  FOR SELECT
  USING (
    public.is_admin_user() OR EXISTS (
      SELECT 1 FROM public.cashbook_transactions t
      WHERE t.id = transaction_id
        AND public.is_district_member(t.district_id)
        AND (public.can_view_private_financials(t.district_id) OR public.is_public_fund(t.fund_id))
    )
  );

DROP POLICY IF EXISTS "district_member_manage_transfers" ON public.transfers;
CREATE POLICY "district_member_manage_transfers" ON public.transfers
  FOR ALL
  USING (public.can_view_private_financials(district_id) AND public.is_district_member(district_id) OR public.is_admin_user())
  WITH CHECK (public.can_view_private_financials(district_id) AND public.is_district_member(district_id) OR public.is_admin_user());

DROP POLICY IF EXISTS "district_member_read_budgets" ON public.budgets;
CREATE POLICY "district_member_read_budgets" ON public.budgets
  FOR SELECT
  USING (public.can_view_private_financials(district_id) AND public.is_district_member(district_id) OR public.is_admin_user());

DROP POLICY IF EXISTS "district_member_read_budget_lines" ON public.budget_lines;
CREATE POLICY "district_member_read_budget_lines" ON public.budget_lines
  FOR SELECT
  USING (public.can_view_private_financials(district_id) AND public.is_district_member(district_id) OR public.is_admin_user());

DROP POLICY IF EXISTS "district_member_manage_opening_balances" ON public.account_opening_balances;
CREATE POLICY "district_member_manage_opening_balances" ON public.account_opening_balances
  FOR ALL
  USING (public.can_view_private_financials(district_id) AND public.is_district_member(district_id) OR public.is_admin_user())
  WITH CHECK (public.can_view_private_financials(district_id) AND public.is_district_member(district_id) OR public.is_admin_user());
