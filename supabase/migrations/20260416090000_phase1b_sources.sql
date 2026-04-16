-- ============================================================
-- B2.5 + B2.6: Sources hierarchy
--
-- A unified source tree for district, region, assembly,
-- individual, supplier, department, and other counterparties.
-- Supports reparenting within valid hierarchy rules.
-- Cross-district links and cycles are rejected by trigger.
-- ============================================================

DO $$ BEGIN
  CREATE TYPE public.source_type AS ENUM (
    'district',
    'region',
    'assembly',
    'individual',
    'supplier',
    'department',
    'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.sources (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  district_id UUID NOT NULL REFERENCES public.districts(id) ON DELETE CASCADE,
  parent_id   UUID REFERENCES public.sources(id) ON DELETE SET NULL,
  type        public.source_type NOT NULL,
  name        TEXT NOT NULL CHECK (btrim(name) <> ''),
  code        TEXT,
  phone       TEXT,
  email       TEXT,
  address     TEXT,
  notes       TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (code IS NULL OR btrim(code) <> '')
);

CREATE INDEX IF NOT EXISTS idx_sources_district        ON public.sources(district_id);
CREATE INDEX IF NOT EXISTS idx_sources_parent          ON public.sources(parent_id);
CREATE INDEX IF NOT EXISTS idx_sources_district_active ON public.sources(district_id, is_active);
CREATE INDEX IF NOT EXISTS idx_sources_district_type   ON public.sources(district_id, type);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sources_district_code
  ON public.sources(district_id, lower(code))
  WHERE code IS NOT NULL AND btrim(code) <> '';

-- ── integrity trigger ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.validate_source_parent()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_parent_district UUID;
  v_ancestor_id     UUID;
  v_depth           INT := 0;
BEGIN
  IF NEW.parent_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Parent must not be the row itself
  IF NEW.parent_id = NEW.id THEN
    RAISE EXCEPTION 'A source cannot be its own parent';
  END IF;

  -- Parent must be in the same district
  SELECT district_id INTO v_parent_district
  FROM public.sources
  WHERE id = NEW.parent_id;

  IF v_parent_district IS DISTINCT FROM NEW.district_id THEN
    RAISE EXCEPTION 'Parent source must belong to the same district';
  END IF;

  -- Cycle detection (max depth 20)
  v_ancestor_id := NEW.parent_id;
  WHILE v_ancestor_id IS NOT NULL AND v_depth < 20 LOOP
    IF v_ancestor_id = NEW.id THEN
      RAISE EXCEPTION 'Circular parent reference detected';
    END IF;
    SELECT parent_id INTO v_ancestor_id FROM public.sources WHERE id = v_ancestor_id;
    v_depth := v_depth + 1;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_source_parent ON public.sources;
CREATE TRIGGER trg_validate_source_parent
  BEFORE INSERT OR UPDATE OF parent_id ON public.sources
  FOR EACH ROW EXECUTE FUNCTION public.validate_source_parent();

DROP TRIGGER IF EXISTS trg_sources_updated_at ON public.sources;
CREATE TRIGGER trg_sources_updated_at
  BEFORE UPDATE ON public.sources
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── RLS ──────────────────────────────────────────────────────

ALTER TABLE public.sources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_manage_sources"          ON public.sources;
DROP POLICY IF EXISTS "district_member_manage_sources" ON public.sources;

CREATE POLICY "admin_manage_sources" ON public.sources
  FOR ALL USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

CREATE POLICY "district_member_manage_sources" ON public.sources
  FOR ALL
  USING  (public.is_district_member(district_id))
  WITH CHECK (public.is_district_member(district_id));
