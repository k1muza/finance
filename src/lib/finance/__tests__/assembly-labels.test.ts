import { describe, expect, it } from 'vitest'
import { getAssemblyLabel } from '@/lib/finance/assembly-labels'

describe('getAssemblyLabel', () => {
  it.each([
    ['Southgate Christian Center International', 'SCCI'],
    ['Ezekiel Christian Center International', 'ECCI'],
    ['Sunningdale', 'SD'],
    ['Sunningdale district', 'SD'],
    ['Southlea Park D1', 'SPD1'],
  ])('formats %s as %s', (name, expected) => {
    expect(getAssemblyLabel(name)).toBe(expected)
  })

  it('uses initials for assemblies without an explicit label', () => {
    expect(getAssemblyLabel('Northern City Assembly')).toBe('NCA')
    expect(getAssemblyLabel(null)).toBe('Unassigned')
  })
})
