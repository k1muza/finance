// GET  /api/districts/[id]/members  — list active + inactive members
// POST /api/districts/[id]/members  — add member by email

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import type { DistrictRole } from '@/lib/auth/permissions'

type Params = { params: Promise<{ id: string }> }

async function resolveCallerAccess(supabase: ReturnType<typeof createServerClient>, token: string, districtId: string) {
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return { user: null, authorized: false }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('is_superuser')
    .eq('id', user.id)
    .single()

  if (profile?.is_superuser) return { user, authorized: true }

  const { data: membership } = await supabase
    .from('district_users')
    .select('role')
    .eq('district_id', districtId)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  const authorized = membership?.role === 'admin'
  return { user, authorized }
}

export async function GET(req: NextRequest, { params }: Params) {
  const { id: districtId } = await params
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServerClient()
  const { user, authorized } = await resolveCallerAccess(supabase, token, districtId)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!authorized) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: memberships, error } = await supabase
    .from('district_users')
    .select('user_id, role, is_active, created_at, invited_by')
    .eq('district_id', districtId)
    .order('created_at')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const memberIds = (memberships ?? []).map((m) => m.user_id)

  // Fetch display names from user_profiles
  const { data: profiles } = await supabase
    .from('user_profiles')
    .select('id, display_name')
    .in('id', memberIds)

  const displayNames: Record<string, string | null> = {}
  for (const p of profiles ?? []) displayNames[p.id] = p.display_name

  // Fetch emails from auth admin API
  const emails: Record<string, string> = {}
  for (const uid of memberIds) {
    const { data } = await supabase.auth.admin.getUserById(uid)
    if (data?.user?.email) emails[uid] = data.user.email
  }

  const members = (memberships ?? []).map((m) => ({
    user_id: m.user_id,
    role: m.role,
    is_active: m.is_active,
    created_at: m.created_at,
    display_name: displayNames[m.user_id] ?? null,
    email: emails[m.user_id] ?? null,
  }))

  return NextResponse.json({ members })
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id: districtId } = await params
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServerClient()
  const { user, authorized } = await resolveCallerAccess(supabase, token, districtId)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!authorized) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: { email?: string; role?: DistrictRole }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { email, role } = body
  if (!email) return NextResponse.json({ error: 'email is required' }, { status: 400 })
  if (!role) return NextResponse.json({ error: 'role is required' }, { status: 400 })

  const validRoles: DistrictRole[] = ['admin', 'secretary', 'treasurer', 'clerk', 'auditor', 'viewer']
  if (!validRoles.includes(role)) {
    return NextResponse.json({ error: `Invalid role: ${role}` }, { status: 400 })
  }

  // Look up user by email via admin API
  const { data: listData } = await supabase.auth.admin.listUsers()
  const targetUser = listData?.users?.find((u) => u.email === email)
  if (!targetUser) {
    return NextResponse.json({ error: 'No user found with that email address' }, { status: 404 })
  }

  // Check for existing membership (active or inactive)
  const { data: existing } = await supabase
    .from('district_users')
    .select('user_id, is_active')
    .eq('district_id', districtId)
    .eq('user_id', targetUser.id)
    .single()

  if (existing?.is_active) {
    return NextResponse.json({ error: 'User is already an active member of this district' }, { status: 409 })
  }

  if (existing) {
    // Reactivate with new role
    const { error } = await supabase
      .from('district_users')
      .update({ role, is_active: true, invited_by: user.id })
      .eq('district_id', districtId)
      .eq('user_id', targetUser.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    // New membership
    const { error } = await supabase
      .from('district_users')
      .insert({ district_id: districtId, user_id: targetUser.id, role, is_active: true, invited_by: user.id })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Ensure user_profiles row exists (it may not for legacy users)
  await supabase
    .from('user_profiles')
    .upsert({ id: targetUser.id, is_superuser: false }, { onConflict: 'id', ignoreDuplicates: true })

  return NextResponse.json({
    member: {
      user_id: targetUser.id,
      role,
      is_active: true,
      email: targetUser.email,
      display_name: null,
    }
  }, { status: 201 })
}
