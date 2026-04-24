import type {
  Budget,
  BudgetLine,
  BudgetStatus,
  CashbookTransaction,
  Currency,
  MemberType,
} from '@/types'
import {
  COUNTERPARTY_TYPE_LABELS,
  MEMBER_TYPE_LABELS,
} from '@/types'
import {
  isIncomingTransactionEffect,
  isOutgoingTransactionEffect,
  shouldIncludeInFundReporting,
} from '@/lib/finance/transactions'

export function buildCashbookFundBalances(transactions: CashbookTransaction[]) {
  const rows = new Map<string, FundBalanceRow>()

  const ensureRow = (
    district_id: string,
    fund_id: string | null,
    fund_name: string,
    currency: Currency
  ) => {
    const key = `${district_id}:${fund_id ?? 'unassigned'}:${currency}`
    if (!rows.has(key)) {
      rows.set(key, {
        district_id,
        district_name: '',
        fund_id,
        fund_name,
        currency,
        income_total: 0,
        expense_total: 0,
        net_balance: 0,
      })
    }
    return rows.get(key)!
  }

  for (const txn of transactions) {
    if (!shouldIncludeInFundReporting(txn)) continue

    const row = ensureRow(
      txn.district_id,
      txn.fund_id,
      (txn.fund as { name?: string } | null)?.name ?? 'Unassigned',
      txn.currency
    )
    if (isIncomingTransactionEffect(txn)) {
      row.income_total += Number(txn.total_amount)
    } else {
      row.expense_total += Number(txn.total_amount)
    }
    row.net_balance = row.income_total - row.expense_total
  }

  return [...rows.values()].sort((a, b) =>
    a.currency.localeCompare(b.currency)
    || b.net_balance - a.net_balance
    || a.fund_name.localeCompare(b.fund_name)
  )
}

export function buildCashbookTotalsByCurrency(transactions: CashbookTransaction[]) {
  const inByCurrency: Partial<Record<Currency, number>> = {}
  const outByCurrency: Partial<Record<Currency, number>> = {}

  for (const txn of transactions) {
    if (!shouldIncludeInFundReporting(txn)) continue

    if (isIncomingTransactionEffect(txn)) {
      inByCurrency[txn.currency] = (inByCurrency[txn.currency] ?? 0) + Number(txn.total_amount)
    } else {
      outByCurrency[txn.currency] = (outByCurrency[txn.currency] ?? 0) + Number(txn.total_amount)
    }
  }

  return { inByCurrency, outByCurrency }
}

export interface FundBalanceRow {
  district_id: string
  district_name: string
  fund_id: string | null
  fund_name: string
  currency: Currency
  income_total: number
  expense_total: number
  net_balance: number
}

export type FundLeaderboardParticipantKind =
  | 'member'
  | 'counterparty'
  | 'freeform'
  | 'unknown'

export interface FundLeaderboardEntry {
  participant_key: string
  participant_name: string
  participant_kind: FundLeaderboardParticipantKind
  participant_type_label: string
  participant_context: string | null
  participant_region: string | null
  member_type: MemberType | null
  incoming_total: number
  outgoing_total: number
  net_total: number
  total_volume: number
  transaction_count: number
  contribution_count: number
  expense_count: number
  last_transaction_date: string | null
}

export interface FundLeaderboardCurrencyGroup {
  currency: Currency
  transaction_count: number
  participant_count: number
  total_incoming: number
  total_outgoing: number
  net_total: number
  incoming_leaders: FundLeaderboardEntry[]
  outgoing_leaders: FundLeaderboardEntry[]
  activity_leaders: FundLeaderboardEntry[]
  entries: FundLeaderboardEntry[]
}

function normalizePartyName(value: string) {
  return value.trim().replace(/\s+/g, ' ')
}

