ALTER TABLE public.income
  ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL;

ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_income_account ON public.income(account_id);
CREATE INDEX IF NOT EXISTS idx_income_account_currency ON public.income(account_id, currency);
CREATE INDEX IF NOT EXISTS idx_expenses_account ON public.expenses(account_id);
CREATE INDEX IF NOT EXISTS idx_expenses_account_currency ON public.expenses(account_id, currency);

CREATE OR REPLACE FUNCTION public.validate_account_transaction_match()
RETURNS TRIGGER AS $$
DECLARE
  account_district_id UUID;
  account_currency public.currency_code;
  account_status TEXT;
BEGIN
  IF NEW.account_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT district_id, currency, status
  INTO account_district_id, account_currency, account_status
  FROM public.accounts
  WHERE id = NEW.account_id;

  IF account_district_id IS NULL THEN
    RAISE EXCEPTION 'Selected account does not exist';
  END IF;

  IF account_district_id <> NEW.district_id THEN
    RAISE EXCEPTION 'Selected account must belong to the same district';
  END IF;

  IF account_currency <> NEW.currency THEN
    RAISE EXCEPTION 'Selected account currency must match the transaction currency';
  END IF;

  IF account_status <> 'active' THEN
    RAISE EXCEPTION 'Selected account must be active';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_income_account_match ON public.income;
CREATE TRIGGER trg_income_account_match
  BEFORE INSERT OR UPDATE OF district_id, account_id, currency ON public.income
  FOR EACH ROW EXECUTE FUNCTION public.validate_account_transaction_match();

DROP TRIGGER IF EXISTS trg_expenses_account_match ON public.expenses;
CREATE TRIGGER trg_expenses_account_match
  BEFORE INSERT OR UPDATE OF district_id, account_id, currency ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.validate_account_transaction_match();
