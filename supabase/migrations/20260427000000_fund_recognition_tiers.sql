CREATE TABLE IF NOT EXISTS public.fund_recognition_tiers (
  id             UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  fund_id        UUID            NOT NULL REFERENCES public.funds(id) ON DELETE CASCADE,
  name           TEXT            NOT NULL,
  min_amount     NUMERIC(15, 2)  NOT NULL CHECK (min_amount >= 0),
  currency       TEXT            NOT NULL,
  color          TEXT            NOT NULL DEFAULT 'amber',
  display_order  INTEGER         NOT NULL DEFAULT 0,
  is_active      BOOLEAN         NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ     NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ     NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fund_recognition_tiers_fund
  ON public.fund_recognition_tiers(fund_id);

DROP TRIGGER IF EXISTS trg_fund_recognition_tiers_updated_at ON public.fund_recognition_tiers;
CREATE TRIGGER trg_fund_recognition_tiers_updated_at
  BEFORE UPDATE ON public.fund_recognition_tiers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.fund_recognition_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "district_member_read_recognition_tiers"
  ON public.fund_recognition_tiers FOR SELECT
  USING (
    public.is_district_member(
      (SELECT district_id FROM public.funds WHERE id = fund_id)
    ) OR public.is_admin_user()
  );

CREATE POLICY "district_admin_insert_recognition_tiers"
  ON public.fund_recognition_tiers FOR INSERT
  WITH CHECK (
    public.can_manage_budget_drafts(
      (SELECT district_id FROM public.funds WHERE id = fund_id)
    )
  );

CREATE POLICY "district_admin_update_recognition_tiers"
  ON public.fund_recognition_tiers FOR UPDATE
  USING (
    public.can_manage_budget_drafts(
      (SELECT district_id FROM public.funds WHERE id = fund_id)
    )
  )
  WITH CHECK (
    public.can_manage_budget_drafts(
      (SELECT district_id FROM public.funds WHERE id = fund_id)
    )
  );

CREATE POLICY "district_admin_delete_recognition_tiers"
  ON public.fund_recognition_tiers FOR DELETE
  USING (
    public.can_manage_budget_drafts(
      (SELECT district_id FROM public.funds WHERE id = fund_id)
    )
  );
