-- ─────────────────────────────────────────
-- LEADERBOARD v4 — adds rank-movement tracking
-- via a snapshots table and updated view.
-- Run this after migrate_leaderboard_v3.sql.
-- ─────────────────────────────────────────

-- 1. Snapshots table ----------------------------------------
CREATE TABLE IF NOT EXISTS leaderboard_snapshots (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  person_id   uuid        NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  district_id uuid,
  rank        int         NOT NULL,
  total       numeric     NOT NULL,
  snapshot_at timestamptz DEFAULT now()
);

-- Fast look-up of the latest snapshot per person
CREATE INDEX IF NOT EXISTS idx_lb_snapshots_person_time
  ON leaderboard_snapshots (person_id, snapshot_at DESC);

-- 2. Snapshot function --------------------------------------
-- Call via supabase.rpc('take_leaderboard_snapshot') to
-- freeze the current rankings as a baseline for movers.
CREATE OR REPLACE FUNCTION take_leaderboard_snapshot()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  INSERT INTO leaderboard_snapshots (person_id, district_id, rank, total)
  SELECT id, district_id, rank::int, contribution
  FROM leaderboard;
$$;

-- 3. Updated leaderboard view with rank_change --------------
DROP VIEW IF EXISTS leaderboard;

CREATE VIEW leaderboard AS
WITH contrib AS (
  SELECT person_id, COALESCE(SUM(amount), 0) AS total
  FROM contributions
  GROUP BY person_id
),
ranked AS (
  SELECT
    p.id,
    p.name,
    p.gender,
    COALESCE(c.total, 0)  AS contribution,
    r.name                AS region_name,
    r.district_id,
    d.name                AS department_name,
    RANK() OVER (
      PARTITION BY r.district_id
      ORDER BY COALESCE(c.total, 0) DESC
    ) AS rank
  FROM people p
  LEFT JOIN regions     r ON r.id = p.region_id
  LEFT JOIN departments d ON d.id = p.department_id
  LEFT JOIN contrib     c ON c.person_id = p.id
),
latest_snapshot AS (
  -- One row per person: the most recent snapshot rank
  SELECT DISTINCT ON (person_id)
    person_id,
    rank AS prev_rank
  FROM leaderboard_snapshots
  ORDER BY person_id, snapshot_at DESC
)
SELECT
  ranked.*,
  CASE
    WHEN ranked.rank = 1 THEN (
      SELECT cert.name FROM certificates cert WHERE cert.is_grand_prize = true LIMIT 1
    )
    ELSE (
      SELECT cert.name FROM certificates cert
      WHERE  cert.is_grand_prize = false
        AND  ranked.contribution >= COALESCE(cert.min_amount, 0)
        AND  (cert.max_amount IS NULL OR ranked.contribution < cert.max_amount)
      ORDER BY COALESCE(cert.min_amount, 0) DESC
      LIMIT 1
    )
  END AS certificate_name,
  ls.prev_rank,
  -- positive = moved up, negative = moved down, null = no snapshot yet
  (ls.prev_rank - ranked.rank::int) AS rank_change
FROM ranked
LEFT JOIN latest_snapshot ls ON ls.person_id = ranked.id;
