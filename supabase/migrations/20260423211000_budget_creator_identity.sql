CREATE OR REPLACE FUNCTION public.enforce_budget_creator_identity()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF auth.uid() IS NOT NULL THEN
      NEW.created_by_user_id := auth.uid();
    END IF;

    RETURN NEW;
  END IF;

  IF auth.uid() IS NOT NULL
     AND NEW.created_by_user_id IS DISTINCT FROM OLD.created_by_user_id THEN
    RAISE EXCEPTION 'Budget creator cannot be changed';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_budget_headers_creator_identity ON public.budgets;
CREATE TRIGGER trg_budget_headers_creator_identity
  BEFORE INSERT OR UPDATE OF created_by_user_id ON public.budgets
  FOR EACH ROW EXECUTE FUNCTION public.enforce_budget_creator_identity();
