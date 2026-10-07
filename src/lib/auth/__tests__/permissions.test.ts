import { describe, expect, it } from 'vitest'
import {
  can,
  collectionScope,
  DISTRICT_ROLES,
  isWithinScope,
  normalizeDistrictRole,
  roleScopeKind,
  rolesFor,
} from '@/lib/auth/permissions'

describe('district role normalization', () => {
  it('maps legacy roles to the church office roles', () => {
    expect(normalizeDistrictRole('admin')).toBe('district_pastor')
    expect(normalizeDistrictRole('treasurer')).toBe('accounting_officer')
    expect(normalizeDistrictRole('clerk')).toBe('assistant_accounting_officer')
    expect(normalizeDistrictRole('secretary')).toBe('district_secretary')
    expect(normalizeDistrictRole('auditor')).toBe('regional_coordinator')
    expect(normalizeDistrictRole('viewer')).toBe('ministerial_secretary')
    expect(normalizeDistrictRole('preparer')).toBe('assistant_accounting_officer')
    expect(normalizeDistrictRole('approver')).toBe('accounting_officer')
  })

  it('keeps current roles unchanged', () => {
    for (const role of DISTRICT_ROLES) {
      expect(normalizeDistrictRole(role)).toBe(role)
    }
  })
})

describe('posting', () => {
  it('limits posting and reversals to the Accounting Officer and Assistant', () => {
    for (const action of ['transactions.post', 'transactions.reverse', 'transfers.post', 'transfers.reverse'] as const) {
      expect(rolesFor(action)).toEqual(['accounting_officer', 'assistant_accounting_officer'])
    }
  })

  it('limits approval to the Accounting Officer', () => {
    expect(rolesFor('transactions.approve')).toEqual(['accounting_officer'])
  })

  it('stops the District Pastor and Secretary from approving or posting', () => {
    expect(can('transactions.approve', 'district_pastor')).toBe(false)
    expect(can('transactions.post', 'district_pastor')).toBe(false)
    expect(can('transactions.post', 'district_secretary')).toBe(false)
  })
})

describe('financial visibility', () => {
  it('gives private financials to the pastor and accounting officers only', () => {
    expect(rolesFor('financials.view_private')).toEqual([
      'district_pastor',
      'accounting_officer',
      'assistant_accounting_officer',
    ])
  })

  it('gives every role public financials and events', () => {
    for (const role of DISTRICT_ROLES) {
      expect(can('financials.view_public', role)).toBe(true)
      expect(can('events.view', role)).toBe(true)
    }
  })

  it('treats transfers and budgets as private', () => {
    expect(can('transfers.view', 'district_secretary')).toBe(false)
    expect(can('budgets.view', 'regional_pastor')).toBe(false)
    expect(can('transfers.view', 'assistant_accounting_officer')).toBe(true)
  })
})

describe('Finance Committee', () => {
  it('adds view-all rights on top of any role', () => {
    expect(can('financials.view_private', 'assembly_secretary')).toBe(false)
    expect(can('financials.view_private', 'assembly_secretary', false, true)).toBe(true)
    expect(can('transfers.view', 'departmental_secretary', false, true)).toBe(true)
    expect(collectionScope('collections.view', 'assembly_secretary', false, true)).toBe('district')
  })

  it('never grants posting or collection hand-over', () => {
    expect(can('transactions.post', 'district_secretary', false, true)).toBe(false)
    expect(can('collections.submit', 'district_secretary', false, true)).toBe(false)
    expect(can('collections.post', 'district_secretary', false, true)).toBe(false)
  })
})

describe('events and departments', () => {
  it('lets district coordination roles manage events and departments', () => {
    expect(rolesFor('events.manage')).toEqual(['district_pastor', 'district_coordinator', 'district_secretary'])
    expect(rolesFor('departments.manage')).toEqual(['district_pastor', 'district_coordinator', 'district_secretary'])
  })
})

describe('collections', () => {
  it('records collections only through regional, assembly and ministerial secretaries', () => {
    expect(rolesFor('collections.record')).toEqual([
      'regional_secretary',
      'assembly_secretary',
      'ministerial_secretary',
    ])
  })

  it('submits and posts collections only through the Accounting Officer and Assistant', () => {
    expect(rolesFor('collections.submit')).toEqual(['accounting_officer', 'assistant_accounting_officer'])
    expect(rolesFor('collections.post')).toEqual(['accounting_officer', 'assistant_accounting_officer'])
    expect(can('collections.submit', 'district_pastor')).toBe(false)
  })

  it('scopes collection access by role', () => {
    expect(collectionScope('collections.view', 'district_pastor')).toBe('district')
    expect(collectionScope('collections.view', 'accounting_officer')).toBe('district')
    expect(collectionScope('collections.view', 'regional_pastor')).toBe('scope')
    expect(collectionScope('collections.view', 'assembly_coordinator')).toBe('scope')
    expect(collectionScope('collections.view', 'ministerial_chairperson')).toBe('scope')
    expect(collectionScope('collections.record', 'regional_pastor')).toBeNull()
    expect(collectionScope('collections.record', 'assembly_secretary')).toBe('scope')
    expect(collectionScope('collections.view', 'district_secretary')).toBeNull()
  })
})

describe('scope helpers', () => {
  it('knows which unit each scoped role is tied to', () => {
    expect(roleScopeKind('regional_secretary')).toBe('region')
    expect(roleScopeKind('assembly_coordinator')).toBe('assembly')
    expect(roleScopeKind('ministerial_secretary')).toBe('ministry')
    expect(roleScopeKind('departmental_chairperson')).toBe('department')
    expect(roleScopeKind('accounting_officer')).toBeNull()
  })

  const hierarchy = [
    { id: 'district', parent_id: null },
    { id: 'region-a', parent_id: 'district' },
    { id: 'region-b', parent_id: 'district' },
    { id: 'assembly-a1', parent_id: 'region-a' },
    { id: 'person-a1', parent_id: 'assembly-a1' },
  ]

  it('covers the unit itself and everything beneath it', () => {
    expect(isWithinScope('region-a', 'region-a', hierarchy)).toBe(true)
    expect(isWithinScope('region-a', 'assembly-a1', hierarchy)).toBe(true)
    expect(isWithinScope('region-a', 'person-a1', hierarchy)).toBe(true)
  })

  it('excludes other units and missing ids', () => {
    expect(isWithinScope('region-b', 'assembly-a1', hierarchy)).toBe(false)
    expect(isWithinScope('assembly-a1', 'region-a', hierarchy)).toBe(false)
    expect(isWithinScope(null, 'assembly-a1', hierarchy)).toBe(false)
    expect(isWithinScope('region-a', null, hierarchy)).toBe(false)
  })
})

describe('superusers', () => {
  it('bypass district role checks', () => {
    expect(can('district.users.manage', null, true)).toBe(true)
    expect(can('transactions.post', null, true)).toBe(true)
    expect(collectionScope('collections.record', null, true)).toBe('district')
  })
})
