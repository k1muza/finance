import { describe, expect, it } from 'vitest'
import { canTransitionBudget, isBudgetEditable } from '@/lib/finance/budgets'

describe('budget helpers', () => {
  it('marks only draft budgets as editable', () => {
    expect(isBudgetEditable('draft')).toBe(true)
    expect(isBudgetEditable('active')).toBe(false)
    expect(isBudgetEditable('closed')).toBe(false)
  })

  it('only allows draft to active and active to closed transitions', () => {
    expect(canTransitionBudget('draft', 'active')).toBe(true)
    expect(canTransitionBudget('active', 'closed')).toBe(true)

    expect(canTransitionBudget('draft', 'draft')).toBe(false)
    expect(canTransitionBudget('draft', 'closed')).toBe(false)
    expect(canTransitionBudget('active', 'draft')).toBe(false)
    expect(canTransitionBudget('active', 'active')).toBe(false)
    expect(canTransitionBudget('closed', 'draft')).toBe(false)
    expect(canTransitionBudget('closed', 'active')).toBe(false)
    expect(canTransitionBudget('closed', 'closed')).toBe(false)
  })
})
