-- ============================================================
-- CERTIFICATES — Contribution achievement tiers
-- Run this in the Supabase SQL Editor after schema.sql.
-- ============================================================

CREATE TABLE certificates (
  id              UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            TEXT         NOT NULL UNIQUE,
  min_amount      NUMERIC(12,2),          -- NULL = no lower bound
  max_amount      NUMERIC(12,2),          -- NULL = no upper bound (open-ended)
  is_grand_prize  BOOLEAN      NOT NULL DEFAULT false,  -- awarded to rank #1
  sort_order      INTEGER      NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_certificates_updated_at
  BEFORE UPDATE ON certificates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all" ON certificates FOR ALL USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────
-- SEED
-- ─────────────────────────────────────────
INSERT INTO certificates (name, min_amount, max_amount, is_grand_prize, sort_order) VALUES
  ('Bronze',        25,   50,   false, 1),
  ('Silver',        50,   100,  false, 2),
  ('Gold',          100,  200,  false, 3),
  ('Platinum',      200,  300,  false, 4),
  ('Diamond',       300,  NULL, false, 5),
  ('Grand Diamond', NULL, NULL, true,  6);

-- ─────────────────────────────────────────
-- UPDATED LEADERBOARD VIEW
-- Replaces the view from schema.sql.
-- Assigns Grand Diamond to rank #1;
-- all others get the highest tier whose
-- range contains their contribution.
-- ─────────────────────────────────────────
CREATE OR REPLACE VIEW leaderboard AS
WITH ranked AS (
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
  LEFT JOIN departments d ON d.id = p.department_id
)
SELECT
  ranked.*,
  CASE
    WHEN ranked.rank = 1 THEN (
      SELECT c.name FROM certificates c WHERE c.is_grand_prize = true LIMIT 1
    )
    ELSE (
      SELECT c.name FROM certificates c
      WHERE  c.is_grand_prize = false
        AND  ranked.contribution >= COALESCE(c.min_amount, 0)
        AND  (c.max_amount IS NULL OR ranked.contribution < c.max_amount)
      ORDER BY COALESCE(c.min_amount, 0) DESC
      LIMIT 1
    )
  END AS certificate_name
FROM ranked;
