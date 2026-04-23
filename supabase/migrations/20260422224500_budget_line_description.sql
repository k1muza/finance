DROP INDEX IF EXISTS public.idx_budget_lines_unique_scope;

ALTER TABLE public.budget_lines
  ADD COLUMN IF NOT EXISTS line_description TEXT;

UPDATE public.budget_lines
SET line_description = 'General'
WHERE line_description IS NULL
   OR char_length(BTRIM(line_description)) = 0;

ALTER TABLE public.budget_lines
  ALTER COLUMN line_description SET NOT NULL;

ALTER TABLE public.budget_lines
  DROP CONSTRAINT IF EXISTS budget_lines_line_description_not_blank;

ALTER TABLE public.budget_lines
  ADD CONSTRAINT budget_lines_line_description_not_blank
  CHECK (char_length(BTRIM(line_description)) > 0);

CREATE UNIQUE INDEX IF NOT EXISTS idx_budget_lines_unique_scope
  ON public.budget_lines(
    budget_id,
    fund_id,
    currency,
    COALESCE(scope_member_id, '00000000-0000-0000-0000-000000000000'::UUID),
    LOWER(BTRIM(line_description))
  );
