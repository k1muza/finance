-- ============================================================
-- Refactor unified sources into members + counterparties
--
-- 1. Moves internal church hierarchy records to public.members.
-- 2. Moves external suppliers / others to public.counterparties.
-- 3. Renames cashbook transaction fields from source_* to member_*.
-- 4. Renames the tithe-like fund flag to requires_individual_member.
--
-- The migration preserves existing IDs so historical links and posted
-- reporting snapshots remain stable during the transition.
-- ============================================================

DO $$ BEGIN
  CREATE TYPE public.counterparty_type AS ENUM ('supplier', 'other');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.member_type AS ENUM (
    'district',
    'region',
    'assembly',
    'individual',
    'department'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.counterparties (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  district_id UUID NOT NULL REFERENCES public.districts(id) ON DELETE CASCADE,
  type        public.counterparty_type NOT NULL,
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

CREATE INDEX IF NOT EXISTS idx_counterparties_district
  ON public.counterparties(district_id);
CREATE INDEX IF NOT EXISTS idx_counterparties_district_active
  ON public.counterparties(district_id, is_active);
CREATE INDEX IF NOT EXISTS idx_counterparties_district_type
  ON public.counterparties(district_id, type);
CREATE UNIQUE INDEX IF NOT EXISTS idx_counterparties_district_code
  ON public.counterparties(district_id, lower(code))
  WHERE code IS NOT NULL AND btrim(code) <> '';

DROP TRIGGER IF EXISTS trg_counterparties_updated_at ON public.counterparties;
CREATE TRIGGER trg_counterparties_updated_at
  BEFORE UPDATE ON public.counterparties
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.counterparties ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_manage_counterparties" ON public.counterparties;
DROP POLICY IF EXISTS "district_member_manage_counterparties" ON public.counterparties;

CREATE POLICY "admin_manage_counterparties" ON public.counterparties
  FOR ALL USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

CREATE POLICY "district_member_manage_counterparties" ON public.counterparties
  FOR ALL
  USING (public.is_district_member(district_id))
  WITH CHECK (public.is_district_member(district_id));

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'sources'
  ) THEN
    INSERT INTO public.counterparties (
      id,
      district_id,
      type,
      name,
      code,
      phone,
      email,
      address,
      notes,
      is_active,
      created_at,
      updated_at
    )
    SELECT
      id,
      district_id,
      type::text::public.counterparty_type,
      name,
      code,
      phone,
      email,
      address,
      notes,
      is_active,
      created_at,
      updated_at
    FROM public.sources
    WHERE type::text IN ('supplier', 'other')
    ON CONFLICT (id) DO UPDATE
    SET
      district_id = EXCLUDED.district_id,
      type = EXCLUDED.type,
      name = EXCLUDED.name,
      code = EXCLUDED.code,
      phone = EXCLUDED.phone,
      email = EXCLUDED.email,
      address = EXCLUDED.address,
      notes = EXCLUDED.notes,
      is_active = EXCLUDED.is_active,
      updated_at = EXCLUDED.updated_at;
  END IF;
END $$;

ALTER TABLE public.cashbook_transactions
  ADD COLUMN IF NOT EXISTS counterparty_id UUID REFERENCES public.counterparties(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_cashbook_txn_counterparty_id
  ON public.cashbook_transactions(counterparty_id)
  WHERE counterparty_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cashbook_txn_district_counterparty
  ON public.cashbook_transactions(district_id, counterparty_id)
  WHERE counterparty_id IS NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'sources'
  ) AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'cashbook_transactions'
      AND column_name = 'source_id'
  ) THEN
    UPDATE public.cashbook_transactions AS txn
    SET counterparty_id = txn.source_id
    FROM public.sources AS source
    WHERE source.id = txn.source_id
      AND source.type::text IN ('supplier', 'other')
      AND txn.counterparty_id IS NULL;

    UPDATE public.cashbook_transactions AS txn
    SET source_id = NULL
    FROM public.sources AS source
    WHERE source.id = txn.source_id
      AND source.type::text IN ('supplier', 'other');

    DELETE FROM public.sources
    WHERE type::text IN ('supplier', 'other');
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'funds'
      AND column_name = 'requires_individual_source'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'funds'
      AND column_name = 'requires_individual_member'
  ) THEN
    ALTER TABLE public.funds
      RENAME COLUMN requires_individual_source TO requires_individual_member;
  END IF;
