// PATCH /api/districts/[id]/members/[userId]
// Update a district member's role or active status.
// Body: { role?: DistrictRole, scope_member_id?: string, scope_department_id?: string, is_active?: boolean }

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { requireDistrictAction } from '@/lib/auth/server'
import { isDistrictRole, type DistrictRole } from '@/lib/auth/permissions'
import { resolveRoleScope, wouldRemoveLastPastor, type RoleScope } from '@/lib/auth/district-users'
import { ApiRouteError, toErrorResponse } from '@/lib/server/errors'

type Params = { params: Promise<{ id: string; userId: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id: districtId, userId } = await params
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  const supabase = createServerClient()

  try {
    await requireDistrictAction(supabase, token, districtId, 'district.users.manage')

    let body: { role?: unknown; scope_member_id?: unknown; scope_department_id?: unknown; is_active?: unknown }
    try { body = await req.json() } catch {
      throw new ApiRouteError('INVALID_JSON', 'Invalid JSON body', 400)
    }

    const patch: { role?: DistrictRole; is_active?: boolean } & Partial<RoleScope> = {}
    const scopeChanged = body.scope_member_id !== undefined || body.scope_department_id !== undefined

    if (body.role !== undefined) {
      if (!isDistrictRole(body.role)) throw new ApiRouteError('INVALID_ROLE', `Invalid role: ${String(body.role)}`, 400)
      patch.role = body.role
    }

    if (body.is_active !== undefined) {
      if (typeof body.is_active !== 'boolean') throw new ApiRouteError('INVALID_STATUS', 'is_active must be a boolean.', 400)
      patch.is_active = body.is_active
    }

    if (Object.keys(patch).length === 0 && !scopeChanged) {
      throw new ApiRouteError('NOTHING_TO_UPDATE', 'Nothing to update', 400)
    }

    const { data: target, error: targetError } = await supabase
      .from('district_users')
      .select('role, scope_member_id, scope_department_id, is_active')
      .eq('district_id', districtId)
      .eq('user_id', userId)
      .maybeSingle()

    if (targetError) throw new ApiRouteError('MEMBER_FETCH_FAILED', targetError.message, 500)
    if (!target) throw new ApiRouteError('MEMBER_NOT_FOUND', 'Member not found', 404)

    const { count: activePastorCount, error: countError } = await supabase
      .from('district_users')
      .select('user_id', { count: 'exact', head: true })
      .eq('district_id', districtId)
      .eq('role', 'district_pastor')
      .eq('is_active', true)

    if (countError) throw new ApiRouteError('PASTOR_COUNT_FAILED', countError.message, 500)

    if (wouldRemoveLastPastor(target, patch, activePastorCount ?? 0)) {
      throw new ApiRouteError(
        'LAST_PASTOR',
        'This is the district’s only District Pastor. Assign another District Pastor first.',
        422,
      )
    }

    if (patch.role !== undefined || scopeChanged) {
      const role = patch.role ?? (target.role as DistrictRole)
      const scope = resolveRoleScope(role, {
        scope_member_id: body.scope_member_id ?? (patch.role === undefined ? target.scope_member_id : undefined),
        scope_department_id: body.scope_department_id ?? (patch.role === undefined ? target.scope_department_id : undefined),
      })
      if ('error' in scope) throw new ApiRouteError('SCOPE_REQUIRED', scope.error, 400)
      Object.assign(patch, scope)
    }

    const { data: updated, error } = await supabase
      .from('district_users')
      .update(patch)
      .eq('district_id', districtId)
      .eq('user_id', userId)
      .select()
      .single()

    // P0001: the scope trigger rejected the unit (wrong type or district).
    if (error?.code === 'P0001') throw new ApiRouteError('INVALID_SCOPE', error.message, 422)
    if (error || !updated) {
      throw new ApiRouteError('MEMBER_UPDATE_FAILED', error?.message ?? 'Failed to update member.', 500)
    }

    return NextResponse.json({ member: updated })
  } catch (error) {
    return toErrorResponse(error)
  }
}
