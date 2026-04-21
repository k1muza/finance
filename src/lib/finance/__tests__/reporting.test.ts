import { describe, expect, it } from 'vitest'
import type { CashbookTransaction } from '@/types'
import {
  buildCashbookFundBalances,
  buildCashbookTotalsByCurrency,
} from '@/lib/finance/reporting'

function makeTransaction(
  overrides: Partial<CashbookTransaction>,
): CashbookTransaction {
  return {
    id: overrides.id ?? 'txn-1',
    district_id: overrides.district_id ?? 'district-1',
    account_id: overrides.account_id ?? 'account-1',
    fund_id: overrides.fund_id ?? 'fund-1',
    member_id: overrides.member_id ?? null,
    counterparty_id: overrides.counterparty_id ?? null,
    transfer_id: overrides.transfer_id ?? null,
    assembly_member_snapshot_id: overrides.assembly_member_snapshot_id ?? null,
    region_member_snapshot_id: overrides.region_member_snapshot_id ?? null,
    kind: overrides.kind ?? 'receipt',
    effect_direction: overrides.effect_direction ?? 'in',
    status: overrides.status ?? 'posted',
    transaction_date: overrides.transaction_date ?? '2026-04-21',
    reference_number: overrides.reference_number ?? null,
    counterparty: overrides.counterparty ?? null,
    narration: overrides.narration ?? null,
    currency: overrides.currency ?? 'USD',
    total_amount: overrides.total_amount ?? 0,
    source_transaction_id: overrides.source_transaction_id ?? null,
    member_name_snapshot: overrides.member_name_snapshot ?? null,
    member_type_snapshot: overrides.member_type_snapshot ?? null,
    member_parent_name_snapshot: overrides.member_parent_name_snapshot ?? null,
    client_generated_id: overrides.client_generated_id ?? null,
    device_id: overrides.device_id ?? null,
    created_by: overrides.created_by ?? 'user-1',
    submitted_by: overrides.submitted_by ?? null,
    approved_by: overrides.approved_by ?? null,
    posted_by: overrides.posted_by ?? 'user-1',
    reversed_by: overrides.reversed_by ?? null,
    submitted_at: overrides.submitted_at ?? null,
    approved_at: overrides.approved_at ?? null,
    posted_at: overrides.posted_at ?? '2026-04-21T10:00:00Z',
    reversed_at: overrides.reversed_at ?? null,
    created_at: overrides.created_at ?? '2026-04-21T09:00:00Z',
    updated_at: overrides.updated_at ?? '2026-04-21T10:00:00Z',
    account: overrides.account ?? null,
    fund: overrides.fund ?? {
      id: 'fund-1',
      district_id: 'district-1',
      name: 'General Fund',
      code: null,
      description: null,
      is_restricted: false,
      nature: 'mixed',
      is_active: true,
      requires_individual_member: false,
      created_at: '2026-04-21T09:00:00Z',
      updated_at: '2026-04-21T10:00:00Z',
    },
    member: overrides.member ?? null,
    counterparty_record: overrides.counterparty_record ?? null,
    assembly_member_snapshot: overrides.assembly_member_snapshot ?? null,
    region_member_snapshot: overrides.region_member_snapshot ?? null,
    lines: overrides.lines ?? [],
  }
}

describe('cashbook reporting helpers', () => {
  it('builds fund balances from posted operational activity and excludes transfers', () => {
    const transactions = [
      makeTransaction({
        id: 'receipt-1',
        kind: 'receipt',
        effect_direction: 'in',
        total_amount: 100,
      }),
      makeTransaction({
        id: 'payment-1',
        kind: 'payment',
        effect_direction: 'out',
        total_amount: 25,
      }),
      makeTransaction({
        id: 'adjustment-1',
        kind: 'adjustment',
        effect_direction: 'out',
        total_amount: 10,
      }),
      makeTransaction({
        id: 'transfer-1',
        kind: 'transfer',
        effect_direction: 'out',
        total_amount: 999,
        fund_id: null,
        fund: null,
      }),
    ]

    const rows = buildCashbookFundBalances(transactions)

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      district_id: 'district-1',
      fund_id: 'fund-1',
      fund_name: 'General Fund',
      income_total: 100,
      expense_total: 35,
      net_balance: 65,
    })
  })

  it('groups totals by currency and respects signed reversal effects', () => {
    const transactions = [
      makeTransaction({
        id: 'receipt-usd',
        currency: 'USD',
        kind: 'receipt',
        effect_direction: 'in',
        total_amount: 100,
      }),
      makeTransaction({
        id: 'payment-usd',
        currency: 'USD',
        kind: 'payment',
        effect_direction: 'out',
        total_amount: 30,
      }),
      makeTransaction({
        id: 'reversal-usd',
        currency: 'USD',
        kind: 'reversal',
        effect_direction: 'in',
        total_amount: 30,
      }),
      makeTransaction({
        id: 'receipt-zar',
        currency: 'ZAR',
        kind: 'receipt',
        effect_direction: 'in',
        total_amount: 50,
      }),
      makeTransaction({
        id: 'transfer-zar',
        currency: 'ZAR',
        kind: 'transfer',
        effect_direction: 'out',
        total_amount: 20,
        fund_id: null,
        fund: null,
      }),
    ]

    const totals = buildCashbookTotalsByCurrency(transactions)

    expect(totals.inByCurrency).toEqual({
      USD: 130,
      ZAR: 50,
    })
    expect(totals.outByCurrency).toEqual({
      USD: 30,
    })
  })
})
