import type {
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
  const expenseKinds: TransactionKind[] = ['payment', 'transfer']

  if (nature === 'income_only') return incomeKinds.includes(kind)
  if (nature === 'expense_only') return expenseKinds.includes(kind)
  return true
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
