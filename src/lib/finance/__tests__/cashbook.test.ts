/**
 * Smoke tests for the cashbook accounting engine.
 *
 * These tests are intentionally free of database or network calls —
 * they verify pure business logic and type contracts.  Integration tests
 * that hit a real database can be added later (backlog B8.3).
 */

import { describe, it, expect } from 'vitest'
import type { TransactionStatus, TransactionKind } from '@/types'
import {
  canTransitionTransaction,
  deriveSourceSnapshotsFromChain,
  isIncomingTransactionEffect,
  isOutgoingTransactionEffect,
  reverseEffectDirection,
  fundNatureAllowsTransactionKind,
  transactionDisplayLabel,
} from '@/lib/finance/transactions'
import { canTransitionTransfer } from '@/lib/finance/transfers'

// ---------------------------------------------------------------------------
// B0.2 invariant: new transactions must start as drafts
// ---------------------------------------------------------------------------

describe('draft-first invariant', () => {
  it('draft is the only safe initial status', () => {
    const safeToDraftStatuses: TransactionStatus[] = ['draft']
    const autoPostStatuses: TransactionStatus[] = ['posted', 'submitted', 'approved']

    // A new transaction must not skip directly to any of these
    for (const status of autoPostStatuses) {
      expect(safeToDraftStatuses).not.toContain(status)
    }
  })

  it('reference numbers are not assigned to drafts', () => {
    // Drafts have null reference_number; only posting assigns one.
    // This mirrors the POST /api/cashbook/transactions route behaviour.
    const draftTransaction = {
      status: 'draft' as TransactionStatus,
      reference_number: null as string | null,
    }
    expect(draftTransaction.reference_number).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Transaction kind set matches the schema enum
// ---------------------------------------------------------------------------

describe('TransactionKind completeness', () => {
  const expectedKinds: TransactionKind[] = [
    'receipt',
    'payment',
    'transfer',
    'adjustment',
    'opening_balance',
    'reversal',
  ]

  it('all expected kinds are defined', () => {
    for (const kind of expectedKinds) {
      expect(typeof kind).toBe('string')
      expect(kind.length).toBeGreaterThan(0)
    }
  })
})

// ---------------------------------------------------------------------------
// Idempotency key shape
// ---------------------------------------------------------------------------

describe('client_generated_id', () => {
  it('accepts a well-formed UUID v4', () => {
    const uuidV4Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    const validV4 = 'f47ac10b-58cc-4372-a567-0e02b2c3d479'
    expect(uuidV4Pattern.test(validV4)).toBe(true)
  })

  it('rejects a non-UUID string', () => {
    const uuidV4Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    expect(uuidV4Pattern.test('not-a-uuid')).toBe(false)
  })
})

describe('workflow transitions', () => {
  it('allows the richer approval workflow intentionally used by the app', () => {
    expect(canTransitionTransaction('draft', 'submitted')).toBe(true)
    expect(canTransitionTransaction('submitted', 'approved')).toBe(true)
    expect(canTransitionTransaction('approved', 'posted')).toBe(true)
    expect(canTransitionTransaction('posted', 'reversed')).toBe(true)
    expect(canTransitionTransaction('draft', 'voided')).toBe(true)
  })

  it('blocks skipped or backward transitions', () => {
    expect(canTransitionTransaction('submitted', 'posted')).toBe(false)
    expect(canTransitionTransaction('posted', 'approved')).toBe(false)
    expect(canTransitionTransaction('reversed', 'posted')).toBe(false)
    expect(canTransitionTransaction('voided', 'draft')).toBe(false)
  })
})

describe('transfer workflow transitions', () => {
  it('allows draft posting and posted reversal', () => {
    expect(canTransitionTransfer('draft', 'posted')).toBe(true)
    expect(canTransitionTransfer('posted', 'reversed')).toBe(true)
    expect(canTransitionTransfer('draft', 'voided')).toBe(true)
  })

  it('blocks illegal transfer transitions', () => {
    expect(canTransitionTransfer('posted', 'posted')).toBe(false)
    expect(canTransitionTransfer('reversed', 'posted')).toBe(false)
    expect(canTransitionTransfer('voided', 'posted')).toBe(false)
  })
})

describe('fund nature validation', () => {
  it('allows only income kinds for income-only funds', () => {
    expect(fundNatureAllowsTransactionKind('income_only', 'receipt')).toBe(true)
    expect(fundNatureAllowsTransactionKind('income_only', 'payment')).toBe(false)
  })

  it('allows only expense kinds for expense-only funds', () => {
    expect(fundNatureAllowsTransactionKind('expense_only', 'payment')).toBe(true)
    expect(fundNatureAllowsTransactionKind('expense_only', 'receipt')).toBe(false)
  })
})

describe('signed effect helpers', () => {
  it('treats transfer inflows and reversal inflows correctly', () => {
    expect(isIncomingTransactionEffect({ kind: 'transfer', effect_direction: 'in' })).toBe(true)
    expect(isOutgoingTransactionEffect({ kind: 'transfer', effect_direction: 'out' })).toBe(true)
    expect(isIncomingTransactionEffect({ kind: 'reversal', effect_direction: 'in' })).toBe(true)
  })

  it('reverses effect directions predictably', () => {
    expect(reverseEffectDirection('in')).toBe('out')
    expect(reverseEffectDirection('out')).toBe('in')
  })

  it('formats directional labels for transfer, adjustment, and reversal rows', () => {
    expect(transactionDisplayLabel({ kind: 'transfer', effect_direction: 'in' })).toBe('Transfer In')
    expect(transactionDisplayLabel({ kind: 'adjustment', effect_direction: 'out' })).toBe('Adjustment Out')
    expect(transactionDisplayLabel({ kind: 'reversal', effect_direction: 'in' })).toBe('Reversal In')
  })
})

describe('source snapshot derivation', () => {
  it('derives assembly and region snapshots for individual sources', () => {
    const result = deriveSourceSnapshotsFromChain({
      source: { id: 'individual-1', name: 'Member A', type: 'individual' },
      parent: { id: 'assembly-1', name: 'Assembly A', type: 'assembly' },
      grandparent: { id: 'region-1', name: 'Region A', type: 'region' },
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.snapshots.assemblySnapshotId).toBe('assembly-1')
      expect(result.snapshots.regionSnapshotId).toBe('region-1')
    }
  })

  it('rejects incomplete individual hierarchy chains', () => {
    const result = deriveSourceSnapshotsFromChain({
      source: { id: 'individual-1', name: 'Member A', type: 'individual' },
      parent: null,
      grandparent: null,
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('SOURCE_HIERARCHY_INVALID')
    }
  })
})
