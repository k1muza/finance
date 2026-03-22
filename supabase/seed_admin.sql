-- ─────────────────────────────────────────
-- SEED: Super Admin User
--
-- Supabase does not allow direct INSERT into auth.users from the SQL Editor.
-- Follow these two steps instead:
--
-- STEP 1 — Create the auth user via the Supabase Dashboard:
--   1. Go to your project → Authentication → Users
--   2. Click "Add user" → "Create new user"
--   3. Email:    ado@gmail.com
--      Password: Conference2026!
--   4. Check "Auto Confirm User"
--   5. Click "Create User"
--   6. Copy the UUID shown next to the new user (you'll need it below)
--
-- STEP 2 — Run the SQL below, replacing <paste-user-uuid-here> with the UUID:
-- ─────────────────────────────────────────

UPDATE profiles
SET role        = 'admin',
    district_id = NULL
WHERE id = '<paste-user-uuid-here>';

-- ─────────────────────────────────────────
-- If the profile row was not auto-created (trigger may not have fired yet),
-- use INSERT instead:
--
-- INSERT INTO profiles (id, district_id, role)
-- VALUES ('<paste-user-uuid-here>', NULL, 'admin')
-- ON CONFLICT (id) DO UPDATE SET role = 'admin', district_id = NULL;
-- ─────────────────────────────────────────
