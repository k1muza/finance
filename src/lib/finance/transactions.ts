import {
  TRANSACTION_KIND_LABELS,
} from '@/types'
import type {
  CashbookEffectDirection,
  CashbookTransaction,
  FundNature,
  MemberType,
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

export function transactionKindNeedsPartyDetails(kind: TransactionKind) {
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

export interface MemberSnapshotChainNode {
  id: string
  name: string
  type: MemberType
}

export interface MemberSnapshotChain {
  member: MemberSnapshotChainNode
  parent: MemberSnapshotChainNode | null
  grandparent: MemberSnapshotChainNode | null
}

export interface DerivedMemberSnapshots {
  memberNameSnapshot: string | null
  memberTypeSnapshot: string | null
  memberParentNameSnapshot: string | null
  assemblyMemberSnapshotId: string | null
  regionMemberSnapshotId: string | null
}

export function deriveMemberSnapshotsFromChain(
  chain: MemberSnapshotChain | null,
):
  | { ok: true; snapshots: DerivedMemberSnapshots }
  | { ok: false; code: string; message: string } {
  if (!chain) {
    return {
      ok: true,
      snapshots: {
        memberNameSnapshot: null,
        memberTypeSnapshot: null,
        memberParentNameSnapshot: null,
        assemblyMemberSnapshotId: null,
        regionMemberSnapshotId: null,
      },
    }
  }

  const baseSnapshots: DerivedMemberSnapshots = {
    memberNameSnapshot: chain.member.name,
    memberTypeSnapshot: chain.member.type,
    memberParentNameSnapshot: chain.parent?.name ?? null,
    assemblyMemberSnapshotId: null,
    regionMemberSnapshotId: null,
  }

  switch (chain.member.type) {
    case 'individual': {
      if (!chain.parent || chain.parent.type !== 'assembly') {
        return {
          ok: false,
          code: 'MEMBER_HIERARCHY_INVALID',
          message: 'Individual members must belong to an assembly before posting.',
        }
      }
      if (!chain.grandparent || chain.grandparent.type !== 'region') {
        return {
          ok: false,
          code: 'MEMBER_HIERARCHY_INVALID',
          message: 'Individual members must roll up to a region before posting.',
        }
      }

      return {
        ok: true,
        snapshots: {
          ...baseSnapshots,
          assemblyMemberSnapshotId: chain.parent.id,
          regionMemberSnapshotId: chain.grandparent.id,
        },
      }
    }

    case 'assembly': {
      if (!chain.parent || chain.parent.type !== 'region') {
        return {
          ok: false,
          code: 'MEMBER_HIERARCHY_INVALID',
          message: 'Assembly members must belong to a region before posting.',
        }
      }

      return {
        ok: true,
        snapshots: {
          ...baseSnapshots,
          assemblyMemberSnapshotId: chain.member.id,
          regionMemberSnapshotId: chain.parent.id,
        },
      }
    }

    case 'region':
      return {
        ok: true,
        snapshots: {
          ...baseSnapshots,
          regionMemberSnapshotId: chain.member.id,
        },
      }

    default:
      return { ok: true, snapshots: baseSnapshots }
  }
}
