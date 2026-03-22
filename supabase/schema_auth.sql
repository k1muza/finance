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
-- Auto-create a profile row when a user signs up
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, district_id, role)
  VALUES (NEW.id, NULL, 'district')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ─────────────────────────────────────────
-- HOW TO SET UP USERS (run in SQL Editor)
--
-- 1. Create a user in Supabase Dashboard → Authentication → Users
--    (or via Auth API / sign-up page)
--
-- 2. Assign them a district and role:
--
--    UPDATE profiles
--    SET district_id = '<district-uuid>',
--        role        = 'district'
--    WHERE id = '<auth-user-uuid>';
--
-- 3. To make someone admin (sees all districts):
--
--    UPDATE profiles
--    SET role = 'admin', district_id = NULL
--    WHERE id = '<auth-user-uuid>';
-- ─────────────────────────────────────────
