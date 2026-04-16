-- ============================================================
-- B2.4: Align funds table to spec
-- Adds code, nature, is_active, requires_individual_source
-- ============================================================

DO $$ BEGIN
  CREATE TYPE public.fund_nature AS ENUM ('income_only', 'expense_only', 'mixed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.funds
  ADD COLUMN IF NOT EXISTS code                      TEXT,
  ADD COLUMN IF NOT EXISTS nature                    public.fund_nature NOT NULL DEFAULT 'mixed',
  ADD COLUMN IF NOT EXISTS is_active                 BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS requires_individual_source BOOLEAN NOT NULL DEFAULT FALSE;

-- Unique per-district fund code (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS idx_funds_district_code
  ON public.funds(district_id, lower(code))
  WHERE code IS NOT NULL AND btrim(code) <> '';
