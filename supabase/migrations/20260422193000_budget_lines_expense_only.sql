DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'budget_lines'
      AND column_name = 'budget_kind'
  ) AND EXISTS (
    SELECT 1
    FROM public.budget_lines
    WHERE budget_kind <> 'expense'
  ) THEN
    RAISE EXCEPTION
      'Cannot migrate budget lines to expense-only while non-expense budget lines exist. Remove or convert them first.';
  END IF;
END
$$;

DROP INDEX IF EXISTS public.idx_budget_lines_district_kind_currency;
DROP INDEX IF EXISTS public.idx_budget_lines_unique_scope;

ALTER TABLE public.budget_lines
  DROP COLUMN IF EXISTS budget_kind;

CREATE INDEX IF NOT EXISTS idx_budget_lines_district_currency
  ON public.budget_lines(district_id, currency);

CREATE UNIQUE INDEX IF NOT EXISTS idx_budget_lines_unique_scope
  ON public.budget_lines(
    budget_id,
    fund_id,
    currency,
    COALESCE(scope_member_id, '00000000-0000-0000-0000-000000000000'::UUID)
  );

CREATE OR REPLACE FUNCTION public.validate_budget_line_district_match()
RETURNS TRIGGER AS $$
DECLARE
  v_budget_district UUID;
  v_fund_district UUID;
  v_fund_nature public.fund_nature;
  v_member_district UUID;
BEGIN
  SELECT district_id
  INTO v_budget_district
  FROM public.budgets
  WHERE id = NEW.budget_id;

  IF v_budget_district IS NULL THEN
    RAISE EXCEPTION 'Selected budget does not exist';
  END IF;

  IF v_budget_district <> NEW.district_id THEN
    RAISE EXCEPTION 'Budget line district must match the parent budget';
  END IF;

  SELECT district_id, nature
  INTO v_fund_district, v_fund_nature
  FROM public.funds
  WHERE id = NEW.fund_id;

  IF v_fund_district IS NULL THEN
    RAISE EXCEPTION 'Selected fund does not exist';
  END IF;

  IF v_fund_district <> NEW.district_id THEN
    RAISE EXCEPTION 'Selected fund must belong to the same district';
  END IF;

  IF v_fund_nature = 'income_only' THEN
    RAISE EXCEPTION 'Income-only funds cannot be used for expense budgets';
  END IF;

  IF NEW.scope_member_id IS NOT NULL THEN
    SELECT district_id
    INTO v_member_district
    FROM public.members
    WHERE id = NEW.scope_member_id;

    IF v_member_district IS NULL THEN
      RAISE EXCEPTION 'Selected member scope does not exist';
    END IF;

    IF v_member_district <> NEW.district_id THEN
      RAISE EXCEPTION 'Selected member scope must belong to the same district';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
