-- ============================================================
-- Recreate role-checking functions and policies for the church
-- office roles introduced in 20261006130000.  Each check mirrors
-- the matching action in src/lib/auth/permissions.ts.
-- ============================================================

-- district.settings.manage
CREATE OR REPLACE FUNCTION public.is_district_admin(p_district_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.district_users
    WHERE district_id = p_district_id
      AND user_id = auth.uid()
      AND is_active = TRUE
      AND role = 'district_pastor'
  );
$$;

-- district.users.manage
CREATE OR REPLACE FUNCTION public.can_manage_district_users(p_district_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.district_users
    WHERE district_id = p_district_id
      AND user_id = auth.uid()
      AND is_active = TRUE
      AND role IN ('district_pastor', 'accounting_officer')
  );
$$;

DROP POLICY IF EXISTS "district_admin_manage_memberships" ON public.district_users;
CREATE POLICY "district_admin_manage_memberships" ON public.district_users
  FOR ALL
  USING (public.can_manage_district_users(district_id))
  WITH CHECK (public.can_manage_district_users(district_id));

-- budgets.manage
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
      AND du.role IN (
        'district_pastor',
        'district_secretary',
        'accounting_officer',
        'assistant_accounting_officer'
      )
  );
$$;

-- budgets.activate
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
      AND du.role IN ('district_pastor', 'accounting_officer')
  );
$$;

-- budgets.close
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
      AND du.role IN ('district_pastor', 'accounting_officer')
  );
$$;

-- events.manage
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

ALTER TABLE public.district_users
  ALTER COLUMN role SET DEFAULT 'ministerial_secretary';
