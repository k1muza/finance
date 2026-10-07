-- ============================================================
-- Workflow for collections without drafts:
--
--   recorded   saved by a scoped secretary; final, awaiting hand-over
--   submitted  Accounting Officer / Assistant confirms the money
--              reached the office
--   posted     every line posted to a fund as a cashbook receipt
--   voided     withdrawn before posting (recorded → voided by the
--              secretary or finance; submitted → voided by finance
--              while no line is posted)
--
-- Header and lines are written together by record_collection(), so a
-- collection can never be changed after it is saved. Nothing is ever
-- hard-deleted.
-- ============================================================

-- ── atomic recording ─────────────────────────────────────────

-- Runs as the caller, so the RLS insert policies (can_record_collection)
-- still apply. Lines may only be inserted inside this call.
CREATE OR REPLACE FUNCTION public.record_collection(p_collection JSONB, p_lines JSONB)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'A collection needs at least one line.';
  END IF;

  INSERT INTO public.collections (district_id, scope_member_id, collected_on, reference, notes, currency)
  VALUES (
    (p_collection->>'district_id')::UUID,
    (p_collection->>'scope_member_id')::UUID,
    (p_collection->>'collected_on')::DATE,
    NULLIF(btrim(p_collection->>'reference'), ''),
    NULLIF(btrim(p_collection->>'notes'), ''),
    p_collection->>'currency'
  )
  RETURNING id INTO v_id;

  PERFORM set_config('app.recording_collection', v_id::TEXT, TRUE);

  INSERT INTO public.collection_lines (collection_id, collection_type_id, member_id, contributor_name, amount)
  SELECT
    v_id,
    (line->>'collection_type_id')::UUID,
    NULLIF(line->>'member_id', '')::UUID,
    NULLIF(btrim(line->>'contributor_name'), ''),
    (line->>'amount')::NUMERIC
  FROM jsonb_array_elements(p_lines) AS line;

  PERFORM set_config('app.recording_collection', '', TRUE);
  RETURN v_id;
END;
$$;

-- ── workflow guards ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.enforce_collection_workflow()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_scope_type public.member_type;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Collections cannot be deleted. Void it instead.';
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'recorded' THEN
      RAISE EXCEPTION 'New collections must start as recorded.';
    END IF;

    SELECT type INTO v_scope_type
    FROM public.members
    WHERE id = NEW.scope_member_id AND district_id = NEW.district_id;

    IF v_scope_type IS NULL OR v_scope_type NOT IN ('region', 'assembly', 'department') THEN
      RAISE EXCEPTION 'A collection must belong to a region, assembly or ministry in this district.';
    END IF;

    RETURN NEW;
  END IF;

  -- UPDATE
  IF OLD.status IN ('posted', 'voided') THEN
    RAISE EXCEPTION 'A % collection cannot be changed.', OLD.status;
  END IF;

  IF NEW.district_id IS DISTINCT FROM OLD.district_id
     OR NEW.scope_member_id IS DISTINCT FROM OLD.scope_member_id
     OR NEW.collected_on IS DISTINCT FROM OLD.collected_on
     OR NEW.reference IS DISTINCT FROM OLD.reference
     OR NEW.notes IS DISTINCT FROM OLD.notes
     OR NEW.currency IS DISTINCT FROM OLD.currency
     OR NEW.recorded_by IS DISTINCT FROM OLD.recorded_by THEN
    RAISE EXCEPTION 'Collections cannot be edited once saved. Void it and record it again.';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF OLD.status = 'recorded' AND NEW.status = 'submitted' THEN
      IF NOT public.can_handle_collections(NEW.district_id) THEN
        RAISE EXCEPTION 'Only the Accounting Officer or Assistant can mark a collection as submitted.';
      END IF;
    ELSIF OLD.status = 'submitted' AND NEW.status = 'posted' THEN
      IF NOT public.can_handle_collections(NEW.district_id) THEN
        RAISE EXCEPTION 'Only the Accounting Officer or Assistant can post collections.';
      END IF;
      IF EXISTS (
        SELECT 1 FROM public.collection_lines
        WHERE collection_id = NEW.id AND cashbook_transaction_id IS NULL
      ) THEN
        RAISE EXCEPTION 'Every line must be posted before the collection is marked posted.';
      END IF;
    ELSIF OLD.status = 'recorded' AND NEW.status = 'voided' THEN
      IF NOT (
        public.can_handle_collections(NEW.district_id)
        OR public.can_record_collection(NEW.district_id, NEW.scope_member_id)
      ) THEN
        RAISE EXCEPTION 'You cannot void this collection.';
      END IF;
    ELSIF OLD.status = 'submitted' AND NEW.status = 'voided' THEN
      IF NOT public.can_handle_collections(NEW.district_id) THEN
        RAISE EXCEPTION 'Only the Accounting Officer or Assistant can void a submitted collection.';
      END IF;
      IF EXISTS (
        SELECT 1 FROM public.collection_lines
        WHERE collection_id = NEW.id AND cashbook_transaction_id IS NOT NULL
      ) THEN
        RAISE EXCEPTION 'Part of this collection is already posted, so it cannot be voided. Reverse the cashbook receipts instead.';
      END IF;
    ELSE
      RAISE EXCEPTION 'Cannot move a collection from % to %.', OLD.status, NEW.status;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_collection_workflow ON public.collections;
