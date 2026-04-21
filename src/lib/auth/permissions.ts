/**
 * District role and action permission matrix.
 *
 * Platform Superuser (is_superuser = true on user_profiles) is NOT a district
 * role — it is handled at the platform level and bypasses every district check.
 *
 * Role hierarchy (highest → lowest operational authority):
 *   admin > secretary > treasurer > clerk > auditor > viewer
 */

// ── types ──────────────────────────────────────────────────────────────────────

export type DistrictRole =
  | 'admin'      // District Admin      — full operational ownership
  | 'secretary'  // District Secretary  — coordination + finance ops
  | 'treasurer'  // Treasurer           — financial control + approvals
  | 'clerk'      // Finance Clerk       — safe data-entry role
  | 'auditor'    // Auditor             — read-only oversight
  | 'viewer'     // Viewer              — limited read access

export type LegacyDistrictRole = DistrictRole | 'preparer' | 'approver'

const LEGACY_ROLE_MAP = {
  preparer: 'clerk',
  approver: 'treasurer',
} as const

/**
 * Discrete actions that can be permission-checked throughout the app.
 * Grouped by domain for readability.
 */
export type DistrictAction =
  // District setup
  | 'district.settings.view'
  | 'district.settings.manage'
  | 'district.users.view'
  | 'district.users.manage'
  // Master data
  | 'accounts.manage'   // create, update, deactivate
  | 'funds.manage'      // create, update, deactivate
  | 'members.manage'        // create, update, reparent, deactivate
  | 'counterparties.manage' // create, update, deactivate
  // Transactions
  | 'transactions.view'
  | 'transactions.draft'    // create / edit own drafts
  | 'transactions.approve'
  | 'transactions.post'
  | 'transactions.reverse'
  // Transfers
  | 'transfers.view'
  | 'transfers.draft'
  | 'transfers.post'
  | 'transfers.reverse'
  // Budgets
  | 'budgets.manage'    // create / edit draft budgets
  | 'budgets.activate'
  | 'budgets.close'
  // Reporting & exports
  | 'reports.view'
  | 'exports.generate'
  // Operational
  | 'attachments.upload'
  | 'sync.resolve'      // resolve district-level sync conflicts

// ── permission matrix ─────────────────────────────────────────────────────────

/**
 * Each role's permitted action set.
 * Superuser grants are not listed here — they are handled by `can()`.
 */
const MATRIX: Record<DistrictRole, ReadonlyArray<DistrictAction>> = {
  admin: [
    'district.settings.view',
    'district.settings.manage',
    'district.users.view',
    'district.users.manage',
    'accounts.manage',
    'funds.manage',
    'members.manage',
    'counterparties.manage',
    'transactions.view',
    'transactions.draft',
    'transactions.approve',
    'transactions.post',
    'transactions.reverse',
    'transfers.view',
    'transfers.draft',
    'transfers.post',
    'transfers.reverse',
    'budgets.manage',
    'budgets.activate',
    'budgets.close',
    'reports.view',
    'exports.generate',
    'attachments.upload',
    'sync.resolve',
  ],

  secretary: [
    'district.settings.view',
    'members.manage',
    'counterparties.manage',
    'transactions.view',
    'transactions.draft',
    'transactions.approve',
    'transactions.post',
    'transfers.view',
    'transfers.draft',
    'transfers.post',
    'budgets.manage',
    'reports.view',
    'exports.generate',
    'attachments.upload',
  ],

  treasurer: [
    'transactions.view',
    'transactions.draft',
    'transactions.approve',
    'transactions.post',
    'transactions.reverse',
    'transfers.view',
    'transfers.draft',
    'transfers.post',
    'transfers.reverse',
    'budgets.manage',
    'budgets.activate',
    'budgets.close',
    'reports.view',
    'exports.generate',
    'sync.resolve',
  ],

  clerk: [
    'transactions.view',
    'transfers.view',
    'transactions.draft',
    'transfers.draft',
    'budgets.manage',
    'reports.view',
    'exports.generate',
    'attachments.upload',
  ],

  auditor: [
    'transactions.view',
    'transfers.view',
    'reports.view',
    'exports.generate',
  ],

  viewer: [
    'transactions.view',
    'transfers.view',
    'reports.view',
  ],
}

// ── helpers ───────────────────────────────────────────────────────────────────

export function normalizeDistrictRole(
  role: LegacyDistrictRole | null | undefined,
): DistrictRole | null {
  if (!role) return null
  if (role in LEGACY_ROLE_MAP) {
    return LEGACY_ROLE_MAP[role as keyof typeof LEGACY_ROLE_MAP]
  }
  return role as DistrictRole
}

/**
 * Returns true when the given role (or a platform superuser) may perform
 * the action.  Pass `isSuperuser = true` to bypass the matrix entirely.
 *
 * @example
 * can('transactions.post', 'clerk')           // false
 * can('transactions.post', 'treasurer')       // true
 * can('transactions.post', null, true)        // true  (superuser)
 */
export function can(
  action: DistrictAction,
  role: LegacyDistrictRole | null | undefined,
  isSuperuser = false,
): boolean {
  const normalizedRole = normalizeDistrictRole(role)
  if (isSuperuser) return true
  if (!normalizedRole) return false
  return (MATRIX[normalizedRole] as ReadonlyArray<string>).includes(action)
}

/** Returns the list of roles that may perform a given action. */
export function rolesFor(action: DistrictAction): DistrictRole[] {
  return (Object.entries(MATRIX) as [DistrictRole, ReadonlyArray<DistrictAction>][])
    .filter(([, actions]) => actions.includes(action))
    .map(([role]) => role)
}

// ── display labels ─────────────────────────────────────────────────────────────

export const ROLE_LABELS: Record<DistrictRole, string> = {
  admin:     'District Admin',
  secretary: 'District Secretary',
  treasurer: 'Treasurer',
  clerk:     'Finance Clerk',
  auditor:   'Auditor',
  viewer:    'Viewer',
}

export const ROLE_DESCRIPTIONS: Record<DistrictRole, string> = {
  admin:     'Full operational ownership of the district — settings, users, all finance actions.',
  secretary: 'Coordination and finance operations — drafting, posting, members, counterparties, budgets, exports.',
  treasurer: 'Financial control — posting, reversals, transfer reversals, budget activation/closure.',
  clerk:     'Safe data-entry — drafts only. Cannot post, reverse, or activate.',
  auditor:   'Read-only oversight — reports and exports, no mutations.',
  viewer:    'Limited read access — reports only.',
}
