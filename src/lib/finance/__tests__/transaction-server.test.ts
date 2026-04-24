import { describe, expect, it, vi } from 'vitest'
import {
  buildPostedTransactionUpdate,
  buildPostingSnapshots,
  validateDraftTransactionPayload,
} from '@/lib/finance/transaction-server'
import { createMockSupabase } from '@/test/mockSupabase'

function buildFinanceSupabase() {
  return createMockSupabase({
    districts: [
      { id: 'district-1', is_active: true },
      { id: 'district-2', is_active: true },
    ],
    accounts: [
      { id: 'account-1', district_id: 'district-1', currency: 'USD', status: 'active' },
    ],
    funds: [
      {
        id: 'fund-general',
        district_id: 'district-1',
        nature: 'mixed',
        is_active: true,
        requires_individual_member: false,
      },
      {
        id: 'fund-tithes',
        district_id: 'district-1',
        nature: 'income_only',
        is_active: true,
        requires_individual_member: true,
      },
      {
        id: 'fund-building',
        district_id: 'district-1',
        nature: 'mixed',
        is_active: true,
        requires_individual_member: true,
      },
    ],
    members: [
      {
        id: 'region-1',
        district_id: 'district-1',
        type: 'region',
        name: 'North Region',
        is_active: true,
        parent_id: null,
      },
      {
        id: 'assembly-1',
        district_id: 'district-1',
        type: 'assembly',
        name: 'Central Assembly',
        is_active: true,
        parent_id: 'region-1',
      },
      {
        id: 'individual-1',
        district_id: 'district-1',
        type: 'individual',
        name: 'John Example',
        is_active: true,
        parent_id: 'assembly-1',
        title: 'saint',
      },
      {
        id: 'assembly-x',
        district_id: 'district-2',
        type: 'assembly',
        name: 'Other District Assembly',
        is_active: true,
        parent_id: null,
      },
    ],
    counterparties: [
      {
        id: 'supplier-1',
        district_id: 'district-1',
        type: 'supplier',
        name: 'Stationery Shop',
        is_active: true,
      },
    ],
  })
}

describe('validateDraftTransactionPayload', () => {
  it('accepts a tithe receipt with an individual member and derives an incoming effect', async () => {
    const supabase = buildFinanceSupabase()

    const result = await validateDraftTransactionPayload(supabase as never, {
      district_id: 'district-1',
      account_id: 'account-1',
      fund_id: 'fund-tithes',
      member_id: 'individual-1',
      kind: 'receipt',
      transaction_date: '2026-04-21',
      counterparty: '   ',
      narration: ' Sunday tithe ',
      currency: 'USD',
      total_amount: 100,
    })

    expect(result.values).toMatchObject({
      district_id: 'district-1',
      account_id: 'account-1',
      fund_id: 'fund-tithes',
      member_id: 'individual-1',
      kind: 'receipt',
      effect_direction: 'in',
      transaction_date: '2026-04-21',
      counterparty: null,
      narration: 'Sunday tithe',
      currency: 'USD',
      total_amount: 100,
    })
  })

  it('allows a payment with a fallback counterparty name and marks it as outgoing', async () => {
    const supabase = buildFinanceSupabase()

    const result = await validateDraftTransactionPayload(supabase as never, {
      district_id: 'district-1',
      account_id: 'account-1',
      fund_id: 'fund-general',
      kind: 'payment',
      transaction_date: '2026-04-21',
      counterparty: ' Stationery Shop ',
      currency: 'USD',
      total_amount: 25,
    })

    expect(result.values.counterparty).toBe('Stationery Shop')
    expect(result.values.effect_direction).toBe('out')
  })

  it('requires either a payee member, registered counterparty, or fallback counterparty for payments', async () => {
    const supabase = buildFinanceSupabase()

    await expect(
      validateDraftTransactionPayload(supabase as never, {
        district_id: 'district-1',
        account_id: 'account-1',
      fund_id: 'fund-general',
      kind: 'payment',
      transaction_date: '2026-04-21',
      currency: 'USD',
      total_amount: 25,
      }),
    ).rejects.toMatchObject({
      code: 'PARTY_REQUIRED',
    })
  })

  it('requires an individual member on receipts for funds that enforce it', async () => {
    const supabase = buildFinanceSupabase()

    await expect(
      validateDraftTransactionPayload(supabase as never, {
        district_id: 'district-1',
        account_id: 'account-1',
        fund_id: 'fund-tithes',
        member_id: 'assembly-1',
        kind: 'receipt',
        transaction_date: '2026-04-21',
        currency: 'USD',
        total_amount: 100,
      }),
    ).rejects.toMatchObject({
      code: 'INDIVIDUAL_MEMBER_REQUIRED',
    })
  })

  it('allows payments from funds that require individual members on receipts', async () => {
    const supabase = buildFinanceSupabase()

    const result = await validateDraftTransactionPayload(supabase as never, {
      district_id: 'district-1',
      account_id: 'account-1',
      fund_id: 'fund-building',
      kind: 'payment',
      counterparty: ' Vehicle Supplier ',
      transaction_date: '2026-04-21',
      currency: 'USD',
      total_amount: 250,
    })

    expect(result.values.counterparty).toBe('Vehicle Supplier')
    expect(result.values.effect_direction).toBe('out')
    expect(result.values.member_id).toBeNull()
  })

  it('rejects standalone transfer drafts in the generic cashbook workflow', async () => {
    const supabase = buildFinanceSupabase()

    await expect(
      validateDraftTransactionPayload(supabase as never, {
        district_id: 'district-1',
        account_id: 'account-1',
        kind: 'transfer',
        transaction_date: '2026-04-21',
        currency: 'USD',
        total_amount: 40,
      }),
    ).rejects.toMatchObject({
      code: 'TRANSFER_WORKFLOW_REQUIRED',
    })
  })

  it('supports signed adjustment drafts', async () => {
    const supabase = buildFinanceSupabase()

    const result = await validateDraftTransactionPayload(supabase as never, {
      district_id: 'district-1',
      account_id: 'account-1',
      kind: 'adjustment',
      effect_direction: 'out',
      transaction_date: '2026-04-21',
      narration: 'Cash correction',
      currency: 'USD',
      total_amount: 5,
    })

    expect(result.values.effect_direction).toBe('out')
  })
})