function resolveFundLeaderboardParticipant(transaction: CashbookTransaction) {
  const memberName = normalizePartyName(
    transaction.member?.name
    ?? transaction.member_name_snapshot
    ?? '',
  )

  if (memberName) {
    const memberType = (
      transaction.member_type_snapshot
      ?? transaction.member?.type
      ?? null
    ) as MemberType | null
    const parentName = normalizePartyName(transaction.member_parent_name_snapshot ?? '')
    const regionName = normalizePartyName(
      (transaction.region_member_snapshot as { name?: string } | null)?.name ?? '',
    )

    return {
      key: transaction.member_id
        ? `member:${transaction.member_id}`
        : `member_snapshot:${memberType ?? 'unknown'}:${memberName.toLowerCase()}:${parentName.toLowerCase()}`,
      name: memberName,
      kind: 'member' as const,
      typeLabel: memberType ? MEMBER_TYPE_LABELS[memberType] : 'Member',
      context: parentName || null,
      region: regionName || null,
      memberType,
    }
  }

  const registeredCounterparty = normalizePartyName(transaction.counterparty_record?.name ?? '')
  if (registeredCounterparty) {
    return {
      key: transaction.counterparty_id
        ? `counterparty:${transaction.counterparty_id}`
        : `counterparty_name:${registeredCounterparty.toLowerCase()}`,
      name: registeredCounterparty,
      kind: 'counterparty' as const,
      typeLabel: transaction.counterparty_record?.type
        ? COUNTERPARTY_TYPE_LABELS[transaction.counterparty_record.type]
        : 'Counterparty',
      context: 'Registered',
      region: null,
      memberType: null,
    }
  }

  const freeformCounterparty = normalizePartyName(transaction.counterparty ?? '')
  if (freeformCounterparty) {
    return {
      key: `freeform:${freeformCounterparty.toLowerCase()}`,
      name: freeformCounterparty,
      kind: 'freeform' as const,
      typeLabel: 'Recorded name',
      context: null,
      region: null,
      memberType: null,
    }
  }

  return {
    key: 'unknown:unspecified',
    name: 'Unspecified party',
    kind: 'unknown' as const,
    typeLabel: 'Unknown',
    context: null,
    region: null,
    memberType: null,
  }
}

function compareLeaderboardActivity(a: FundLeaderboardEntry, b: FundLeaderboardEntry) {
  return (
    b.total_volume - a.total_volume
    || b.transaction_count - a.transaction_count
    || b.net_total - a.net_total
    || a.participant_name.localeCompare(b.participant_name)
  )
}

function compareLeaderboardIncoming(a: FundLeaderboardEntry, b: FundLeaderboardEntry) {
  return (
    b.incoming_total - a.incoming_total
    || b.transaction_count - a.transaction_count
    || b.net_total - a.net_total
    || a.participant_name.localeCompare(b.participant_name)
  )
}

function compareLeaderboardOutgoing(a: FundLeaderboardEntry, b: FundLeaderboardEntry) {
  return (
    b.outgoing_total - a.outgoing_total
    || b.transaction_count - a.transaction_count
    || a.participant_name.localeCompare(b.participant_name)
  )
}

export function buildFundLeaderboard(transactions: CashbookTransaction[]) {
  const groups = new Map<
    Currency,
    {
      transaction_count: number
      total_incoming: number
      total_outgoing: number
      entries: Map<string, FundLeaderboardEntry>
    }
  >()

  for (const transaction of transactions) {
    if (transaction.status !== 'posted') continue
    if (!shouldIncludeInFundReporting(transaction)) continue

    const amount = Number(transaction.total_amount)
    const currency = transaction.currency
    const participant = resolveFundLeaderboardParticipant(transaction)

    if (!groups.has(currency)) {
      groups.set(currency, {
        transaction_count: 0,
        total_incoming: 0,
        total_outgoing: 0,
        entries: new Map<string, FundLeaderboardEntry>(),
      })
    }

    const group = groups.get(currency)!
    group.transaction_count += 1

    if (!group.entries.has(participant.key)) {
      group.entries.set(participant.key, {
        participant_key: participant.key,
        participant_name: participant.name,
        participant_kind: participant.kind,
        participant_type_label: participant.typeLabel,
        participant_context: participant.context,
        participant_region: participant.region,
        member_type: participant.memberType,
        incoming_total: 0,
        outgoing_total: 0,
        net_total: 0,
        total_volume: 0,
        transaction_count: 0,
        contribution_count: 0,
        expense_count: 0,
        last_transaction_date: null,
      })
    }

    const entry = group.entries.get(participant.key)!
    entry.transaction_count += 1
    entry.last_transaction_date = entry.last_transaction_date
      ? (entry.last_transaction_date > transaction.transaction_date
        ? entry.last_transaction_date
        : transaction.transaction_date)
      : transaction.transaction_date

    if (isIncomingTransactionEffect(transaction)) {
      entry.incoming_total += amount
      entry.contribution_count += 1
      group.total_incoming += amount
    } else {
      entry.outgoing_total += amount
      entry.expense_count += 1
      group.total_outgoing += amount
    }

    entry.net_total = entry.incoming_total - entry.outgoing_total
    entry.total_volume = entry.incoming_total + entry.outgoing_total
  }

  return [...groups.entries()]
    .map(([currency, group]) => {
      const entries = [...group.entries.values()].sort(compareLeaderboardActivity)

      return {
        currency,
        transaction_count: group.transaction_count,
        participant_count: entries.length,
        total_incoming: group.total_incoming,
        total_outgoing: group.total_outgoing,
        net_total: group.total_incoming - group.total_outgoing,
        incoming_leaders: [...entries]
          .filter((entry) => entry.incoming_total > 0)
          .sort(compareLeaderboardIncoming),
        outgoing_leaders: [...entries]
          .filter((entry) => entry.outgoing_total > 0)
          .sort(compareLeaderboardOutgoing),
        activity_leaders: [...entries].sort(compareLeaderboardActivity),
        entries,
      }
    })
    .sort((a, b) => a.currency.localeCompare(b.currency))
}