END $$;

ALTER TABLE public.funds
  ADD COLUMN IF NOT EXISTS requires_individual_member BOOLEAN NOT NULL DEFAULT FALSE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'sources'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'members'
  ) THEN
    ALTER TABLE public.sources RENAME TO members;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'members'
      AND column_name = 'type'
      AND udt_name = 'source_type'
  ) THEN
    ALTER TABLE public.members
      ALTER COLUMN type TYPE TEXT USING type::text;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'members'
      AND column_name = 'type'
      AND udt_name <> 'member_type'
  ) THEN
    ALTER TABLE public.members
      ALTER COLUMN type TYPE public.member_type USING type::public.member_type;
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_validate_source_parent ON public.members;
DROP TRIGGER IF EXISTS trg_validate_member_parent ON public.members;
DROP TRIGGER IF EXISTS trg_sources_updated_at ON public.members;
DROP TRIGGER IF EXISTS trg_members_updated_at ON public.members;

DROP FUNCTION IF EXISTS public.validate_source_parent();

CREATE OR REPLACE FUNCTION public.validate_member_parent()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_parent_district UUID;
  v_parent_type     public.member_type;
  v_ancestor_id     UUID;
  v_depth           INT := 0;
BEGIN
  IF NEW.parent_id IS NULL THEN
    IF NEW.type IN ('assembly', 'individual') THEN
      RAISE EXCEPTION 'This member type requires a parent member';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.parent_id = NEW.id THEN
    RAISE EXCEPTION 'A member cannot be its own parent';
  END IF;

  SELECT district_id, type
  INTO v_parent_district, v_parent_type
  FROM public.members
  WHERE id = NEW.parent_id;

  IF v_parent_district IS DISTINCT FROM NEW.district_id THEN
    RAISE EXCEPTION 'Parent member must belong to the same district';
  END IF;

  IF NEW.type = 'district' THEN
    RAISE EXCEPTION 'District members cannot have a parent';
  ELSIF NEW.type = 'region' AND v_parent_type <> 'district' THEN
    RAISE EXCEPTION 'Region members may only belong to a district member';
  ELSIF NEW.type = 'assembly' AND v_parent_type <> 'region' THEN
    RAISE EXCEPTION 'Assembly members must belong to a region member';
  ELSIF NEW.type = 'individual' AND v_parent_type <> 'assembly' THEN
    RAISE EXCEPTION 'Individual members must belong to an assembly member';
  ELSIF NEW.type = 'department' AND v_parent_type NOT IN ('district', 'region', 'assembly') THEN
    RAISE EXCEPTION 'Departments may only belong to district, region, or assembly members';
  END IF;

  v_ancestor_id := NEW.parent_id;
  WHILE v_ancestor_id IS NOT NULL AND v_depth < 20 LOOP
    IF v_ancestor_id = NEW.id THEN
      RAISE EXCEPTION 'Circular parent reference detected';
    END IF;
    SELECT parent_id INTO v_ancestor_id FROM public.members WHERE id = v_ancestor_id;
    v_depth := v_depth + 1;
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_member_parent
  BEFORE INSERT OR UPDATE OF parent_id, type ON public.members
  FOR EACH ROW EXECUTE FUNCTION public.validate_member_parent();

CREATE TRIGGER trg_members_updated_at
  BEFORE UPDATE ON public.members
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_manage_sources" ON public.members;
DROP POLICY IF EXISTS "district_member_manage_sources" ON public.members;
DROP POLICY IF EXISTS "admin_manage_members" ON public.members;
DROP POLICY IF EXISTS "district_member_manage_members" ON public.members;

CREATE POLICY "admin_manage_members" ON public.members
  FOR ALL USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