describe('buildPostingSnapshots', () => {
  it('derives assembly and region snapshots for an individual member', async () => {
    const supabase = buildFinanceSupabase()

    const snapshots = await buildPostingSnapshots(
      supabase as never,
      'district-1',
      'individual-1',
    )

    expect(snapshots).toMatchObject({
      memberNameSnapshot: 'John Example',
      memberTypeSnapshot: 'individual',
      memberParentNameSnapshot: 'Central Assembly',
      assemblyMemberSnapshotId: 'assembly-1',
      regionMemberSnapshotId: 'region-1',
    })
  })

  it('rejects cross-district hierarchy links during posting snapshot derivation', async () => {
    const supabase = createMockSupabase({
      districts: [{ id: 'district-1', is_active: true }],
      members: [
        {
          id: 'individual-1',
          district_id: 'district-1',
          type: 'individual',
          name: 'John Example',
          is_active: true,
          parent_id: 'assembly-x',
        },
        {
          id: 'assembly-x',
          district_id: 'district-2',
          type: 'assembly',
          name: 'Other District Assembly',
          is_active: true,
          parent_id: null,
        },
      ],
    })

    await expect(
      buildPostingSnapshots(supabase as never, 'district-1', 'individual-1'),
    ).rejects.toMatchObject({
      code: 'MEMBER_HIERARCHY_INVALID',
    })
  })
})

describe('buildPostedTransactionUpdate', () => {
  it('builds posting metadata and can backfill the skipped workflow actors', async () => {
    const supabase = Object.assign(buildFinanceSupabase(), {
      rpc: vi.fn().mockResolvedValue({
        data: 'TXN-2026-0001',
        error: null,
      }),
    })

    const result = await buildPostedTransactionUpdate(
      supabase as never,
      {
        district_id: 'district-1',
        account_id: 'account-1',
        fund_id: 'fund-tithes',
        member_id: 'individual-1',
        counterparty_id: null,
        kind: 'receipt',
        effect_direction: 'in',
        transaction_date: '2026-04-21',
        counterparty: null,
        narration: 'Sunday tithe',
        currency: 'USD',
        total_amount: 100,
      },
      'user-1',
      {
        includeWorkflowActors: true,
        now: '2026-04-23T10:00:00.000Z',
      },
    )

    expect(result).toMatchObject({
      status: 'posted',
      reference_number: 'TXN-2026-0001',
      submitted_by: 'user-1',
      approved_by: 'user-1',
      posted_by: 'user-1',
      member_name_snapshot: 'John Example',
      member_type_snapshot: 'individual',
      member_parent_name_snapshot: 'Central Assembly',
      assembly_member_snapshot_id: 'assembly-1',
      region_member_snapshot_id: 'region-1',
    })
    expect(supabase.rpc).toHaveBeenCalledWith('next_transaction_number', {
      p_district_id: 'district-1',
    })
  })
})
