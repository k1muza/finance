import {
  TRANSACTION_KIND_LABELS,
} from '@/types'
import type {
  CashbookEffectDirection,
  CashbookTransaction,
  FundNature,
  SourceType,
  TransactionKind,
  TransactionStatus,
} from '@/types'

export const TRANSACTION_ALLOWED_TRANSITIONS: Record<
  TransactionStatus,
  readonly TransactionStatus[]
> = {
  draft: ['submitted', 'voided'],
  submitted: ['approved'],
  approved: ['posted'],
  posted: ['reversed'],
  reversed: [],
  voided: [],
}

export function canTransitionTransaction(
  from: TransactionStatus,
  to: TransactionStatus,
) {
  return TRANSACTION_ALLOWED_TRANSITIONS[from].includes(to)
}

export function transactionKindRequiresFund(kind: TransactionKind) {
  return kind === 'receipt' || kind === 'payment'
}

export function transactionKindNeedsCounterpartyOrSource(kind: TransactionKind) {
  return kind === 'receipt' || kind === 'payment'
}

export function fundNatureAllowsTransactionKind(
  nature: FundNature,
  kind: TransactionKind,
) {
  const incomeKinds: TransactionKind[] = ['receipt', 'opening_balance', 'adjustment']
  const expenseKinds: TransactionKind[] = ['payment', 'adjustment', 'transfer']

  if (nature === 'income_only') return incomeKinds.includes(kind)
  if (nature === 'expense_only') return expenseKinds.includes(kind)
  return true
}

export function defaultEffectDirectionForTransactionKind(
  kind: TransactionKind,
): CashbookEffectDirection | null {
  switch (kind) {
    case 'receipt':
    case 'opening_balance':
      return 'in'
    case 'payment':
    case 'transfer':
      return 'out'
    case 'adjustment':
      return 'in'
    default:
      return null
  }
}

export function reverseEffectDirection(
  direction: CashbookEffectDirection,
): CashbookEffectDirection {
  return direction === 'in' ? 'out' : 'in'
}

type DirectionalTransaction = Pick<CashbookTransaction, 'kind' | 'effect_direction'>

export function transactionEffectDirection(
  txn: DirectionalTransaction,
): CashbookEffectDirection | null {
  return txn.effect_direction ?? defaultEffectDirectionForTransactionKind(txn.kind)
}

export function isIncomingTransactionEffect(txn: DirectionalTransaction) {
  return transactionEffectDirection(txn) === 'in'
}

export function isOutgoingTransactionEffect(txn: DirectionalTransaction) {
  return transactionEffectDirection(txn) === 'out'
}

export function shouldIncludeInFundReporting(
  txn: Pick<CashbookTransaction, 'kind'>,
) {
  return txn.kind !== 'transfer'
}

export function transactionDisplayLabel(txn: DirectionalTransaction) {
  if (txn.kind === 'transfer') {
    return transactionEffectDirection(txn) === 'in' ? 'Transfer In' : 'Transfer Out'
  }

  if (txn.kind === 'adjustment') {
    return transactionEffectDirection(txn) === 'out' ? 'Adjustment Out' : 'Adjustment In'
  }

  if (txn.kind === 'reversal') {
    return transactionEffectDirection(txn) === 'in' ? 'Reversal In' : 'Reversal Out'
  }

  return TRANSACTION_KIND_LABELS[txn.kind]
}

export interface SourceSnapshotChainNode {
  id: string
  name: string
  type: SourceType
}

export interface SourceSnapshotChain {
  source: SourceSnapshotChainNode
  parent: SourceSnapshotChainNode | null
  grandparent: SourceSnapshotChainNode | null
}

export interface DerivedSourceSnapshots {
  sourceNameSnapshot: string | null
  sourceTypeSnapshot: string | null
  sourceParentNameSnapshot: string | null
  assemblySnapshotId: string | null
  regionSnapshotId: string | null
}

export function deriveSourceSnapshotsFromChain(
  chain: SourceSnapshotChain | null,
):
  | { ok: true; snapshots: DerivedSourceSnapshots }
  | { ok: false; code: string; message: string } {
  if (!chain) {
    return {
      ok: true,
      snapshots: {
        sourceNameSnapshot: null,
        sourceTypeSnapshot: null,
        sourceParentNameSnapshot: null,
        assemblySnapshotId: null,
        regionSnapshotId: null,
      },
    }
  }

  const baseSnapshots: DerivedSourceSnapshots = {
    sourceNameSnapshot: chain.source.name,
    sourceTypeSnapshot: chain.source.type,
    sourceParentNameSnapshot: chain.parent?.name ?? null,
    assemblySnapshotId: null,
    regionSnapshotId: null,
  }

  switch (chain.source.type) {
    case 'individual': {
      if (!chain.parent || chain.parent.type !== 'assembly') {
        return {
          ok: false,
          code: 'SOURCE_HIERARCHY_INVALID',
          message: 'Individual sources must belong to an assembly before posting.',
        }
      }
      if (!chain.grandparent || chain.grandparent.type !== 'region') {
        return {
          ok: false,
          code: 'SOURCE_HIERARCHY_INVALID',
          message: 'Individual sources must roll up to a region before posting.',
        }
      }

      return {
        ok: true,
        snapshots: {
          ...baseSnapshots,
          assemblySnapshotId: chain.parent.id,
          regionSnapshotId: chain.grandparent.id,
        },
      }
    }

    case 'assembly': {
      if (!chain.parent || chain.parent.type !== 'region') {
        return {
          ok: false,
          code: 'SOURCE_HIERARCHY_INVALID',
          message: 'Assembly sources must belong to a region before posting.',
        }
      }

      return {
        ok: true,
        snapshots: {
          ...baseSnapshots,
          assemblySnapshotId: chain.source.id,
          regionSnapshotId: chain.parent.id,
        },
      }
    }

    case 'region':
      return {
        ok: true,
        snapshots: {
          ...baseSnapshots,
          regionSnapshotId: chain.source.id,
        },
      }

    default:
      return { ok: true, snapshots: baseSnapshots }
  }
}
