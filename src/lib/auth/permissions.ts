/**
 * District role and action permission matrix.
 *
 * Platform Superuser (is_superuser = true on user_profiles) is NOT a district
 * role — it is handled at the platform level and bypasses every district check.
 *
 * Finance Committee membership is not a role either: members of a department
 * with `grants_finance_view` get FINANCE_COMMITTEE_ACTIONS on top of their role.
 *
 * Role checks are mirrored in SQL functions (see the
 * departments_scope_and_visibility migration) — keep both in sync.
 */

// ── types ──────────────────────────────────────────────────────────────────────

export type DistrictRole =
  | 'district_pastor'              // District Pastor              — oversight of everything, no posting
  | 'accounting_officer'           // Accounting Officer           — financial control + posting
  | 'assistant_accounting_officer' // Assistant Accounting Officer — posting
  | 'district_coordinator'         // District Coordinator         — coordination, no finance
  | 'district_secretary'           // District Secretary           — coordination, no finance
  | 'regional_pastor'              // Regional Pastor              — region-scoped
  | 'regional_coordinator'         // Regional Coordinator         — region-scoped
  | 'regional_secretary'           // Regional Secretary           — region-scoped, records collections
  | 'assembly_coordinator'         // Assembly Coordinator         — assembly-scoped
  | 'assembly_secretary'           // Assembly Secretary           — assembly-scoped, records collections
  | 'ministerial_chairperson'      // Ministerial Chairperson      — ministry-scoped
  | 'ministerial_secretary'        // Ministerial Secretary        — ministry-scoped, records collections
  | 'departmental_chairperson'     // Departmental Chairperson     — department-scoped
  | 'departmental_secretary'       // Departmental Secretary       — department-scoped, department events

export const DISTRICT_ROLES: ReadonlyArray<DistrictRole> = [
  'district_pastor',
  'accounting_officer',
  'assistant_accounting_officer',
  'district_coordinator',
  'district_secretary',
  'regional_pastor',
  'regional_coordinator',
  'regional_secretary',
  'assembly_coordinator',
  'assembly_secretary',
  'ministerial_chairperson',
  'ministerial_secretary',
  'departmental_chairperson',
  'departmental_secretary',
]

export function isDistrictRole(value: unknown): value is DistrictRole {
  return typeof value === 'string' && (DISTRICT_ROLES as ReadonlyArray<string>).includes(value)
}

/** Pre-church-office role values, still possible in cached sessions. */
export type LegacyDistrictRole =
  | DistrictRole
  | 'admin' | 'secretary' | 'treasurer' | 'clerk' | 'auditor' | 'viewer'
  | 'preparer' | 'approver'

const LEGACY_ROLE_MAP = {
  admin:     'district_pastor',
  treasurer: 'accounting_officer',
  clerk:     'assistant_accounting_officer',
  secretary: 'district_secretary',
  auditor:   'regional_coordinator',
  viewer:    'ministerial_secretary',
  preparer:  'assistant_accounting_officer',
  approver:  'accounting_officer',
} as const

// ── scope ─────────────────────────────────────────────────────────────────────

/**
 * The unit a role is tied to. Region, assembly and ministry scopes point at a
 * `members` row (ministries are `department`-type members); department scopes
 * point at a `departments` row.
 */
export type RoleScopeKind = 'region' | 'assembly' | 'ministry' | 'department'

const ROLE_SCOPE: Partial<Record<DistrictRole, RoleScopeKind>> = {
  regional_pastor:          'region',
  regional_coordinator:     'region',
  regional_secretary:       'region',
  assembly_coordinator:     'assembly',
  assembly_secretary:       'assembly',
  ministerial_chairperson:  'ministry',
  ministerial_secretary:    'ministry',
  departmental_chairperson: 'department',
  departmental_secretary:   'department',
}

export function roleScopeKind(role: DistrictRole | null | undefined): RoleScopeKind | null {
  return role ? ROLE_SCOPE[role] ?? null : null
}

/** Minimal member shape needed to walk the region → assembly hierarchy. */
export interface ScopeHierarchyNode {
  id: string
  parent_id: string | null
}

/**
 * True when `targetMemberId` is the scope unit itself or sits beneath it
 * (e.g. an assembly inside a regional scope).
 */
export function isWithinScope(
  scopeMemberId: string | null | undefined,
  targetMemberId: string | null | undefined,
  hierarchy: ReadonlyArray<ScopeHierarchyNode>,
): boolean {
  if (!scopeMemberId || !targetMemberId) return false
  const parentOf = new Map(hierarchy.map((node) => [node.id, node.parent_id]))
  const seen = new Set<string>()
  let current: string | null | undefined = targetMemberId
  while (current && !seen.has(current)) {
    if (current === scopeMemberId) return true
    seen.add(current)
    current = parentOf.get(current)
  }
  return false
}

