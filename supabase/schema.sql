-- ============================================================
-- CONFERENCE MANAGEMENT DASHBOARD — Supabase Schema
-- Run this in the Supabase SQL Editor
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─────────────────────────────────────────
-- DISTRICTS
-- ─────────────────────────────────────────
CREATE TABLE districts (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- REGIONS
-- ─────────────────────────────────────────
CREATE TABLE regions (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  district_id  UUID NOT NULL REFERENCES districts(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_regions_district ON regions(district_id);

-- ─────────────────────────────────────────
-- DEPARTMENTS
-- ─────────────────────────────────────────
CREATE TABLE departments (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL UNIQUE,
  hod         TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- PEOPLE / ATTENDEES
-- ─────────────────────────────────────────
CREATE TABLE people (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            TEXT NOT NULL,
  phone           TEXT,
  gender          TEXT CHECK (gender IN ('male', 'female', 'other')),
  region_id       UUID REFERENCES regions(id) ON DELETE CASCADE,
  department_id   UUID REFERENCES departments(id) ON DELETE SET NULL,
  contribution    NUMERIC(12, 2) NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_people_region       ON people(region_id);
CREATE INDEX idx_people_department   ON people(department_id);
CREATE INDEX idx_people_contribution ON people(contribution DESC);

-- ─────────────────────────────────────────
-- DAYS
-- ─────────────────────────────────────────
CREATE TABLE days (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  district_id  UUID NOT NULL REFERENCES districts(id) ON DELETE CASCADE,
  date         DATE NOT NULL,
  label        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (district_id, date)
);

CREATE INDEX idx_days_district ON days(district_id);

-- ─────────────────────────────────────────
-- SESSIONS
-- ─────────────────────────────────────────
CREATE TABLE sessions (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  day_id              UUID NOT NULL REFERENCES days(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  start_time          TIME NOT NULL,
  allocated_duration  INTEGER NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sessions_day ON sessions(day_id);

-- ─────────────────────────────────────────
-- EVENTS
-- ─────────────────────────────────────────
CREATE TABLE events (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id        UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  title             TEXT NOT NULL,
  allocated_person  UUID REFERENCES people(id) ON DELETE SET NULL,
  start_time        TIME NOT NULL,
  duration          INTEGER NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_events_session ON events(session_id);
CREATE INDEX idx_events_person  ON events(allocated_person);

-- ─────────────────────────────────────────
-- MEALS
-- ─────────────────────────────────────────
CREATE TABLE meals (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  day_id          UUID NOT NULL REFERENCES days(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  scheduled_time  TIME NOT NULL,
  duration        INTEGER NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_meals_day ON meals(day_id);

-- ─────────────────────────────────────────
-- PERSON ROLES
-- Links people to leadership roles in districts or regions.
-- A person can hold multiple roles across different entities.
-- ─────────────────────────────────────────
CREATE TABLE person_roles (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  person_id    UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  entity_type  TEXT NOT NULL CHECK (entity_type IN ('district', 'region')),
  entity_id    UUID NOT NULL,
  role         TEXT NOT NULL CHECK (role IN ('chairperson', 'vice_chairperson', 'secretary', 'vice_secretary')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (entity_type, entity_id, role)
);

CREATE INDEX idx_person_roles_entity ON person_roles(entity_type, entity_id);
CREATE INDEX idx_person_roles_person ON person_roles(person_id);

-- Enforce membership: person must belong to the entity they hold a role in
CREATE OR REPLACE FUNCTION validate_person_role()
RETURNS TRIGGER AS $$
DECLARE
  person_region_id    UUID;
  region_district_id  UUID;
BEGIN
  SELECT region_id INTO person_region_id FROM people WHERE id = NEW.person_id;

  IF NEW.entity_type = 'region' THEN
    IF person_region_id IS NULL OR person_region_id != NEW.entity_id THEN
      RAISE EXCEPTION 'Person is not a member of this region';
    END IF;
  ELSIF NEW.entity_type = 'district' THEN
    IF person_region_id IS NULL THEN
      RAISE EXCEPTION 'Person has no region assignment';
    END IF;
    SELECT district_id INTO region_district_id FROM regions WHERE id = person_region_id;
    IF region_district_id IS NULL OR region_district_id != NEW.entity_id THEN
      RAISE EXCEPTION 'Person is not associated with this district';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_person_role
  BEFORE INSERT OR UPDATE ON person_roles
  FOR EACH ROW EXECUTE FUNCTION validate_person_role();

-- ─────────────────────────────────────────
-- AUTO-UPDATE updated_at TRIGGER
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'districts','regions','departments','people',
    'days','sessions','events','meals'
  ] LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_%I_updated_at
       BEFORE UPDATE ON %I
       FOR EACH ROW EXECUTE FUNCTION update_updated_at()',
      tbl, tbl
    );
  END LOOP;
END;
$$;

-- ─────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────
ALTER TABLE districts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE regions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE people       ENABLE ROW LEVEL SECURITY;
ALTER TABLE days         ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE events       ENABLE ROW LEVEL SECURITY;
ALTER TABLE meals        ENABLE ROW LEVEL SECURITY;
ALTER TABLE person_roles ENABLE ROW LEVEL SECURITY;

-- Open admin policies — tighten once auth is configured
CREATE POLICY "admin_all" ON districts    FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "admin_all" ON regions      FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "admin_all" ON departments  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "admin_all" ON people       FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "admin_all" ON days         FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "admin_all" ON sessions     FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "admin_all" ON events       FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "admin_all" ON meals        FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "admin_all" ON person_roles FOR ALL USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────
-- LEADERBOARD VIEW
-- ─────────────────────────────────────────
-- Leaderboard view is defined in migrate_leaderboard_v3.sql (uses PARTITION BY district)
