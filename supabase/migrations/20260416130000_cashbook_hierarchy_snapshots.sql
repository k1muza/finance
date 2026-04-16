-- ============================================================
-- Add assembly and region snapshot references to cashbook rows
--
-- These snapshot IDs are populated at posting time so hierarchy-based
-- reports remain historically stable even when source trees change later.
-- ============================================================

ALTER TABLE public.cashbook_transactions
  ADD COLUMN IF NOT EXISTS assembly_snapshot_id UUID REFERENCES public.sources(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS region_snapshot_id   UUID REFERENCES public.sources(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_cashbook_txn_district_assembly_snapshot
  ON public.cashbook_transactions(district_id, assembly_snapshot_id)
  WHERE assembly_snapshot_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cashbook_txn_district_region_snapshot
  ON public.cashbook_transactions(district_id, region_snapshot_id)
  WHERE region_snapshot_id IS NOT NULL;