// ── actions ───────────────────────────────────────────────────────────────────

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
  // Financial visibility
  | 'financials.view_private' // all funds, accounts, transfers, budgets
  | 'financials.view_public'  // public funds only
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
  | 'budgets.view'
  | 'budgets.manage'    // create / edit draft budgets
  | 'budgets.activate'
  | 'budgets.close'
  // Collections (scoped roles are limited to their own unit — see collectionScope)
  | 'collections.view'
  | 'collections.record'
  | 'collections.submit' // mark as received at the office
  | 'collections.post'   // post submitted collections to funds
  | 'collections.types.manage'
  // Coordination
  | 'events.view'
  | 'events.manage'     // create, edit, delete any district calendar event
  | 'departments.manage'
  // Reporting & exports
  | 'reports.view'
  | 'exports.generate'
  // Operational
  | 'attachments.upload'
  | 'sync.resolve'      // resolve district-level sync conflicts

// ── permission matrix ─────────────────────────────────────────────────────────

const PUBLIC_VIEW: ReadonlyArray<DistrictAction> = [
  'financials.view_public',
  'transactions.view',
  'reports.view',
  'events.view',
]

const PRIVATE_VIEW: ReadonlyArray<DistrictAction> = [
  ...PUBLIC_VIEW,
  'financials.view_private',
  'transfers.view',
  'budgets.view',
]

/** View-only rights granted by Finance Committee membership. Never posting or submitting. */
export const FINANCE_COMMITTEE_ACTIONS: ReadonlyArray<DistrictAction> = [
  ...PRIVATE_VIEW,
  'collections.view',
  'exports.generate',
]

/**
 * Each role's permitted action set.
 * Superuser grants are not listed here — they are handled by `can()`.
 */
