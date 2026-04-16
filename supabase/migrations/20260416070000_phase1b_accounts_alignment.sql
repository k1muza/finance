-- ============================================================
-- B2.3: Align accounts table to spec
-- Adds sort_order, institution details, and 'savings' account type
-- ============================================================

ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS sort_order                 INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS institution_name           TEXT,
  ADD COLUMN IF NOT EXISTS institution_account_number TEXT;

-- Expand the account type constraint to include 'savings'
ALTER TABLE public.accounts DROP CONSTRAINT IF EXISTS accounts_type_check;
ALTER TABLE public.accounts ADD CONSTRAINT accounts_type_check
  CHECK (type IN ('cash', 'bank', 'mobile_money', 'petty_cash', 'savings'));

-- Update the order clause in SELECT queries via a default sort
CREATE INDEX IF NOT EXISTS idx_accounts_sort ON public.accounts(district_id, sort_order, name);
