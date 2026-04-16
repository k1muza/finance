'use client'

import { useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { can, DistrictAction, DistrictRole } from '@/lib/auth/permissions'

/**
 * Returns permission helpers scoped to the currently active district.
 *
 * @example
 * const { can } = usePermissions()
 * if (can('transactions.post')) { ... }
 */
export function usePermissions() {
  const { isAdmin, memberships, districtId } = useAuth()

  const role = (memberships.find((m) => m.district.id === districtId)?.role ?? null) as DistrictRole | null

  const check = useCallback(
    (action: DistrictAction) => can(action, role, isAdmin),
    [role, isAdmin],
  )

  return {
    /** Check whether the current user may perform an action in the active district. */
    can: check,
    /** The user's role in the active district, or null if not a member. */
    role,
    /** True if the user is a platform superuser (bypasses all district checks). */
    isSuperuser: isAdmin,
  }
}
