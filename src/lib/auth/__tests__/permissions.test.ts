import { describe, expect, it } from 'vitest'
import {
  can,
  normalizeDistrictRole,
  rolesFor,
} from '@/lib/auth/permissions'

describe('district role normalization', () => {
  it('maps legacy roles to the current district roles', () => {
    expect(normalizeDistrictRole('preparer')).toBe('clerk')
    expect(normalizeDistrictRole('approver')).toBe('treasurer')
  })

  it('keeps current roles unchanged', () => {
    expect(normalizeDistrictRole('secretary')).toBe('secretary')
    expect(normalizeDistrictRole('viewer')).toBe('viewer')
  })
})

describe('district action permissions', () => {
  it('allows drafting but blocks posting for clerks', () => {
    expect(can('transactions.draft', 'clerk')).toBe(true)
    expect(can('transactions.post', 'clerk')).toBe(false)
    expect(can('transfers.post', 'clerk')).toBe(false)
  })

  it('allows treasurers to post and reverse transactions and transfers', () => {
    expect(can('transactions.post', 'treasurer')).toBe(true)
    expect(can('transactions.reverse', 'treasurer')).toBe(true)
    expect(can('transfers.post', 'treasurer')).toBe(true)
    expect(can('transfers.reverse', 'treasurer')).toBe(true)
  })

  it('limits viewers to read-only reporting access', () => {
    expect(can('reports.view', 'viewer')).toBe(true)
    expect(can('transactions.view', 'viewer')).toBe(true)
    expect(can('transactions.draft', 'viewer')).toBe(false)
    expect(can('transfers.draft', 'viewer')).toBe(false)
  })

  it('lets superusers bypass district role checks', () => {
    expect(can('district.users.manage', null, true)).toBe(true)
    expect(can('transactions.post', null, true)).toBe(true)
    expect(can('transfers.reverse', null, true)).toBe(true)
  })
})

describe('role lookup helpers', () => {
  it('returns the expected roles for transaction posting', () => {
    expect(rolesFor('transactions.post')).toEqual([
      'admin',
      'secretary',
      'treasurer',
    ])
  })

  it('returns the expected roles for transfer reversals', () => {
    expect(rolesFor('transfers.reverse')).toEqual([
      'admin',
      'treasurer',
    ])
  })
})
