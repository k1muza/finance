-- ============================================================
-- NOTIFICATIONS — Push notification history + device tokens
-- Run this in the Supabase SQL Editor after schema.sql.
-- ============================================================

-- FCM tokens registered by Flutter devices
CREATE TABLE device_tokens (
  id          UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  token       TEXT         NOT NULL UNIQUE,
  platform    TEXT         CHECK (platform IN ('android', 'ios')),
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_device_tokens_updated_at
  BEFORE UPDATE ON device_tokens
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE device_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all" ON device_tokens FOR ALL USING (true) WITH CHECK (true);

-- History of sent notifications
CREATE TABLE notifications (
  id               UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  title            TEXT         NOT NULL,
  body             TEXT         NOT NULL,
  type             TEXT         CHECK (type IN ('announcement', 'programme', 'song', 'general')),
  recipient_count  INTEGER      NOT NULL DEFAULT 0,
  sent_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all" ON notifications FOR ALL USING (true) WITH CHECK (true);
