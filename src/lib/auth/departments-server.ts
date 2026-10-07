import type { createServerClient } from '@/lib/supabase/server'
import { requireDistrictAction, type DistrictActor } from '@/lib/auth/server'
import { can } from '@/lib/auth/permissions'
import { ApiRouteError } from '@/lib/server/errors'

type ServerSupabase = ReturnType<typeof createServerClient>

/**
 * Members of a department are managed by anyone with departments.manage, or by
 * that department's own chairperson. Mirrors the department_members RLS policy.
 */
export async function requireDepartmentMemberManager(
  supabase: ServerSupabase,
  token: string | null | undefined,
  districtId: string,
  departmentId: string,
): Promise<DistrictActor> {
  const actor = await requireDistrictAction(supabase, token, districtId, 'events.view')

  const { data: department } = await supabase
    .from('departments')
    .select('id')
    .eq('id', departmentId)
    .eq('district_id', districtId)
    .maybeSingle()
  if (!department) throw new ApiRouteError('DEPARTMENT_NOT_FOUND', 'Department not found.', 404)

  const isChair = actor.role === 'departmental_chairperson' && actor.scopeDepartmentId === departmentId
  if (!isChair && !can('departments.manage', actor.role, actor.isSuperuser)) {
    throw new ApiRouteError('ACTION_FORBIDDEN', 'You cannot manage members of this department.', 403)
  }
  return actor
}