CREATE TRIGGER trg_enforce_collection_workflow
  BEFORE INSERT OR UPDATE OR DELETE ON public.collections
  FOR EACH ROW EXECUTE FUNCTION public.enforce_collection_workflow();

-- Lines are written once, inside record_collection(). The only later
-- change is linking a line to its cashbook receipt while submitted.
CREATE OR REPLACE FUNCTION public.enforce_collection_line_editability()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_status public.collection_status;
  v_district_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Collection lines cannot be deleted.';
  END IF;

  SELECT status, district_id INTO v_status, v_district_id
  FROM public.collections
  WHERE id = NEW.collection_id;

  IF TG_OP = 'INSERT' THEN
    IF current_setting('app.recording_collection', TRUE) IS DISTINCT FROM NEW.collection_id::TEXT THEN
      RAISE EXCEPTION 'Collection lines can only be added when the collection is recorded.';
    END IF;
    IF NEW.cashbook_transaction_id IS NOT NULL THEN
      RAISE EXCEPTION 'Lines are linked to the cashbook only when posting.';
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE: only linking an unposted line to its receipt.
  IF v_status = 'submitted'
     AND OLD.cashbook_transaction_id IS NULL
     AND NEW.cashbook_transaction_id IS NOT NULL
     AND NEW.collection_id = OLD.collection_id
     AND NEW.collection_type_id = OLD.collection_type_id
     AND NEW.member_id IS NOT DISTINCT FROM OLD.member_id
     AND NEW.contributor_name IS NOT DISTINCT FROM OLD.contributor_name
     AND NEW.amount = OLD.amount THEN
    IF NOT public.can_handle_collections(v_district_id) THEN
      RAISE EXCEPTION 'Only the Accounting Officer or Assistant can post collections.';
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Collection lines cannot be edited once saved. Void the collection and record it again.';
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_collection_line_editability ON public.collection_lines;
CREATE TRIGGER trg_enforce_collection_line_editability
  BEFORE INSERT OR UPDATE OR DELETE ON public.collection_lines
  FOR EACH ROW EXECUTE FUNCTION public.enforce_collection_line_editability();

-- ── RLS ──────────────────────────────────────────────────────

ALTER TABLE public.collections ALTER COLUMN status SET DEFAULT 'recorded';

-- Secretaries may only void their own recorded collections; the
-- trigger limits which columns and transitions are allowed.
DROP POLICY IF EXISTS "scoped_update_collections" ON public.collections;
CREATE POLICY "scoped_update_collections"
  ON public.collections FOR UPDATE
  USING (
    public.can_handle_collections(district_id)
    OR (status = 'recorded' AND public.can_record_collection(district_id, scope_member_id))
  )
  WITH CHECK (
    public.can_handle_collections(district_id)
    OR public.can_record_collection(district_id, scope_member_id)
  );

DROP POLICY IF EXISTS "scoped_delete_collections" ON public.collections;

DROP POLICY IF EXISTS "scoped_write_collection_lines" ON public.collection_lines;
CREATE POLICY "scoped_insert_collection_lines"
  ON public.collection_lines FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.collections c
    WHERE c.id = collection_id
      AND public.can_record_collection(c.district_id, c.scope_member_id)
  ));
