import type { TransferStatus } from '@/types'

export const TRANSFER_ALLOWED_TRANSITIONS: Record<
  TransferStatus,
  readonly TransferStatus[]
> = {
  draft: ['posted', 'voided'],
  posted: ['reversed'],
  reversed: [],
  voided: [],
}

export function canTransitionTransfer(
  from: TransferStatus,
  to: TransferStatus,
) {
  return TRANSFER_ALLOWED_TRANSITIONS[from].includes(to)
}
