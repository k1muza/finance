-- ============================================================
-- District cashbook workflow settings
-- Adds an opt-in flag for single-operator cashbook posting
-- and allows district admins to update their own district row.
-- ============================================================

ALTER TABLE public.districts
  ADD COLUMN IF NOT EXISTS auto_post_cashbook_transactions BOOLEAN NOT NULL DEFAULT FALSE;

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
      AND role = 'admin'
  );
$$;

DROP POLICY IF EXISTS "district_admin_manage_district" ON public.districts;
CREATE POLICY "district_admin_manage_district" ON public.districts
  FOR UPDATE
  USING (public.is_district_admin(id) OR public.is_admin_user())
  WITH CHECK (public.is_district_admin(id) OR public.is_admin_user());
