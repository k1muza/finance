import { createClient } from '@supabase/supabase-js'

const supabaseUrl    = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const anonKey        = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !serviceRoleKey || !anonKey) {
  console.error('Missing env vars in .env.local')
  process.exit(1)
}

const EMAIL    = 'ado@gmail.com'
const PASSWORD = 'Conference2026!'

// Admin client (service role)
const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ── Try to find the user first (idempotent) ──────────────────────────────────
console.log('Checking for existing user …')
const { data: { users }, error: listErr } = await admin.auth.admin.listUsers()
if (listErr) { console.error('listUsers error:', listErr.message); process.exit(1) }

let existingUser = users.find(u => u.email === EMAIL)

if (existingUser) {
  console.log(`User already exists — ID: ${existingUser.id}`)
  await setAdminProfile(existingUser.id)
} else {
  // ── Attempt 1: admin.createUser ────────────────────────────────────────────
  console.log('Creating user via admin API …')
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email:         EMAIL,
    password:      PASSWORD,
    email_confirm: true,
  })

  if (!createErr) {
    console.log(`✓ Created — ID: ${created.user.id}`)
    await setAdminProfile(created.user.id)
  } else {
    console.warn(`admin.createUser failed: ${createErr.message}`)
    console.log('Trying signUp fallback …')

    // ── Attempt 2: public signUp ───────────────────────────────────────────
    const anon = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: signedUp, error: signupErr } = await anon.auth.signUp({
      email:    EMAIL,
      password: PASSWORD,
    })

    if (signupErr) {
      console.error(`signUp also failed: ${signupErr.message}`)
      console.error('\n── Manual fallback ─────────────────────────────────────────')
      console.error('  1. Go to Supabase Dashboard → Authentication → Users')
      console.error(`  2. Click "Add user" → enter email: ${EMAIL}  password: ${PASSWORD}`)
      console.error('  3. Check "Auto Confirm User" and click "Create User"')
      console.error('  4. Copy the user UUID, then run in the SQL Editor:')
      console.error(`     INSERT INTO profiles (id, district_id, role)`)
      console.error(`     VALUES ('<uuid>', NULL, 'admin')`)
      console.error(`     ON CONFLICT (id) DO UPDATE SET role = 'admin', district_id = NULL;`)
      process.exit(1)
    }

    const userId = signedUp.user?.id
    if (!userId) {
      console.error('signUp returned no user ID.')
      process.exit(1)
    }

    // Confirm the email via admin API
    await admin.auth.admin.updateUserById(userId, { email_confirm: true })
    console.log(`✓ Signed up and confirmed — ID: ${userId}`)
    await setAdminProfile(userId)
  }
}

async function setAdminProfile(userId) {
  const { error } = await admin
    .from('profiles')
    .upsert({ id: userId, district_id: null, role: 'admin' }, { onConflict: 'id' })

  if (error) {
    console.error('Profile upsert failed:', error.message)
    console.error('Hint: run schema_auth.sql in the Supabase SQL Editor first.')
    process.exit(1)
  }

  console.log('\n✓ Done!')
  console.log(`  Email:    ${EMAIL}`)
  console.log(`  Password: ${PASSWORD}`)
  console.log(`  Role:     admin (all districts)`)
}
