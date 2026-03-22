-- ============================================================
-- SONGS — Worship song lyrics
-- Run this in the Supabase SQL Editor after schema.sql.
-- ============================================================

CREATE TABLE songs (
  id          UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  title       TEXT         NOT NULL,
  author      TEXT,
  song_key    TEXT,                        -- musical key, e.g. "G", "Bb", "F#m"
  lyrics      TEXT,                        -- plain text; newlines preserved
  sort_order  INTEGER      NOT NULL DEFAULT 0,
  published   BOOLEAN      NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_songs_title ON songs(title);

CREATE TRIGGER trg_songs_updated_at
  BEFORE UPDATE ON songs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE songs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all" ON songs FOR ALL USING (true) WITH CHECK (true);