const MATRIX: Record<DistrictRole, ReadonlyArray<DistrictAction>> = {
  district_pastor: [
    ...PRIVATE_VIEW,
    'district.settings.view',
    'district.settings.manage',
    'district.users.view',
    'district.users.manage',
    'accounts.manage',
    'funds.manage',
    'members.manage',
    'counterparties.manage',
    'transactions.draft',
    'transfers.draft',
    'budgets.manage',
    'budgets.activate',
    'budgets.close',
    'collections.view',
    'collections.types.manage',
    'events.manage',
    'departments.manage',
    'exports.generate',
    'attachments.upload',
    'sync.resolve',
  ],

  accounting_officer: [
    ...PRIVATE_VIEW,
    'district.users.view',
    'district.users.manage',
    'transactions.draft',
    'transactions.approve',
    'transactions.post',
    'transactions.reverse',
    'transfers.draft',
    'transfers.post',
    'transfers.reverse',
    'budgets.manage',
    'budgets.activate',
    'budgets.close',
    'collections.view',
    'collections.submit',
    'collections.post',
    'collections.types.manage',
    'exports.generate',
    'attachments.upload',
    'sync.resolve',
  ],

  assistant_accounting_officer: [
    ...PRIVATE_VIEW,
    'transactions.draft',
    'transactions.post',
    'transactions.reverse',
    'transfers.draft',
    'transfers.post',
    'transfers.reverse',
    'budgets.manage',
    'collections.view',
    'collections.submit',
    'collections.post',
    'collections.types.manage',
    'exports.generate',
    'attachments.upload',
  ],

  district_coordinator: [
    ...PUBLIC_VIEW,
    'district.settings.view',
    'members.manage',
    'events.manage',
    'departments.manage',
    'exports.generate',
  ],

  district_secretary: [
    ...PUBLIC_VIEW,
    'district.settings.view',
    'members.manage',
    'counterparties.manage',
    'events.manage',
    'departments.manage',
    'exports.generate',
    'attachments.upload',
  ],

  regional_pastor:         [...PUBLIC_VIEW, 'collections.view', 'exports.generate'],
  regional_coordinator:    [...PUBLIC_VIEW, 'collections.view', 'exports.generate'],
  regional_secretary:      [...PUBLIC_VIEW, 'collections.view', 'collections.record', 'exports.generate'],
  assembly_coordinator:    [...PUBLIC_VIEW, 'collections.view', 'exports.generate'],
  assembly_secretary:      [...PUBLIC_VIEW, 'collections.view', 'collections.record', 'exports.generate'],
  ministerial_chairperson: [...PUBLIC_VIEW, 'collections.view', 'exports.generate'],
  ministerial_secretary:   [...PUBLIC_VIEW, 'collections.view', 'collections.record'],
  departmental_chairperson: [...PUBLIC_VIEW],
  departmental_secretary:   [...PUBLIC_VIEW],
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
 * the action.  Pass `isSuperuser = true` to bypass the matrix entirely, and
 * `financeCommittee = true` for members of a finance-view department.
 *
 * Scoped actions (collections) also need a scope check — see collectionScope.
 *
 * @example
 * can('transactions.post', 'district_pastor')               // false
 * can('transactions.post', 'accounting_officer')            // true
 * can('financials.view_private', 'assembly_secretary', false, true) // true (Finance Committee)
 * can('transactions.post', null, true)                      // true  (superuser)
 */
export function can(
  action: DistrictAction,
  role: LegacyDistrictRole | null | undefined,
  isSuperuser = false,
  financeCommittee = false,
): boolean {
  if (isSuperuser) return true
  if (financeCommittee && FINANCE_COMMITTEE_ACTIONS.includes(action)) return true
  const normalizedRole = normalizeDistrictRole(role)
  if (!normalizedRole) return false
  return (MATRIX[normalizedRole] as ReadonlyArray<string>).includes(action)
}

/**
 * How far a user's collection rights reach: the whole district, only their
 * own unit, or nowhere. Finance Committee members see every collection.
 */
export function collectionScope(
  action: 'collections.view' | 'collections.record',
  role: LegacyDistrictRole | null | undefined,
  isSuperuser = false,
  financeCommittee = false,
): 'district' | 'scope' | null {
  if (!can(action, role, isSuperuser, financeCommittee)) return null
  if (isSuperuser) return 'district'
  if (action === 'collections.view' && financeCommittee) return 'district'
  return roleScopeKind(normalizeDistrictRole(role)) ? 'scope' : 'district'
}

/** Returns the list of roles that may perform a given action. */
export function rolesFor(action: DistrictAction): DistrictRole[] {
  return (Object.entries(MATRIX) as [DistrictRole, ReadonlyArray<DistrictAction>][])
    .filter(([, actions]) => actions.includes(action))
    .map(([role]) => role)
}

// ── display labels ─────────────────────────────────────────────────────────────

export const ROLE_LABELS: Record<DistrictRole, string> = {
  district_pastor:              'District Pastor',
  accounting_officer:           'Accounting Officer',
  assistant_accounting_officer: 'Assistant Accounting Officer',
  district_coordinator:         'District Coordinator',
  district_secretary:           'District Secretary',
  regional_pastor:              'Regional Pastor',
  regional_coordinator:         'Regional Coordinator',
  regional_secretary:           'Regional Secretary',
  assembly_coordinator:         'Assembly Coordinator',
  assembly_secretary:           'Assembly Secretary',
  ministerial_chairperson:      'Ministerial Chairperson',
  ministerial_secretary:        'Ministerial Secretary',
  departmental_chairperson:     'Departmental Chairperson',
  departmental_secretary:       'Departmental Secretary',
}

export const ROLE_DESCRIPTIONS: Record<DistrictRole, string> = {
  district_pastor:              'Sees everything — settings, users, all financials and collections. Does not approve or post.',
  accounting_officer:           'Financial control — posting, reversals, budgets, collection hand-over, and user management.',
  assistant_accounting_officer: 'Posting and reversals, budgets drafts, collection hand-over.',
  district_coordinator:         'Coordination — members, events, departments. Public financials only.',
  district_secretary:           'Coordination — members, counterparties, events, departments. Public financials only.',
  regional_pastor:              'Views collections for their region. Public financials only.',
  regional_coordinator:         'Views collections for their region. Public financials only.',
  regional_secretary:           'Records and views collections for their region. Public financials only.',
  assembly_coordinator:         'Views collections for their assembly. Public financials only.',
  assembly_secretary:           'Records and views collections for their assembly. Public financials only.',
  ministerial_chairperson:      'Views collections for their ministry. Public financials only.',
  ministerial_secretary:        'Records and views collections for their ministry. Public financials only.',
  departmental_chairperson:     'Leads a department and manages its members. Public financials only.',
  departmental_secretary:       'Manages events for their department. Public financials only.',
}

export const SCOPE_KIND_LABELS: Record<RoleScopeKind, string> = {
  region:     'Region',
  assembly:   'Assembly',
  ministry:   'Ministry',
  department: 'Department',
}