export interface BudgetComparisonLineRow {
  budget_id: string
  budget_name: string
  budget_status: BudgetStatus
  budget_line_id: string
  start_date: string
  end_date: string
  fund_id: string
  fund_name: string
  line_description: string
  currency: Currency
  scope_member_id: string | null
  scope_member_name: string | null
  scope_member_type: MemberType | null
  budget_amount: number
  actual_amount: number
  variance_amount: number
}

export interface BudgetComparisonCurrencySummary {
  currency: Currency
  budget_total: number
  actual_total: number
  variance_total: number
}

function shouldIncludeInBudgetExpenseActuals(
  transaction: CashbookTransaction,
) {
  if (!shouldIncludeInFundReporting(transaction)) return false
  if (transaction.kind === 'payment') return true
  return transaction.kind === 'adjustment' && isOutgoingTransactionEffect(transaction)
}

function matchesBudgetLineScope(
  transaction: CashbookTransaction,
  line: BudgetLine,
) {
  if (!line.scope_member_id) return true

  const scopeType = line.scope_member?.type ?? null

  if (scopeType === 'region') {
    return transaction.region_member_snapshot_id === line.scope_member_id
  }

  if (scopeType === 'assembly') {
    return transaction.assembly_member_snapshot_id === line.scope_member_id
  }

  return transaction.member_id === line.scope_member_id
}

export function buildBudgetComparisonRows(
  budget: Budget | null | undefined,
  transactions: CashbookTransaction[],
) {
  if (!budget) return [] as BudgetComparisonLineRow[]

  const rows = (budget.lines ?? []).map((line) => {
    const actualAmount = transactions.reduce((total, transaction) => {
      if (transaction.status !== 'posted') return total
      if (!shouldIncludeInBudgetExpenseActuals(transaction)) return total
      if (transaction.district_id !== budget.district_id) return total
      if (transaction.fund_id !== line.fund_id) return total
      if (transaction.currency !== line.currency) return total
      if (transaction.transaction_date < budget.start_date || transaction.transaction_date > budget.end_date) {
        return total
      }
      if (!matchesBudgetLineScope(transaction, line)) return total

      return total + Number(transaction.total_amount)
    }, 0)

    const budgetAmount = Number(line.amount)
    const varianceAmount = budgetAmount - actualAmount

    return {
      budget_id: budget.id,
      budget_name: budget.name,
      budget_status: budget.status,
      budget_line_id: line.id,
      start_date: budget.start_date,
      end_date: budget.end_date,
      fund_id: line.fund_id,
      fund_name: line.fund?.name ?? 'Unknown fund',
      line_description: line.line_description,
      currency: line.currency,
      scope_member_id: line.scope_member_id,
      scope_member_name: line.scope_member?.name ?? null,
      scope_member_type: line.scope_member?.type ?? null,
      budget_amount: budgetAmount,
      actual_amount: actualAmount,
      variance_amount: varianceAmount,
    }
  })

  return rows.sort((a, b) =>
    a.currency.localeCompare(b.currency)
    || a.fund_name.localeCompare(b.fund_name)
    || a.line_description.localeCompare(b.line_description)
    || (a.scope_member_name ?? '').localeCompare(b.scope_member_name ?? '')
  )
}

export function buildBudgetComparisonSummaryByCurrency(
  rows: BudgetComparisonLineRow[],
) {
  const summaryMap = new Map<Currency, BudgetComparisonCurrencySummary>()

  for (const row of rows) {
    if (!summaryMap.has(row.currency)) {
      summaryMap.set(row.currency, {
        currency: row.currency,
        budget_total: 0,
        actual_total: 0,
        variance_total: 0,
      })
    }

    const summary = summaryMap.get(row.currency)!
    summary.budget_total += row.budget_amount
    summary.actual_total += row.actual_amount
  }

  return [...summaryMap.values()]
    .map((summary) => ({
      ...summary,
      variance_total: summary.budget_total - summary.actual_total,
    }))
    .sort((a, b) => a.currency.localeCompare(b.currency))
}
