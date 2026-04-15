-- Add multi-currency and payment method support
-- Currencies: USD (US Dollar), ZAR (South African Rand), ZWG (Zimbabwe Gold)
-- Payment methods: cash, bank (transfer), ecocash (mobile money)

CREATE TYPE public.currency_code AS ENUM ('USD', 'ZAR', 'ZWG');
CREATE TYPE public.payment_method AS ENUM ('cash', 'bank', 'ecocash');

ALTER TABLE public.income
  ADD COLUMN currency public.currency_code NOT NULL DEFAULT 'USD',
  ADD COLUMN payment_method public.payment_method NOT NULL DEFAULT 'cash';

ALTER TABLE public.expenses
  ADD COLUMN currency public.currency_code NOT NULL DEFAULT 'USD',
  ADD COLUMN payment_method public.payment_method NOT NULL DEFAULT 'cash';

-- Budgets only need currency — a budget is a target amount in a given currency,
-- not a specific payment transaction.
ALTER TABLE public.budgets
  ADD COLUMN currency public.currency_code NOT NULL DEFAULT 'USD';

-- Indexes for the primary reporting access pattern: fund_id + currency
CREATE INDEX IF NOT EXISTS idx_income_fund_currency ON public.income(fund_id, currency);
CREATE INDEX IF NOT EXISTS idx_expenses_fund_currency ON public.expenses(fund_id, currency);
CREATE INDEX IF NOT EXISTS idx_budgets_fund_currency ON public.budgets(fund_id, currency);
