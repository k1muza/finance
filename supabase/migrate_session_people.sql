-- Migration: session MCs and session managers
-- Run this in the Supabase SQL Editor

CREATE TABLE session_people (
  session_id  UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  person_id   UUID NOT NULL REFERENCES people(id)   ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('mc', 'session_manager')),
  PRIMARY KEY (session_id, person_id, role)
);

CREATE INDEX idx_session_people_session ON session_people(session_id);
CREATE INDEX idx_session_people_person  ON session_people(person_id);

ALTER TABLE session_people ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all" ON session_people FOR ALL USING (true) WITH CHECK (true);
