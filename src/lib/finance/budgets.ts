import type { BudgetStatus } from '@/types'

export function isBudgetEditable(status: BudgetStatus) {
  return status === 'draft'
}

export function canTransitionBudget(
  from: BudgetStatus,
  to: BudgetStatus,
) {
  if (from === to) return false
  if (from === 'draft' && to === 'active') return true
  if (from === 'active' && to === 'closed') return true
  return false
}
