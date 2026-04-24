import { describe, expect, it } from 'vitest'
import type { Budget, CashbookTransaction, Member } from '@/types'
import {
  buildBudgetComparisonRows,
  buildBudgetComparisonSummaryByCurrency,
  buildCashbookFundBalances,
  buildCashbookTotalsByCurrency,
  buildFundLeaderboard,
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

function makeMember(overrides: Partial<Member>): Member {
  return {
    id: overrides.id ?? 'member-1',
    district_id: overrides.district_id ?? 'district-1',
    parent_id: overrides.parent_id ?? null,
    type: overrides.type ?? 'individual',
    name: overrides.name ?? 'Member One',
    code: overrides.code ?? null,
    title: overrides.title ?? 'saint',
    phone: overrides.phone ?? null,
    email: overrides.email ?? null,
    address: overrides.address ?? null,
    notes: overrides.notes ?? null,
    is_active: overrides.is_active ?? true,
    created_at: overrides.created_at ?? '2026-04-21T09:00:00Z',
    updated_at: overrides.updated_at ?? '2026-04-21T10:00:00Z',
    parent: overrides.parent ?? null,
    children: overrides.children ?? [],
  }
}

function makeBudget(overrides: Partial<Budget>): Budget {
  return {
    id: overrides.id ?? 'budget-1',
    district_id: overrides.district_id ?? 'district-1',
    client_generated_id: overrides.client_generated_id ?? null,
    device_id: overrides.device_id ?? null,
    name: overrides.name ?? 'Annual Budget',
    start_date: overrides.start_date ?? '2026-04-01',
    end_date: overrides.end_date ?? '2026-04-30',
    status: overrides.status ?? 'active',
    description: overrides.description ?? null,
    created_by_user_id: overrides.created_by_user_id ?? null,
    created_at: overrides.created_at ?? '2026-04-01T09:00:00Z',
    updated_at: overrides.updated_at ?? '2026-04-01T10:00:00Z',
    district: overrides.district ?? null,
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

  it('builds per-currency fund leaderboard rankings for members, counterparties, and fallback names', () => {
    const rows = buildFundLeaderboard([
      makeTransaction({
        id: 'member-receipt-1',
        currency: 'USD',
        kind: 'receipt',
        effect_direction: 'in',
        total_amount: 125,
        member_id: 'individual-1',
        member_name_snapshot: 'John Example',
        member_type_snapshot: 'individual',
        member_parent_name_snapshot: 'Central Assembly',
      }),
      makeTransaction({
        id: 'member-receipt-2',
        currency: 'USD',
        kind: 'receipt',
        effect_direction: 'in',
        total_amount: 75,
        member_id: 'individual-1',
        member_name_snapshot: 'John Example',
        member_type_snapshot: 'individual',
        member_parent_name_snapshot: 'Central Assembly',
      }),
      makeTransaction({
        id: 'supplier-payment',
        currency: 'USD',
        kind: 'payment',
        effect_direction: 'out',
        total_amount: 90,
        counterparty_id: 'supplier-1',
        counterparty_record: {
          id: 'supplier-1',
          district_id: 'district-1',
          type: 'supplier',
          name: 'Stationery Shop',
          code: null,
          phone: null,
          email: null,
          address: null,
          notes: null,
          is_active: true,
          created_at: '2026-04-21T09:00:00Z',
        },
      }),
      makeTransaction({
        id: 'fallback-payment',
        currency: 'USD',
        kind: 'payment',
        effect_direction: 'out',
        total_amount: 35,
        counterparty: ' Community Choir ',
      }),
      makeTransaction({
        id: 'draft-ignore',
        currency: 'USD',
        kind: 'receipt',
        effect_direction: 'in',
        total_amount: 999,
        status: 'draft',
        member_id: 'individual-2',
        member_name_snapshot: 'Ignored Draft',
      }),
      makeTransaction({
        id: 'transfer-ignore',
        currency: 'USD',
        kind: 'transfer',
        effect_direction: 'out',
        total_amount: 999,
        fund_id: null,
        fund: null,
      }),
      makeTransaction({
        id: 'zar-receipt',
        currency: 'ZAR',
        kind: 'receipt',
        effect_direction: 'in',
        total_amount: 600,
        member_id: 'region-1',
        member_name_snapshot: 'Northern Region',
        member_type_snapshot: 'region',
      }),
    ])

    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({
      currency: 'USD',
      transaction_count: 4,
      participant_count: 3,
      total_incoming: 200,
      total_outgoing: 125,
      net_total: 75,
    })

    expect(rows[0].incoming_leaders[0]).toMatchObject({
      participant_key: 'member:individual-1',
      participant_name: 'John Example',
      participant_kind: 'member',
      participant_type_label: 'Individual',
      participant_context: 'Central Assembly',
      incoming_total: 200,
      outgoing_total: 0,
      total_volume: 200,
      transaction_count: 2,
    })

    expect(rows[0].outgoing_leaders[0]).toMatchObject({
      participant_key: 'counterparty:supplier-1',
      participant_name: 'Stationery Shop',
      participant_kind: 'counterparty',
      participant_type_label: 'Supplier',
      participant_context: 'Registered',
      outgoing_total: 90,
    })

    expect(rows[0].entries[2]).toMatchObject({
      participant_key: 'freeform:community choir',
      participant_name: 'Community Choir',
      participant_kind: 'freeform',
      outgoing_total: 35,
    })

    expect(rows[1]).toMatchObject({
      currency: 'ZAR',
      transaction_count: 1,
      participant_count: 1,
      total_incoming: 600,
      total_outgoing: 0,
      net_total: 600,
    })
  })

  it('builds expense budget comparison rows using fund, period, currency, and member scope', () => {
    const assembly = makeMember({
      id: 'assembly-1',
      type: 'assembly',
      name: 'Central Assembly',
    })
    const individual = makeMember({
      id: 'individual-1',
      type: 'individual',
      name: 'John Example',
    })

    const budget = makeBudget({
      lines: [
        {
          id: 'line-general',
          district_id: 'district-1',
          budget_id: 'budget-1',
          fund_id: 'fund-1',
          line_description: 'General spending',
          currency: 'USD',
          amount: 100,
          scope_member_id: null,
          notes: null,
          created_at: '2026-04-01T09:00:00Z',
          updated_at: '2026-04-01T10:00:00Z',
          fund: {
            id: 'fund-1',
            district_id: 'district-1',
            name: 'General Fund',
            code: null,
            description: null,
            is_restricted: false,
            nature: 'mixed',
            is_active: true,
            requires_individual_member: false,
            created_at: '2026-04-01T09:00:00Z',
            updated_at: '2026-04-01T10:00:00Z',
          },
          scope_member: null,
          budget: null,
        },
        {
          id: 'line-expense-scope',
          district_id: 'district-1',
          budget_id: 'budget-1',
          fund_id: 'fund-3',
          line_description: 'Assembly welfare',
          currency: 'USD',
          amount: 40,
          scope_member_id: 'assembly-1',
          notes: null,
          created_at: '2026-04-01T09:00:00Z',
          updated_at: '2026-04-01T10:00:00Z',
          fund: {
            id: 'fund-3',
            district_id: 'district-1',
            name: 'Welfare Fund',
            code: null,
            description: null,
            is_restricted: false,
            nature: 'expense_only',
            is_active: true,
            requires_individual_member: false,
            created_at: '2026-04-01T09:00:00Z',
            updated_at: '2026-04-01T10:00:00Z',
          },
          scope_member: assembly,
          budget: null,
        },
        {
          id: 'line-member-expense',
          district_id: 'district-1',
          budget_id: 'budget-1',
          fund_id: 'fund-2',
          line_description: 'Pastoral support',
          currency: 'USD',
          amount: 50,
          scope_member_id: 'individual-1',
          notes: null,
          created_at: '2026-04-01T09:00:00Z',
          updated_at: '2026-04-01T10:00:00Z',
          fund: {
            id: 'fund-2',
            district_id: 'district-1',
            name: 'Tithes Fund',
            code: null,
            description: null,
            is_restricted: true,
            nature: 'expense_only',
            is_active: true,
            requires_individual_member: true,
            created_at: '2026-04-01T09:00:00Z',
            updated_at: '2026-04-01T10:00:00Z',
          },
          scope_member: individual,
          budget: null,
        },
      ],
    })

    const rows = buildBudgetComparisonRows(budget, [
      makeTransaction({
        id: 'expense-budget-hit',
        fund_id: 'fund-1',
        currency: 'USD',
        kind: 'payment',
        effect_direction: 'out',
        total_amount: 90,
        transaction_date: '2026-04-10',
      }),
      makeTransaction({
        id: 'expense-budget-scope-hit',
        fund_id: 'fund-3',
        currency: 'USD',
        kind: 'payment',
        effect_direction: 'out',
        total_amount: 30,
        transaction_date: '2026-04-12',
        assembly_member_snapshot_id: 'assembly-1',
      }),
      makeTransaction({
        id: 'expense-budget-miss',
        fund_id: 'fund-3',
        currency: 'USD',
        kind: 'payment',
        effect_direction: 'out',
        total_amount: 12,
        transaction_date: '2026-04-12',
        assembly_member_snapshot_id: 'assembly-2',
      }),
      makeTransaction({
        id: 'member-expense-hit',
        fund_id: 'fund-2',
        currency: 'USD',
        kind: 'adjustment',
        effect_direction: 'out',
        total_amount: 60,
        transaction_date: '2026-04-15',
        member_id: 'individual-1',
      }),
      makeTransaction({
        id: 'member-expense-miss',
        fund_id: 'fund-2',
        currency: 'USD',
        kind: 'adjustment',
        effect_direction: 'in',
        total_amount: 70,
        transaction_date: '2026-04-16',
        member_id: 'individual-2',
      }),
      makeTransaction({
        id: 'transfer-ignore',
        fund_id: 'fund-1',
        currency: 'USD',
        kind: 'transfer',
        effect_direction: 'out',
        total_amount: 500,
        transaction_date: '2026-04-18',
        fund: null,
      }),
      makeTransaction({
        id: 'outside-period',
        fund_id: 'fund-1',
        currency: 'USD',
        kind: 'payment',
        effect_direction: 'out',
        total_amount: 999,
        transaction_date: '2026-05-01',
      }),
    ])

    expect(rows).toHaveLength(3)
    expect(rows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        budget_line_id: 'line-general',
        actual_amount: 90,
        variance_amount: 10,
      }),
      expect.objectContaining({
        budget_line_id: 'line-expense-scope',
        actual_amount: 30,
        variance_amount: 10,
      }),
      expect.objectContaining({
        budget_line_id: 'line-member-expense',
        actual_amount: 60,
        variance_amount: -10,
      }),
    ]))

    expect(buildBudgetComparisonSummaryByCurrency(rows)).toEqual([
      expect.objectContaining({
        currency: 'USD',
        budget_total: 190,
        actual_total: 180,
        variance_total: 10,
      }),
    ])
  })
})
