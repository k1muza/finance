import type { DistrictRole } from '@/lib/auth/permissions'

export interface DistrictUserMembership {
  role: DistrictRole | string
  is_active: boolean
}

/**
 * True when applying `patch` to `target` would take away the district's last
 * active admin. Superusers don't count — every district must keep at least one
 * district-level admin who can manage its users.
 */
export function wouldRemoveLastAdmin(
  target: DistrictUserMembership,
  patch: { role?: DistrictRole; is_active?: boolean },
  activeAdminCount: number,
): boolean {
  const isActiveAdmin = target.role === 'admin' && target.is_active
  if (!isActiveAdmin) return false

  const nextRole = patch.role ?? target.role
  const nextActive = patch.is_active ?? target.is_active
  const staysActiveAdmin = nextRole === 'admin' && nextActive

  return !staysActiveAdmin && activeAdminCount <= 1
}
