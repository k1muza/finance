-- ─────────────────────────────────────────
-- PROFILES
-- Links each Supabase Auth user to a district and role.
-- role = 'admin'    → can see and manage all districts
-- role = 'district' → scoped to their district_id
-- ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  district_id UUID REFERENCES districts(id) ON DELETE SET NULL,
  role        TEXT NOT NULL DEFAULT 'district' CHECK (role IN ('admin', 'district')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
-- Users can read their own profile; service-role key handles writes
CREATE POLICY "users_read_own_profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "admin_all_profiles"     ON profiles FOR ALL   USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────
-- NOTE: Do NOT add triggers on auth.users —
-- they interfere with GoTrue's internal queries.
-- Profile rows are created by the seed script (npm run seed:admin)
-- or manually via the SQL Editor after creating a user in the
-- Supabase Dashboard → Authentication → Users.
-- ─────────────────────────────────────────
-- HOW TO SET UP USERS
--
-- 1. Create a user in Supabase Dashboard → Authentication → Users
--    → "Add user" → "Create new user" (tick Auto Confirm)
--
-- 2. Copy the UUID shown next to the new user, then run:
--
--    INSERT INTO profiles (id, district_id, role)
--    VALUES ('<uuid>', '<district-uuid-or-NULL>', 'district')
--    ON CONFLICT (id) DO UPDATE SET role = 'district', district_id = '<district-uuid>';
--
-- 3. To make someone admin (sees all districts):
--
--    INSERT INTO profiles (id, district_id, role)
--    VALUES ('<uuid>', NULL, 'admin')
--    ON CONFLICT (id) DO UPDATE SET role = 'admin', district_id = NULL;
-- ─────────────────────────────────────────
