-- ─────────────────────────────────────────
-- CONTRIBUTIONS
-- Each row is one contribution entry for a person.
-- A trigger keeps people.contribution in sync with the SUM.
-- ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS contributions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  person_id   UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  amount      NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  note        TEXT,
  date        DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contributions_person ON contributions(person_id);
CREATE INDEX IF NOT EXISTS idx_contributions_date   ON contributions(date DESC);

-- ─────────────────────────────────────────
-- TRIGGER: keep people.contribution = SUM of their contributions
-- ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION sync_contribution_total()
RETURNS TRIGGER AS $$
DECLARE
  target_person_id UUID;
BEGIN
  -- For DELETE the new row is NULL, so we use OLD
  target_person_id := COALESCE(NEW.person_id, OLD.person_id);

  UPDATE people
  SET contribution = (
    SELECT COALESCE(SUM(amount), 0)
    FROM contributions
    WHERE person_id = target_person_id
  )
  WHERE id = target_person_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_contribution ON contributions;
CREATE TRIGGER trg_sync_contribution
  AFTER INSERT OR UPDATE OR DELETE ON contributions
  FOR EACH ROW EXECUTE FUNCTION sync_contribution_total();

-- ─────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────
ALTER TABLE contributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_contributions"  ON contributions FOR SELECT USING (true);
CREATE POLICY "admin_all_contributions"    ON contributions FOR ALL   USING (true) WITH CHECK (true);
