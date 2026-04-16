-- ============================================================
-- Drop legacy income and expenses tables
--
-- The application now uses cashbook_transactions as the sole
-- source of truth for financial records. The income and expenses
-- tables are no longer read or written by any app code.
--
-- income_categories and expense_categories are retained because
-- the budget category autocomplete still references them.
--
-- validate_fund_district_match() is retained because it is still
-- active on the budgets table.
-- ============================================================

-- Triggers are dropped automatically when their table is dropped.
-- RLS policies and indexes on these tables are dropped the same way.

DROP TABLE IF EXISTS public.income   CASCADE;
DROP TABLE IF EXISTS public.expenses CASCADE;

-- validate_account_transaction_match was only ever used by the
-- income and expenses account-match triggers.
DROP FUNCTION IF EXISTS public.validate_account_transaction_match();
