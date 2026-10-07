import { ROLE_LABELS, roleScopeKind, SCOPE_KIND_LABELS, type DistrictRole } from '@/lib/auth/permissions'

export interface DistrictUserMembership {
  role: DistrictRole | string
  is_active: boolean
}

/**
 * True when applying `patch` to `target` would take away the district's last
 * active District Pastor. Superusers don't count — every district must keep
 * at least one pastor who owns its settings and users.
 */
export function wouldRemoveLastPastor(
  target: DistrictUserMembership,
  patch: { role?: DistrictRole; is_active?: boolean },
  activePastorCount: number,
): boolean {
  const isActivePastor = target.role === 'district_pastor' && target.is_active
  if (!isActivePastor) return false

  const nextRole = patch.role ?? target.role
  const nextActive = patch.is_active ?? target.is_active
  const staysActivePastor = nextRole === 'district_pastor' && nextActive

  return !staysActivePastor && activePastorCount <= 1
}

export interface RoleScope {
  scope_member_id: string | null
  scope_department_id: string | null
}

/**
 * Validates the scope supplied for `role`: scoped roles need exactly the
 * matching scope id, unscoped roles get both cleared. Returns an error message
 * instead of throwing so routes can wrap it in their own error type. The
 * database trigger additionally checks the unit's type and district.
 */
export function resolveRoleScope(
  role: DistrictRole,
  input: { scope_member_id?: unknown; scope_department_id?: unknown },
): RoleScope | { error: string } {
  const kind = roleScopeKind(role)
  const memberId = typeof input.scope_member_id === 'string' && input.scope_member_id ? input.scope_member_id : null
  const departmentId = typeof input.scope_department_id === 'string' && input.scope_department_id ? input.scope_department_id : null

  if (!kind) return { scope_member_id: null, scope_department_id: null }

  if (kind === 'department') {
    if (!departmentId) return { error: `Choose a department for ${ROLE_LABELS[role]}.` }
    return { scope_member_id: null, scope_department_id: departmentId }
  }

  if (!memberId) return { error: `Choose a ${SCOPE_KIND_LABELS[kind].toLowerCase()} for ${ROLE_LABELS[role]}.` }
  return { scope_member_id: memberId, scope_department_id: null }
}
