import { describe, expect, it } from 'vitest'
import { wouldRemoveLastAdmin } from '@/lib/auth/district-users'

describe('wouldRemoveLastAdmin', () => {
  const admin = { role: 'admin', is_active: true }

  it('blocks demoting or deactivating the only active admin', () => {
    expect(wouldRemoveLastAdmin(admin, { role: 'treasurer' }, 1)).toBe(true)
    expect(wouldRemoveLastAdmin(admin, { is_active: false }, 1)).toBe(true)
  })

  it('allows it when another active admin remains', () => {
    expect(wouldRemoveLastAdmin(admin, { role: 'treasurer' }, 2)).toBe(false)
    expect(wouldRemoveLastAdmin(admin, { is_active: false }, 2)).toBe(false)
  })

  it('ignores changes that keep the user an active admin', () => {
    expect(wouldRemoveLastAdmin(admin, { role: 'admin', is_active: true }, 1)).toBe(false)
  })

  it('ignores non-admin and inactive targets', () => {
    expect(wouldRemoveLastAdmin({ role: 'clerk', is_active: true }, { is_active: false }, 1)).toBe(false)
    expect(wouldRemoveLastAdmin({ role: 'admin', is_active: false }, { role: 'viewer' }, 1)).toBe(false)
  })
})
