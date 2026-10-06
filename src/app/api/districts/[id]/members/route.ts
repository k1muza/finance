// GET  /api/districts/[id]/members  — list active + inactive members
// POST /api/districts/[id]/members  — add member by email

import { NextRequest, NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { createServerClient } from '@/lib/supabase/server'
import { requireDistrictAction } from '@/lib/auth/server'
import { isDistrictRole } from '@/lib/auth/permissions'
import { ApiRouteError, toErrorResponse } from '@/lib/server/errors'

type Params = { params: Promise<{ id: string }> }

const USERS_PER_PAGE = 1000

/** auth.admin.listUsers is paginated; walk every page so large projects still match. */
async function findUserByEmail(supabase: ReturnType<typeof createServerClient>, email: string): Promise<User | null> {
  const wanted = email.trim().toLowerCase()
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: USERS_PER_PAGE })
    if (error) throw new ApiRouteError('USER_LOOKUP_FAILED', error.message, 500)
    const match = data.users.find((u) => u.email?.toLowerCase() === wanted)
    if (match) return match
    if (data.users.length < USERS_PER_PAGE) return null
  }
}

export async function GET(req: NextRequest, { params }: Params) {
  const { id: districtId } = await params
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  const supabase = createServerClient()

  try {
    await requireDistrictAction(supabase, token, districtId, 'district.users.manage')

    const { data: memberships, error } = await supabase
      .from('district_users')
      .select('user_id, role, is_active, created_at, invited_by')
      .eq('district_id', districtId)
      .order('created_at')

    if (error) throw new ApiRouteError('MEMBERS_FETCH_FAILED', error.message, 500)

    const memberIds = (memberships ?? []).map((m) => m.user_id)

    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('id, display_name')
      .in('id', memberIds)

    const displayNames: Record<string, string | null> = {}
    for (const p of profiles ?? []) displayNames[p.id] = p.display_name

    const emails: Record<string, string> = {}
    await Promise.all(memberIds.map(async (uid) => {
      const { data } = await supabase.auth.admin.getUserById(uid)
      if (data?.user?.email) emails[uid] = data.user.email
    }))

    const members = (memberships ?? []).map((m) => ({
      user_id: m.user_id,
      role: m.role,
      is_active: m.is_active,
      created_at: m.created_at,
      display_name: displayNames[m.user_id] ?? null,
      email: emails[m.user_id] ?? null,
    }))

    return NextResponse.json({ members })
  } catch (error) {
    return toErrorResponse(error)
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id: districtId } = await params
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  const supabase = createServerClient()

  try {
    const actor = await requireDistrictAction(supabase, token, districtId, 'district.users.manage')

    let body: { email?: string; role?: unknown }
    try { body = await req.json() } catch {
      throw new ApiRouteError('INVALID_JSON', 'Invalid JSON body', 400)
    }

    const email = body.email?.trim()
    if (!email) throw new ApiRouteError('EMAIL_REQUIRED', 'Email is required.', 400)
    if (!isDistrictRole(body.role)) throw new ApiRouteError('INVALID_ROLE', `Invalid role: ${String(body.role)}`, 400)
    const role = body.role

    const targetUser = await findUserByEmail(supabase, email)
    if (!targetUser) {
      throw new ApiRouteError(
        'USER_NOT_FOUND',
        'No account uses that email. Ask them to sign up first, then add them here.',
        404,
      )
    }

    const { data: existing } = await supabase
      .from('district_users')
      .select('user_id, is_active')
      .eq('district_id', districtId)
      .eq('user_id', targetUser.id)
      .maybeSingle()

    if (existing?.is_active) {
      throw new ApiRouteError('ALREADY_MEMBER', 'That user is already an active member of this district.', 409)
    }

    const { error } = existing
      // Reactivate with the new role
      ? await supabase
        .from('district_users')
        .update({ role, is_active: true, invited_by: actor.user.id })
        .eq('district_id', districtId)
        .eq('user_id', targetUser.id)
      : await supabase
        .from('district_users')
        .insert({ district_id: districtId, user_id: targetUser.id, role, is_active: true, invited_by: actor.user.id })

    if (error) throw new ApiRouteError('MEMBER_SAVE_FAILED', error.message, 500)

    // Ensure user_profiles row exists (it may not for legacy users)
    await supabase
      .from('user_profiles')
      .upsert({ id: targetUser.id, is_superuser: false }, { onConflict: 'id', ignoreDuplicates: true })

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('display_name')
      .eq('id', targetUser.id)
      .maybeSingle()

    return NextResponse.json({
      member: {
        user_id: targetUser.id,
        role,
        is_active: true,
        created_at: new Date().toISOString(),
        email: targetUser.email ?? null,
        display_name: profile?.display_name ?? null,
      },
    }, { status: 201 })
  } catch (error) {
    return toErrorResponse(error)
  }
}
