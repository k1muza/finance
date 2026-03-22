-- ============================================================
-- PROGRAMME MEDIA — Addendum to schema.sql
-- Adds YouTube videos, speaker commentaries, and photos
-- to individual programme events (order-of-service items).
-- Run this AFTER schema.sql in the Supabase SQL Editor.
-- ============================================================

-- ─────────────────────────────────────────
-- EVENT VIDEOS (YouTube)
-- ─────────────────────────────────────────
CREATE TABLE event_videos (
  id          UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id    UUID    NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  youtube_id  TEXT    NOT NULL,   -- 11-char YouTube video ID, e.g. "dQw4w9WgXcQ"
  title       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_event_videos_event ON event_videos(event_id);

-- ─────────────────────────────────────────
-- EVENT COMMENTARIES (speaker nuggets)
-- ─────────────────────────────────────────
CREATE TABLE event_commentaries (
  id            UUID  PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id      UUID  NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  -- speaker_id is optional: links to people table for known attendees;
  -- leave NULL for guest speakers and use speaker_name instead.
  speaker_id    UUID  REFERENCES people(id) ON DELETE SET NULL,
  speaker_name  TEXT,   -- display name override / guest speaker fallback
  body          TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_event_commentaries_event   ON event_commentaries(event_id);
CREATE INDEX idx_event_commentaries_speaker ON event_commentaries(speaker_id);

-- ─────────────────────────────────────────
-- EVENT PHOTOS
-- ─────────────────────────────────────────
CREATE TABLE event_photos (
  id          UUID  PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id    UUID  NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  -- url holds the public URL (Supabase Storage or external CDN)
  url         TEXT  NOT NULL,
  caption     TEXT,
  taken_at    TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_event_photos_event ON event_photos(event_id);

-- ─────────────────────────────────────────
-- AUTO-UPDATE updated_at TRIGGERS
-- (reuses the function already in schema.sql)
-- ─────────────────────────────────────────
DO $$
DECLARE tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'event_videos', 'event_commentaries', 'event_photos'
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
ALTER TABLE event_videos        ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_commentaries  ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_photos        ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all" ON event_videos        FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "admin_all" ON event_commentaries  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "admin_all" ON event_photos        FOR ALL USING (true) WITH CHECK (true);
