import { describe, expect, it } from 'vitest'
import { resolveRoleScope, wouldRemoveLastPastor } from '@/lib/auth/district-users'

describe('wouldRemoveLastPastor', () => {
  const pastor = { role: 'district_pastor', is_active: true }

  it('blocks demoting or deactivating the only active pastor', () => {
    expect(wouldRemoveLastPastor(pastor, { role: 'accounting_officer' }, 1)).toBe(true)
    expect(wouldRemoveLastPastor(pastor, { is_active: false }, 1)).toBe(true)
  })

  it('allows it when another active pastor remains', () => {
    expect(wouldRemoveLastPastor(pastor, { role: 'accounting_officer' }, 2)).toBe(false)
    expect(wouldRemoveLastPastor(pastor, { is_active: false }, 2)).toBe(false)
  })

  it('ignores changes that keep the user an active pastor', () => {
    expect(wouldRemoveLastPastor(pastor, { role: 'district_pastor', is_active: true }, 1)).toBe(false)
  })

  it('ignores non-pastor and inactive targets', () => {
    expect(wouldRemoveLastPastor({ role: 'assistant_accounting_officer', is_active: true }, { is_active: false }, 1)).toBe(false)
    expect(wouldRemoveLastPastor({ role: 'district_pastor', is_active: false }, { role: 'ministerial_secretary' }, 1)).toBe(false)
  })
})

describe('resolveRoleScope', () => {
  it('clears scope for unscoped roles', () => {
    expect(resolveRoleScope('accounting_officer', { scope_member_id: 'region-1' }))
      .toEqual({ scope_member_id: null, scope_department_id: null })
  })

  it('requires a member scope for region, assembly and ministry roles', () => {
    expect(resolveRoleScope('assembly_secretary', {})).toHaveProperty('error')
    expect(resolveRoleScope('regional_pastor', { scope_member_id: 'region-1', scope_department_id: 'dept-1' }))
      .toEqual({ scope_member_id: 'region-1', scope_department_id: null })
  })

  it('requires a department for departmental roles', () => {
    expect(resolveRoleScope('departmental_secretary', { scope_member_id: 'region-1' })).toHaveProperty('error')
    expect(resolveRoleScope('departmental_chairperson', { scope_department_id: 'dept-1' }))
      .toEqual({ scope_member_id: null, scope_department_id: 'dept-1' })
  })
})
