-- ============================================================
-- B1.4: Replace legacy RLS helpers with membership-aware equivalents
--
-- 1. is_admin_user()  → checks user_profiles.is_superuser
-- 2. is_district_member(UUID) → new membership check
-- 3. current_district_id()  → deprecated, returns NULL
-- 4. All district-scoped table policies updated
-- ============================================================

-- ── updated helpers ───────────────────────────────────────────

-- is_admin_user() now reflects the new user_profiles.is_superuser flag.
-- All existing policies that call this function pick up the change
-- automatically without needing their SQL text rewritten.
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND is_superuser = TRUE
  );
$$;

-- New helper: true when the calling user is an active member of the district.
CREATE OR REPLACE FUNCTION public.is_district_member(p_district_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.district_users
    WHERE district_id = p_district_id
      AND user_id = auth.uid()
      AND is_active = TRUE
  );
$$;

-- Deprecate current_district_id() — meaningless in the multi-district model.
-- Policies below have been updated to use is_district_member() instead.
-- This stub keeps any existing compiled policy bodies from erroring.
CREATE OR REPLACE FUNCTION public.current_district_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NULL::UUID;
$$;

-- ── districts ─────────────────────────────────────────────────

DROP POLICY IF EXISTS "district_read_own_district" ON public.districts;
CREATE POLICY "district_member_read_district" ON public.districts
  FOR SELECT
  USING (public.is_district_member(id) OR public.is_admin_user());

-- ── funds ─────────────────────────────────────────────────────

DROP POLICY IF EXISTS "district_manage_own_funds" ON public.funds;
CREATE POLICY "district_member_manage_funds" ON public.funds
  FOR ALL
  USING (public.is_district_member(district_id) OR public.is_admin_user())
  WITH CHECK (public.is_district_member(district_id) OR public.is_admin_user());

-- ── budgets ───────────────────────────────────────────────────

DROP POLICY IF EXISTS "district_manage_own_budgets" ON public.budgets;
CREATE POLICY "district_member_manage_budgets" ON public.budgets
  FOR ALL
  USING (public.is_district_member(district_id) OR public.is_admin_user())
  WITH CHECK (public.is_district_member(district_id) OR public.is_admin_user());

-- ── accounts ──────────────────────────────────────────────────

DROP POLICY IF EXISTS "district_manage_own_accounts" ON public.accounts;
CREATE POLICY "district_member_manage_accounts" ON public.accounts
  FOR ALL
  USING (public.is_district_member(district_id) OR public.is_admin_user())
  WITH CHECK (public.is_district_member(district_id) OR public.is_admin_user());

-- ── account_opening_balances ──────────────────────────────────

DROP POLICY IF EXISTS "district_manage_own_opening_balances" ON public.account_opening_balances;
CREATE POLICY "district_member_manage_opening_balances" ON public.account_opening_balances
  FOR ALL
  USING (public.is_district_member(district_id) OR public.is_admin_user())
  WITH CHECK (public.is_district_member(district_id) OR public.is_admin_user());

-- ── cashbook_transactions ─────────────────────────────────────

DROP POLICY IF EXISTS "district_manage_own_cashbook_transactions" ON public.cashbook_transactions;
CREATE POLICY "district_member_manage_cashbook_transactions" ON public.cashbook_transactions
  FOR ALL
  USING (public.is_district_member(district_id) OR public.is_admin_user())
  WITH CHECK (public.is_district_member(district_id) OR public.is_admin_user());

-- ── cashbook_transaction_lines ────────────────────────────────

DROP POLICY IF EXISTS "district_read_own_cashbook_lines"  ON public.cashbook_transaction_lines;
DROP POLICY IF EXISTS "district_write_draft_cashbook_lines" ON public.cashbook_transaction_lines;
DROP POLICY IF EXISTS "district_delete_draft_cashbook_lines" ON public.cashbook_transaction_lines;

CREATE POLICY "district_member_read_cashbook_lines" ON public.cashbook_transaction_lines
  FOR SELECT
  USING (
    public.is_admin_user() OR
    EXISTS (
      SELECT 1 FROM public.cashbook_transactions t
      WHERE t.id = transaction_id AND public.is_district_member(t.district_id)
    )
  );

CREATE POLICY "district_member_write_draft_cashbook_lines" ON public.cashbook_transaction_lines
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.cashbook_transactions t
      WHERE t.id = transaction_id
        AND public.is_district_member(t.district_id)
        AND t.status = 'draft'
    )
  );

CREATE POLICY "district_member_delete_draft_cashbook_lines" ON public.cashbook_transaction_lines
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.cashbook_transactions t
      WHERE t.id = transaction_id
        AND public.is_district_member(t.district_id)
        AND t.status = 'draft'
    )
  );

-- ── cashbook_audit_log ────────────────────────────────────────

DROP POLICY IF EXISTS "district_read_own_audit" ON public.cashbook_audit_log;
CREATE POLICY "district_member_read_audit" ON public.cashbook_audit_log
  FOR SELECT
  USING (
    public.is_admin_user() OR
    EXISTS (
      SELECT 1 FROM public.cashbook_transactions t
      WHERE t.id = transaction_id AND public.is_district_member(t.district_id)
    )
  );
