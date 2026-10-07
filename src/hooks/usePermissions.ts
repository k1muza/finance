'use client'

import { useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { can, DistrictAction, DistrictRole, roleScopeKind } from '@/lib/auth/permissions'

/**
 * Returns permission helpers scoped to the currently active district.
 *
 * @example
 * const { can } = usePermissions()
 * if (can('transactions.post')) { ... }
 */
export function usePermissions() {
  const { isAdmin, memberships, districtId } = useAuth()

  const membership = memberships.find((m) => m.district.id === districtId)
  const role = (membership?.role ?? null) as DistrictRole | null
  const financeCommittee = membership?.financeCommittee ?? false

  const check = useCallback(
    (action: DistrictAction) => can(action, role, isAdmin, financeCommittee),
    [role, isAdmin, financeCommittee],
  )

  return {
    /** Check whether the current user may perform an action in the active district. */
    can: check,
    /** The user's role in the active district, or null if not a member. */
    role,
    /** What kind of unit the role is tied to, if any. */
    scopeKind: roleScopeKind(role),
    /** Region, assembly or ministry the role is tied to. */
    scopeMemberId: membership?.scopeMemberId ?? null,
    /** Department the role is tied to. */
    scopeDepartmentId: membership?.scopeDepartmentId ?? null,
    /** Member of the Finance Committee (view-all financials). */
    financeCommittee,
    /** True if the user is a platform superuser (bypasses all district checks). */
    isSuperuser: isAdmin,
  }
}
