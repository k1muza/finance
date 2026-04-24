import type { CashbookTransaction } from '@/types'

export type CashbookBulkAction = 'submit' | 'post' | 'void' | 'reverse'

export const CASHBOOK_BULK_ACTION_LABELS: Record<CashbookBulkAction, string> = {
  submit: 'Submit',
  post: 'Post',
  void: 'Void',
  reverse: 'Reverse',
}

export const CASHBOOK_BULK_ACTION_SUCCESS_LABELS: Record<CashbookBulkAction, string> = {
  submit: 'Submitted',
  post: 'Posted',
  void: 'Voided',
  reverse: 'Reversed',
}

interface CashbookBulkActionContext {
  autoPostTransactions: boolean
  canDraftTransactions: boolean
  canReverseTransactions: boolean
}

const CASHBOOK_BULK_ACTION_ORDER: CashbookBulkAction[] = ['submit', 'post', 'void', 'reverse']

export function canReverseCashbookTransaction(
  transaction: Pick<CashbookTransaction, 'status' | 'kind' | 'source_transaction_id' | 'transfer_id'>,
) {
  return transaction.status === 'posted'
    && transaction.kind !== 'reversal'
    && !transaction.source_transaction_id
    && !transaction.transfer_id
}

export function getCashbookBulkActionsForTransaction(
  transaction: Pick<CashbookTransaction, 'status' | 'kind' | 'source_transaction_id' | 'transfer_id'>,
  context: CashbookBulkActionContext,
) {
  const actions: CashbookBulkAction[] = []

  if (transaction.status === 'draft' && context.canDraftTransactions) {
    actions.push('submit')

    if (context.autoPostTransactions) {
      actions.push('post')
    }

    actions.push('void')
  }

  if (transaction.status === 'submitted' && context.canDraftTransactions) {
    if (context.autoPostTransactions) {
      actions.push('post')
    }

    actions.push('void')
  }

  if (context.canReverseTransactions && canReverseCashbookTransaction(transaction)) {
    actions.push('reverse')
  }

  return actions
}

export function buildCashbookBulkActionOptions(
  transactions: Pick<CashbookTransaction, 'status' | 'kind' | 'source_transaction_id' | 'transfer_id'>[],
  context: CashbookBulkActionContext,
) {
  const availableActions = new Set<CashbookBulkAction>()

  // Always offer Post when auto-posting is enabled, even if no draft
  // transactions are currently visible — the user may be about to select some.
  if (context.autoPostTransactions && context.canDraftTransactions) {
    availableActions.add('post')
  }

  for (const transaction of transactions) {
    for (const action of getCashbookBulkActionsForTransaction(transaction, context)) {
      availableActions.add(action)
    }
  }

  return CASHBOOK_BULK_ACTION_ORDER
    .filter((action) => availableActions.has(action))
    .map((action) => ({
      value: action,
      label: CASHBOOK_BULK_ACTION_LABELS[action],
    }))
}

export function getCashbookBulkActionTransactionIds(
  transactions: Pick<CashbookTransaction, 'id' | 'status' | 'kind' | 'source_transaction_id' | 'transfer_id'>[],
  action: CashbookBulkAction,
  context: CashbookBulkActionContext,
) {
  return transactions
    .filter((transaction) => getCashbookBulkActionsForTransaction(transaction, context).includes(action))
    .map((transaction) => transaction.id)
}
