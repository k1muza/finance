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
  name        TEXT NOT NULL UNIQUE,
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
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (district_id, name)
);

CREATE INDEX idx_regions_district ON regions(district_id);

-- ─────────────────────────────────────────
-- DEPARTMENTS
-- ─────────────────────────────────────────
CREATE TABLE departments (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- PEOPLE / ATTENDEES
-- ─────────────────────────────────────────
CREATE TABLE people (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            TEXT NOT NULL,
  phone           TEXT UNIQUE,
  gender          TEXT CHECK (gender IN ('male', 'female', 'other')),
  region_id       UUID REFERENCES regions(id) ON DELETE CASCADE,
  department_id   UUID REFERENCES departments(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_people_region       ON people(region_id);
CREATE INDEX idx_people_department   ON people(department_id);

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
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (day_id, name)
);

CREATE INDEX idx_sessions_day ON sessions(day_id);

-- ─────────────────────────────────────────
-- EVENTS
-- ─────────────────────────────────────────
CREATE TABLE events (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id  UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  start_time  TIME NOT NULL,
  duration    INTEGER NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_events_session ON events(session_id);

-- ─────────────────────────────────────────
-- EVENT PEOPLE
-- Many-to-many: people assigned to an event.
-- ─────────────────────────────────────────
CREATE TABLE event_people (
  event_id   UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  person_id  UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  PRIMARY KEY (event_id, person_id)
);

CREATE INDEX idx_event_people_event  ON event_people(event_id);
CREATE INDEX idx_event_people_person ON event_people(person_id);

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
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (day_id, name)
);

CREATE INDEX idx_meals_day ON meals(day_id);

-- ─────────────────────────────────────────
-- DISTRICT ROLES
-- Leadership assignments scoped to a district.
-- ─────────────────────────────────────────
CREATE TABLE district_roles (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  district_id  UUID NOT NULL REFERENCES districts(id) ON DELETE CASCADE,
  person_id    UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  role         TEXT NOT NULL CHECK (role IN ('chairperson', 'vice_chairperson', 'secretary', 'vice_secretary')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (district_id, role)
);

CREATE INDEX idx_district_roles_district ON district_roles(district_id);
CREATE INDEX idx_district_roles_person   ON district_roles(person_id);

-- Enforce membership: person must belong to the district
CREATE OR REPLACE FUNCTION validate_district_role()
RETURNS TRIGGER AS $$
DECLARE
  person_region_id   UUID;
  region_district_id UUID;
BEGIN
  SELECT region_id INTO person_region_id FROM people WHERE id = NEW.person_id;
  IF person_region_id IS NULL THEN
    RAISE EXCEPTION 'Person has no region assignment';
  END IF;
  SELECT district_id INTO region_district_id FROM regions WHERE id = person_region_id;
  IF region_district_id IS NULL OR region_district_id != NEW.district_id THEN
    RAISE EXCEPTION 'Person is not associated with this district';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_district_role
  BEFORE INSERT OR UPDATE ON district_roles
  FOR EACH ROW EXECUTE FUNCTION validate_district_role();

-- ─────────────────────────────────────────
-- REGION ROLES
-- Leadership assignments scoped to a region.
-- ─────────────────────────────────────────
CREATE TABLE region_roles (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  region_id  UUID NOT NULL REFERENCES regions(id) ON DELETE CASCADE,
  person_id  UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  role       TEXT NOT NULL CHECK (role IN ('chairperson', 'vice_chairperson', 'secretary', 'vice_secretary')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (region_id, role)
);

CREATE INDEX idx_region_roles_region ON region_roles(region_id);
CREATE INDEX idx_region_roles_person ON region_roles(person_id);

-- Enforce membership: person must belong to the region
CREATE OR REPLACE FUNCTION validate_region_role()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM people WHERE id = NEW.person_id AND region_id = NEW.region_id) THEN
    RAISE EXCEPTION 'Person is not a member of this region';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_region_role
  BEFORE INSERT OR UPDATE ON region_roles
  FOR EACH ROW EXECUTE FUNCTION validate_region_role();

-- ─────────────────────────────────────────
-- DEPARTMENT ROLES
-- Role assignments scoped to a department (currently: hod).
-- ─────────────────────────────────────────
CREATE TABLE department_roles (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  person_id     UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  role          TEXT NOT NULL CHECK (role IN ('hod')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (department_id, role)
);

CREATE INDEX idx_department_roles_department ON department_roles(department_id);
CREATE INDEX idx_department_roles_person     ON department_roles(person_id);

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
ALTER TABLE event_people ENABLE ROW LEVEL SECURITY;
ALTER TABLE meals        ENABLE ROW LEVEL SECURITY;
ALTER TABLE district_roles   ENABLE ROW LEVEL SECURITY;
ALTER TABLE region_roles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE department_roles ENABLE ROW LEVEL SECURITY;

-- Open admin policies — tighten once auth is configured
CREATE POLICY "admin_all" ON districts       FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "admin_all" ON regions         FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "admin_all" ON departments     FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "admin_all" ON people          FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "admin_all" ON days            FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "admin_all" ON sessions        FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "admin_all" ON events          FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "admin_all" ON event_people    FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "admin_all" ON meals           FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "admin_all" ON district_roles  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "admin_all" ON region_roles    FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "admin_all" ON department_roles FOR ALL USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────
-- LEADERBOARD VIEW
-- ─────────────────────────────────────────
-- Leaderboard view is defined in migrate_leaderboard_v3.sql (uses PARTITION BY district)
