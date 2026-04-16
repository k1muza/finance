-- ============================================================
-- Add source snapshot columns to cashbook_transactions
--
-- Populated at posting time so historical reports retain the
-- source's name and hierarchy even if the source record is
-- later renamed or restructured.
-- ============================================================

ALTER TABLE public.cashbook_transactions
  ADD COLUMN IF NOT EXISTS source_name_snapshot        TEXT,
  ADD COLUMN IF NOT EXISTS source_type_snapshot        TEXT,
  ADD COLUMN IF NOT EXISTS source_parent_name_snapshot TEXT;
