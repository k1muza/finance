-- ============================================================
-- Collections no longer have a draft stage: a secretary's save is
-- final. 'open' becomes 'recorded' (awaiting hand-over), and
-- mistakes are corrected by voiding and recording again — never by
-- editing or deleting.
--
-- Enum changes only; the workflow rules that use 'voided' follow in
-- 20261007110100_collections_without_drafts_rules.sql because a new
-- enum value cannot be used in the transaction that adds it.
-- ============================================================

ALTER TYPE public.collection_status RENAME VALUE 'open' TO 'recorded';
ALTER TYPE public.collection_status ADD VALUE IF NOT EXISTS 'voided';

ALTER TABLE public.collections
  ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS voided_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
