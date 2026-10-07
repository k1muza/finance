// GET /api/districts/[id]/departments/roster
// Leaders (departmental chairperson / secretary) and members of every
// department, with display names. Users who can manage at least one
// department also get the district's active users to pick members from.

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { requireDistrictAction } from '@/lib/auth/server'
import { can } from '@/lib/auth/permissions'
import { loadUserDirectory } from '@/lib/auth/user-directory'
import { ApiRouteError, toErrorResponse } from '@/lib/server/errors'

type Params = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  const { id: districtId } = await params
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  const supabase = createServerClient()

  try {
    const actor = await requireDistrictAction(supabase, token, districtId, 'events.view')

    const { data: departments, error: deptError } = await supabase
      .from('departments')
      .select('id')
      .eq('district_id', districtId)
    if (deptError) throw new ApiRouteError('DEPARTMENTS_FETCH_FAILED', deptError.message, 500)
    const departmentIds = (departments ?? []).map((d) => d.id)

    const { data: leaders, error: leaderError } = await supabase
      .from('district_users')
      .select('user_id, role, scope_department_id')
      .eq('district_id', districtId)
      .eq('is_active', true)
      .not('scope_department_id', 'is', null)
    if (leaderError) throw new ApiRouteError('LEADERS_FETCH_FAILED', leaderError.message, 500)

    let members: { department_id: string; user_id: string }[] = []
    if (departmentIds.length > 0) {
      const { data, error } = await supabase
        .from('department_members')
        .select('department_id, user_id, created_at')
        .in('department_id', departmentIds)
        .order('created_at')
      if (error) throw new ApiRouteError('MEMBERS_FETCH_FAILED', error.message, 500)
      members = data ?? []
    }

    const canManageAll = can('departments.manage', actor.role, actor.isSuperuser)
    const chairOf = actor.role === 'departmental_chairperson' ? actor.scopeDepartmentId ?? null : null

    let people: { user_id: string }[] = []
    if (canManageAll || chairOf) {
      const { data: districtUsers } = await supabase
        .from('district_users')
        .select('user_id')
        .eq('district_id', districtId)
        .eq('is_active', true)
      people = districtUsers ?? []
    }

    const directory = await loadUserDirectory(supabase, [
      ...(leaders ?? []).map((l) => l.user_id),
      ...members.map((m) => m.user_id),
      ...people.map((p) => p.user_id),
    ])
    const named = (userId: string) => ({ user_id: userId, ...directory[userId] })

    return NextResponse.json({
      leaders: (leaders ?? []).map((l) => ({ ...named(l.user_id), role: l.role, department_id: l.scope_department_id })),
      members: members.map((m) => ({ ...named(m.user_id), department_id: m.department_id })),
      people: people.map((p) => named(p.user_id)),
      manageable_department_ids: canManageAll ? departmentIds : chairOf ? [chairOf] : [],
    })
  } catch (error) {
    return toErrorResponse(error)
  }
}