CREATE POLICY "district_member_manage_members" ON public.members
  FOR ALL
  USING (public.is_district_member(district_id))
  WITH CHECK (public.is_district_member(district_id));

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'cashbook_transactions'
      AND column_name = 'source_id'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'cashbook_transactions'
      AND column_name = 'member_id'
  ) THEN
    ALTER TABLE public.cashbook_transactions RENAME COLUMN source_id TO member_id;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'cashbook_transactions'
      AND column_name = 'assembly_snapshot_id'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'cashbook_transactions'
      AND column_name = 'assembly_member_snapshot_id'
  ) THEN
    ALTER TABLE public.cashbook_transactions
      RENAME COLUMN assembly_snapshot_id TO assembly_member_snapshot_id;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'cashbook_transactions'
      AND column_name = 'region_snapshot_id'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'cashbook_transactions'
      AND column_name = 'region_member_snapshot_id'
  ) THEN
    ALTER TABLE public.cashbook_transactions
      RENAME COLUMN region_snapshot_id TO region_member_snapshot_id;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'cashbook_transactions'
      AND column_name = 'source_name_snapshot'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'cashbook_transactions'
      AND column_name = 'member_name_snapshot'
  ) THEN
    ALTER TABLE public.cashbook_transactions
      RENAME COLUMN source_name_snapshot TO member_name_snapshot;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'cashbook_transactions'
      AND column_name = 'source_type_snapshot'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'cashbook_transactions'
      AND column_name = 'member_type_snapshot'
  ) THEN
    ALTER TABLE public.cashbook_transactions
      RENAME COLUMN source_type_snapshot TO member_type_snapshot;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'cashbook_transactions'
      AND column_name = 'source_parent_name_snapshot'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'cashbook_transactions'
      AND column_name = 'member_parent_name_snapshot'
  ) THEN
    ALTER TABLE public.cashbook_transactions
      RENAME COLUMN source_parent_name_snapshot TO member_parent_name_snapshot;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'cashbook_transactions_source_id_fkey'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'cashbook_transactions_member_id_fkey'
  ) THEN
    ALTER TABLE public.cashbook_transactions
      RENAME CONSTRAINT cashbook_transactions_source_id_fkey TO cashbook_transactions_member_id_fkey;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'cashbook_transactions_assembly_snapshot_id_fkey'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'cashbook_transactions_assembly_member_snapshot_id_fkey'
  ) THEN
    ALTER TABLE public.cashbook_transactions
      RENAME CONSTRAINT cashbook_transactions_assembly_snapshot_id_fkey TO cashbook_transactions_assembly_member_snapshot_id_fkey;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'cashbook_transactions_region_snapshot_id_fkey'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'cashbook_transactions_region_member_snapshot_id_fkey'
  ) THEN
    ALTER TABLE public.cashbook_transactions
      RENAME CONSTRAINT cashbook_transactions_region_snapshot_id_fkey TO cashbook_transactions_region_member_snapshot_id_fkey;
  END IF;
END $$;

ALTER INDEX IF EXISTS public.idx_cashbook_txn_source_id
  RENAME TO idx_cashbook_txn_member_id;
ALTER INDEX IF EXISTS public.idx_cashbook_txn_district_source
  RENAME TO idx_cashbook_txn_district_member;
ALTER INDEX IF EXISTS public.idx_cashbook_txn_district_assembly_snapshot
  RENAME TO idx_cashbook_txn_district_assembly_member_snapshot;
ALTER INDEX IF EXISTS public.idx_cashbook_txn_district_region_snapshot
  RENAME TO idx_cashbook_txn_district_region_member_snapshot;

CREATE INDEX IF NOT EXISTS idx_cashbook_txn_member_id
  ON public.cashbook_transactions(member_id)
  WHERE member_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cashbook_txn_district_member
  ON public.cashbook_transactions(district_id, member_id)
  WHERE member_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cashbook_txn_district_assembly_member_snapshot
  ON public.cashbook_transactions(district_id, assembly_member_snapshot_id)
  WHERE assembly_member_snapshot_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cashbook_txn_district_region_member_snapshot
  ON public.cashbook_transactions(district_id, region_member_snapshot_id)
  WHERE region_member_snapshot_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'cashbook_transactions_one_party_ck'
  ) THEN
    ALTER TABLE public.cashbook_transactions
      ADD CONSTRAINT cashbook_transactions_one_party_ck
      CHECK (
        member_id IS NULL
        OR counterparty_id IS NULL
      );
  END IF;
END $$;
