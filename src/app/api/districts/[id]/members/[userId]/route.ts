// PATCH /api/districts/[id]/members/[userId]
// Update a district member's role or active status.
// Body: { role?: DistrictRole, is_active?: boolean }

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { requireDistrictAction } from '@/lib/auth/server'
import { isDistrictRole, type DistrictRole } from '@/lib/auth/permissions'
import { wouldRemoveLastAdmin } from '@/lib/auth/district-users'
import { ApiRouteError, toErrorResponse } from '@/lib/server/errors'

type Params = { params: Promise<{ id: string; userId: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id: districtId, userId } = await params
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  const supabase = createServerClient()

  try {
    await requireDistrictAction(supabase, token, districtId, 'district.users.manage')

    let body: { role?: unknown; is_active?: unknown }
    try { body = await req.json() } catch {
      throw new ApiRouteError('INVALID_JSON', 'Invalid JSON body', 400)
    }

    const patch: { role?: DistrictRole; is_active?: boolean } = {}

    if (body.role !== undefined) {
      if (!isDistrictRole(body.role)) throw new ApiRouteError('INVALID_ROLE', `Invalid role: ${String(body.role)}`, 400)
      patch.role = body.role
    }

    if (body.is_active !== undefined) {
      if (typeof body.is_active !== 'boolean') throw new ApiRouteError('INVALID_STATUS', 'is_active must be a boolean.', 400)
      patch.is_active = body.is_active
    }

    if (Object.keys(patch).length === 0) {
      throw new ApiRouteError('NOTHING_TO_UPDATE', 'Nothing to update', 400)
    }

    const { data: target, error: targetError } = await supabase
      .from('district_users')
      .select('role, is_active')
      .eq('district_id', districtId)
      .eq('user_id', userId)
      .maybeSingle()

    if (targetError) throw new ApiRouteError('MEMBER_FETCH_FAILED', targetError.message, 500)
    if (!target) throw new ApiRouteError('MEMBER_NOT_FOUND', 'Member not found', 404)

    const { count: activeAdminCount, error: countError } = await supabase
      .from('district_users')
      .select('user_id', { count: 'exact', head: true })
      .eq('district_id', districtId)
      .eq('role', 'admin')
      .eq('is_active', true)

    if (countError) throw new ApiRouteError('ADMIN_COUNT_FAILED', countError.message, 500)

    if (wouldRemoveLastAdmin(target, patch, activeAdminCount ?? 0)) {
      throw new ApiRouteError(
        'LAST_ADMIN',
        'This is the district’s only admin. Promote someone else to admin first.',
        422,
      )
    }

    const { data: updated, error } = await supabase
      .from('district_users')
      .update(patch)
      .eq('district_id', districtId)
      .eq('user_id', userId)
      .select()
      .single()

    if (error || !updated) {
      throw new ApiRouteError('MEMBER_UPDATE_FAILED', error?.message ?? 'Failed to update member.', 500)
    }

    return NextResponse.json({ member: updated })
  } catch (error) {
    return toErrorResponse(error)
  }
}
