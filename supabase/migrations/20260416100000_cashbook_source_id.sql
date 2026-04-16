-- ============================================================
-- Link cashbook_transactions to sources (members / counterparties)
--
-- Adds source_id to cashbook_transactions as a nullable FK to the
-- sources table. Replaces the free-text counterparty field for
-- structured member attribution (individuals, assemblies, regions,
-- suppliers, etc.).
--
-- The counterparty column is kept for backwards compatibility and
-- for transactions where a free-text name is sufficient (e.g. a
-- one-off cash donor whose details are not in the sources table).
-- ============================================================

ALTER TABLE public.cashbook_transactions
  ADD COLUMN IF NOT EXISTS source_id UUID REFERENCES public.sources(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_cashbook_txn_source_id
  ON public.cashbook_transactions(source_id)
  WHERE source_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cashbook_txn_district_source
  ON public.cashbook_transactions(district_id, source_id)
  WHERE source_id IS NOT NULL;
