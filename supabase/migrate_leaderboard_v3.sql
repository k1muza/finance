-- ─────────────────────────────────────────
-- LEADERBOARD v3 — ranks within each district
-- using PARTITION BY r.district_id so a
-- district user's leaderboard shows ranks
-- 1…N within their district only.
-- Run this after migrate_leaderboard_v2.sql.
-- ─────────────────────────────────────────

DROP VIEW IF EXISTS leaderboard;

CREATE VIEW leaderboard AS
WITH contrib AS (
  -- Sum contributions per person from the contributions table
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
  END AS certificate_name
FROM ranked;
