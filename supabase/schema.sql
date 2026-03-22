-- ============================================================
-- CONFERENCE MANAGEMENT DASHBOARD — Supabase Schema
-- Run this in the Supabase SQL Editor
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─────────────────────────────────────────
-- DISTRICTS
-- ─────────────────────────────────────────
CREATE TABLE districts (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name              TEXT NOT NULL,
  chairperson       TEXT NOT NULL,
  vice_chairperson  TEXT,
  secretary         TEXT,
  vice_secretary    TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- REGIONS
-- ─────────────────────────────────────────
CREATE TABLE regions (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  district_id       UUID NOT NULL REFERENCES districts(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  chairperson       TEXT NOT NULL,
  vice_chairperson  TEXT,
  secretary         TEXT,
  vice_secretary    TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
  region_id       UUID REFERENCES regions(id) ON DELETE SET NULL,
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
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date        DATE NOT NULL UNIQUE,
  label       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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
ALTER TABLE districts   ENABLE ROW LEVEL SECURITY;
ALTER TABLE regions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE people      ENABLE ROW LEVEL SECURITY;
ALTER TABLE days        ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE events      ENABLE ROW LEVEL SECURITY;
ALTER TABLE meals       ENABLE ROW LEVEL SECURITY;

-- Open admin policies — tighten once auth is configured
CREATE POLICY "admin_all" ON districts   FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "admin_all" ON regions     FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "admin_all" ON departments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "admin_all" ON people      FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "admin_all" ON days        FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "admin_all" ON sessions    FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "admin_all" ON events      FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "admin_all" ON meals       FOR ALL USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────
-- LEADERBOARD VIEW
-- ─────────────────────────────────────────
CREATE OR REPLACE VIEW leaderboard AS
SELECT
  p.id,
  p.name,
  p.gender,
  p.contribution,
  r.name  AS region_name,
  d.name  AS department_name,
  RANK() OVER (ORDER BY p.contribution DESC) AS rank
FROM people p
LEFT JOIN regions     r ON r.id = p.region_id
LEFT JOIN departments d ON d.id = p.department_id;
