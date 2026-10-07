import type { User } from '@supabase/supabase-js'
import type {
  DistrictAction,
  DistrictRole,
  LegacyDistrictRole,
} from '@/lib/auth/permissions'
import { can, normalizeDistrictRole } from '@/lib/auth/permissions'
import { createServerClient } from '@/lib/supabase/server'
import { ApiRouteError } from '@/lib/server/errors'

type ServerSupabase = ReturnType<typeof createServerClient>

export interface DistrictActor {
  user: User
  role: DistrictRole | null
  isSuperuser: boolean
  /** Region, assembly or ministry (members row) a scoped role is tied to. */
  scopeMemberId?: string | null
  /** Department a departmental role is tied to. */
  scopeDepartmentId?: string | null
  /** Member of a department with finance view rights (the Finance Committee). */
  financeCommittee?: boolean
}

/** True when the user sits on, or leads, an active finance-view department in the district. */
export async function isFinanceCommitteeMember(
  supabase: ServerSupabase,
  districtId: string,
  userId: string,
  scopeDepartmentId: string | null,
): Promise<boolean> {
  const { data: financeDepartments } = await supabase
    .from('departments')
    .select('id')
    .eq('district_id', districtId)
    .eq('grants_finance_view', true)
    .eq('is_active', true)

  const departmentIds = (financeDepartments ?? []).map((d: { id: string }) => d.id)
  if (departmentIds.length === 0) return false
  if (scopeDepartmentId && departmentIds.includes(scopeDepartmentId)) return true

  const { count } = await supabase
    .from('department_members')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .in('department_id', departmentIds)

  return (count ?? 0) > 0
}

export async function requireAuthenticatedUser(
  supabase: ServerSupabase,
  token: string | null | undefined,
): Promise<User> {
  if (!token) {
    throw new ApiRouteError('UNAUTHORIZED', 'Unauthorized', 401)
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token)

  if (error || !user) {
    throw new ApiRouteError('UNAUTHORIZED', 'Unauthorized', 401)
  }

  return user
}

export async function resolveDistrictActor(
  supabase: ServerSupabase,
  token: string | null | undefined,
  districtId: string,
): Promise<DistrictActor> {
  const user = await requireAuthenticatedUser(supabase, token)

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('is_superuser')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.is_superuser) {
    return { user, role: null, isSuperuser: true }
  }

  const { data: membership } = await supabase
    .from('district_users')
    .select('role, scope_member_id, scope_department_id')
    .eq('district_id', districtId)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  const scopeDepartmentId = membership?.scope_department_id ?? null

  return {
    user,
    role: normalizeDistrictRole((membership?.role ?? null) as LegacyDistrictRole | null),
    isSuperuser: false,
    scopeMemberId: membership?.scope_member_id ?? null,
    scopeDepartmentId,
    financeCommittee: membership
      ? await isFinanceCommitteeMember(supabase, districtId, user.id, scopeDepartmentId)
      : false,
  }
}

export async function requireDistrictAction(
  supabase: ServerSupabase,
  token: string | null | undefined,
  districtId: string,
  action: DistrictAction,
): Promise<DistrictActor> {
  const actor = await resolveDistrictActor(supabase, token, districtId)

  if (!can(action, actor.role, actor.isSuperuser, actor.financeCommittee)) {
    throw new ApiRouteError(
      'ACTION_FORBIDDEN',
      'You do not have permission to perform this action in the selected district.',
      403,
    )
  }

  return actor
}

/** Whether the actor may see private funds; others are limited to public ones. */
export function canViewPrivateFinancials(actor: DistrictActor): boolean {
  return can('financials.view_private', actor.role, actor.isSuperuser, actor.financeCommittee)
}
