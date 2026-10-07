-- ============================================================
-- Collections — money gathered by regions, assemblies and
-- ministries, kept apart from the ledger until it is handed over.
--
--   open       recorded by a scoped secretary; editable, deletable
--   submitted  Accounting Officer / Assistant confirms the money
--              reached the office; locked
--   posted     every line has been posted to a fund as a cashbook
--              receipt (cashbook_transaction_id set per line)
--
-- A submitted collection may step back to open only while none of
-- its lines are posted. Posted collections are immutable; corrections
-- go through cashbook reversal (see AGENTS.md).
-- Role checks mirror src/lib/auth/permissions.ts.
-- ============================================================

DO $$ BEGIN
  CREATE TYPE public.collection_status AS ENUM ('open', 'submitted', 'posted');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── tables ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.collection_types (
  id                 UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  district_id        UUID         NOT NULL REFERENCES public.districts(id) ON DELETE CASCADE,
  name               TEXT         NOT NULL,
  code               TEXT,
  -- Default fund when posting; collections stay separate from funds.
  suggested_fund_id  UUID         REFERENCES public.funds(id) ON DELETE SET NULL,
  is_active          BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT collection_types_name_not_blank CHECK (btrim(name) <> '')
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_collection_types_district_name
  ON public.collection_types(district_id, lower(name));

CREATE TABLE IF NOT EXISTS public.collections (
  id               UUID                      PRIMARY KEY DEFAULT gen_random_uuid(),
  district_id      UUID                      NOT NULL REFERENCES public.districts(id) ON DELETE CASCADE,
  -- Region, assembly or ministry (department-type member) the money came from.
  scope_member_id  UUID                      NOT NULL REFERENCES public.members(id) ON DELETE RESTRICT,
  collected_on     DATE                      NOT NULL,
  reference        TEXT,
  notes            TEXT,
  currency         TEXT                      NOT NULL,
  status           public.collection_status  NOT NULL DEFAULT 'open',
  recorded_by      UUID                      REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  submitted_at     TIMESTAMPTZ,
  received_by      UUID                      REFERENCES auth.users(id) ON DELETE SET NULL,
  posted_at        TIMESTAMPTZ,
  created_at       TIMESTAMPTZ               NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ               NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_collections_district_status
  ON public.collections(district_id, status, collected_on DESC);
CREATE INDEX IF NOT EXISTS idx_collections_scope
  ON public.collections(scope_member_id);

CREATE TABLE IF NOT EXISTS public.collection_lines (
  id                       UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id            UUID           NOT NULL REFERENCES public.collections(id) ON DELETE CASCADE,
  collection_type_id       UUID           NOT NULL REFERENCES public.collection_types(id) ON DELETE RESTRICT,
  -- An individual contributor, or NULL for a lump sum (e.g. loose offering).
  member_id                UUID           REFERENCES public.members(id) ON DELETE RESTRICT,
  contributor_name         TEXT,
  amount                   NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  cashbook_transaction_id  UUID           REFERENCES public.cashbook_transactions(id) ON DELETE RESTRICT,
  created_at               TIMESTAMPTZ    NOT NULL DEFAULT now(),
  CONSTRAINT collection_lines_has_contributor CHECK (
    member_id IS NOT NULL OR btrim(coalesce(contributor_name, '')) <> ''
  )
);

CREATE INDEX IF NOT EXISTS idx_collection_lines_collection
  ON public.collection_lines(collection_id);

DROP TRIGGER IF EXISTS trg_collection_types_updated_at ON public.collection_types;
CREATE TRIGGER trg_collection_types_updated_at
  BEFORE UPDATE ON public.collection_types
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_collections_updated_at ON public.collections;
CREATE TRIGGER trg_collections_updated_at
  BEFORE UPDATE ON public.collections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── capability helpers ───────────────────────────────────────

-- True when p_target is p_scope or sits beneath it in the member tree.
CREATE OR REPLACE FUNCTION public.member_in_scope(p_scope UUID, p_target UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH RECURSIVE ancestors AS (
    SELECT id, parent_id, 1 AS depth FROM public.members WHERE id = p_target
    UNION ALL
    SELECT m.id, m.parent_id, a.depth + 1
    FROM public.members m
    JOIN ancestors a ON m.id = a.parent_id
    WHERE a.depth < 10
  )
  SELECT p_scope IS NOT NULL AND EXISTS (SELECT 1 FROM ancestors WHERE id = p_scope);
$$;

-- collections.submit / collections.post
CREATE OR REPLACE FUNCTION public.can_handle_collections(p_district_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin_user() OR auth.uid() IS NULL OR EXISTS (
    SELECT 1
    FROM public.district_users du
    WHERE du.user_id = auth.uid()
      AND du.district_id = p_district_id
      AND du.is_active = TRUE
      AND du.role IN ('accounting_officer', 'assistant_accounting_officer')
  );
$$;

-- collections.view — district-wide for the pastor, accounting officers
-- and the Finance Committee; own unit for scoped roles.
CREATE OR REPLACE FUNCTION public.can_view_collection(p_district_id UUID, p_scope_member_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin_user() OR auth.uid() IS NULL
    OR public.is_finance_committee_member(p_district_id)
    OR EXISTS (
      SELECT 1
      FROM public.district_users du
      WHERE du.user_id = auth.uid()
        AND du.district_id = p_district_id
        AND du.is_active = TRUE
        AND (
          du.role IN ('district_pastor', 'accounting_officer', 'assistant_accounting_officer')
          OR (
            du.role IN (
              'regional_pastor', 'regional_coordinator', 'regional_secretary',
              'assembly_coordinator', 'assembly_secretary',
              'ministerial_chairperson', 'ministerial_secretary'
            )
            AND public.member_in_scope(du.scope_member_id, p_scope_member_id)
          )
        )
    );
$$;

-- collections.record — scoped secretaries, own unit only.
CREATE OR REPLACE FUNCTION public.can_record_collection(p_district_id UUID, p_scope_member_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin_user() OR EXISTS (
    SELECT 1
    FROM public.district_users du
    WHERE du.user_id = auth.uid()
      AND du.district_id = p_district_id
      AND du.is_active = TRUE
      AND du.role IN ('regional_secretary', 'assembly_secretary', 'ministerial_secretary')
      AND public.member_in_scope(du.scope_member_id, p_scope_member_id)
  );
$$;

-- collections.types.manage
CREATE OR REPLACE FUNCTION public.can_manage_collection_types(p_district_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin_user() OR EXISTS (
    SELECT 1
    FROM public.district_users du
    WHERE du.user_id = auth.uid()
      AND du.district_id = p_district_id
      AND du.is_active = TRUE
      AND du.role IN ('district_pastor', 'accounting_officer', 'assistant_accounting_officer')
  );
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
    IF OLD.status <> 'open' THEN
      RAISE EXCEPTION 'Only open collections can be deleted. Return it to open first.';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'open' THEN
      RAISE EXCEPTION 'New collections must start open.';
    END IF;
  END IF;

  IF TG_OP = 'INSERT' OR NEW.scope_member_id IS DISTINCT FROM OLD.scope_member_id THEN
    SELECT type INTO v_scope_type
    FROM public.members
    WHERE id = NEW.scope_member_id AND district_id = NEW.district_id;

    IF v_scope_type IS NULL OR v_scope_type NOT IN ('region', 'assembly', 'department') THEN
      RAISE EXCEPTION 'A collection must belong to a region, assembly or ministry in this district.';
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'posted' THEN
      RAISE EXCEPTION 'Posted collections cannot be changed. Reverse the cashbook entries instead.';
    END IF;

    IF NEW.status IS DISTINCT FROM OLD.status THEN
      IF NOT (
        (OLD.status = 'open' AND NEW.status = 'submitted')
        OR (OLD.status = 'submitted' AND NEW.status = 'open')
        OR (OLD.status = 'submitted' AND NEW.status = 'posted')
      ) THEN
        RAISE EXCEPTION 'Cannot move a collection from % to %.', OLD.status, NEW.status;
      END IF;

      IF NOT public.can_handle_collections(NEW.district_id) THEN
        RAISE EXCEPTION 'Only the Accounting Officer or Assistant can change a collection''s status.';
      END IF;

      IF NEW.status = 'submitted' AND NOT EXISTS (
        SELECT 1 FROM public.collection_lines WHERE collection_id = NEW.id
      ) THEN
        RAISE EXCEPTION 'Add at least one line before submitting a collection.';
      END IF;

      IF OLD.status = 'submitted' AND NEW.status = 'open' AND EXISTS (
        SELECT 1 FROM public.collection_lines
        WHERE collection_id = NEW.id AND cashbook_transaction_id IS NOT NULL
      ) THEN
        RAISE EXCEPTION 'Part of this collection is already posted, so it cannot be reopened.';
      END IF;

      IF NEW.status = 'posted' AND EXISTS (
        SELECT 1 FROM public.collection_lines
        WHERE collection_id = NEW.id AND cashbook_transaction_id IS NULL
      ) THEN
        RAISE EXCEPTION 'Every line must be posted before the collection is marked posted.';
      END IF;
    ELSIF OLD.status <> 'open' AND (
      NEW.scope_member_id IS DISTINCT FROM OLD.scope_member_id
      OR NEW.collected_on IS DISTINCT FROM OLD.collected_on
      OR NEW.currency IS DISTINCT FROM OLD.currency
      OR NEW.district_id IS DISTINCT FROM OLD.district_id
    ) THEN
      RAISE EXCEPTION 'Submitted collections are locked. Return it to open to make changes.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_collection_workflow ON public.collections;
CREATE TRIGGER trg_enforce_collection_workflow
  BEFORE INSERT OR UPDATE OR DELETE ON public.collections
  FOR EACH ROW EXECUTE FUNCTION public.enforce_collection_workflow();

-- Lines change only while the collection is open. The one exception
-- is linking a line to its cashbook receipt while submitted.
CREATE OR REPLACE FUNCTION public.enforce_collection_line_editability()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_status public.collection_status;
  v_district_id UUID;
BEGIN
  SELECT status, district_id INTO v_status, v_district_id
  FROM public.collections
  WHERE id = COALESCE(NEW.collection_id, OLD.collection_id);

  -- Cascade from deleting an (open) collection: the parent is already gone.
  IF TG_OP = 'DELETE' AND v_status IS NULL THEN
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE'
     AND v_status = 'submitted'
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

  IF v_status IS DISTINCT FROM 'open' THEN
    RAISE EXCEPTION 'Collection lines can only change while the collection is open.';
  END IF;

  IF TG_OP <> 'DELETE' AND NEW.cashbook_transaction_id IS NOT NULL THEN
    RAISE EXCEPTION 'Lines are linked to the cashbook only when posting.';
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_collection_line_editability ON public.collection_lines;
CREATE TRIGGER trg_enforce_collection_line_editability
  BEFORE INSERT OR UPDATE OR DELETE ON public.collection_lines
  FOR EACH ROW EXECUTE FUNCTION public.enforce_collection_line_editability();

-- ── RLS ──────────────────────────────────────────────────────

ALTER TABLE public.collection_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "district_member_read_collection_types" ON public.collection_types;
CREATE POLICY "district_member_read_collection_types"
  ON public.collection_types FOR SELECT
  USING (public.is_district_member(district_id) OR public.is_admin_user());

DROP POLICY IF EXISTS "finance_manage_collection_types" ON public.collection_types;
CREATE POLICY "finance_manage_collection_types"
  ON public.collection_types FOR ALL
  USING (public.can_manage_collection_types(district_id))
  WITH CHECK (public.can_manage_collection_types(district_id));

ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "scoped_read_collections" ON public.collections;
CREATE POLICY "scoped_read_collections"
  ON public.collections FOR SELECT
  USING (public.can_view_collection(district_id, scope_member_id));

DROP POLICY IF EXISTS "scoped_insert_collections" ON public.collections;
CREATE POLICY "scoped_insert_collections"
  ON public.collections FOR INSERT
  WITH CHECK (public.can_record_collection(district_id, scope_member_id));

DROP POLICY IF EXISTS "scoped_update_collections" ON public.collections;
CREATE POLICY "scoped_update_collections"
  ON public.collections FOR UPDATE
  USING (
    public.can_handle_collections(district_id)
    OR (status = 'open' AND public.can_record_collection(district_id, scope_member_id))
  )
  WITH CHECK (
    public.can_handle_collections(district_id)
    OR public.can_record_collection(district_id, scope_member_id)
  );

DROP POLICY IF EXISTS "scoped_delete_collections" ON public.collections;
CREATE POLICY "scoped_delete_collections"
  ON public.collections FOR DELETE
  USING (
    status = 'open' AND (
      public.can_handle_collections(district_id)
      OR public.can_record_collection(district_id, scope_member_id)
    )
  );

ALTER TABLE public.collection_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "scoped_read_collection_lines" ON public.collection_lines;
CREATE POLICY "scoped_read_collection_lines"
  ON public.collection_lines FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.collections c
    WHERE c.id = collection_id AND public.can_view_collection(c.district_id, c.scope_member_id)
  ));

DROP POLICY IF EXISTS "scoped_write_collection_lines" ON public.collection_lines;
CREATE POLICY "scoped_write_collection_lines"
  ON public.collection_lines FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.collections c
    WHERE c.id = collection_id
      AND (
        public.can_handle_collections(c.district_id)
        OR public.can_record_collection(c.district_id, c.scope_member_id)
      )
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.collections c
    WHERE c.id = collection_id
      AND (
        public.can_handle_collections(c.district_id)
        OR public.can_record_collection(c.district_id, c.scope_member_id)
      )
  ));
