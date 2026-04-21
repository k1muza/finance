import { describe, expect, it } from 'vitest'
import { ApiRouteError } from '@/lib/server/errors'
import {
  hydrateTransfers,
  resolveTransferCurrency,
  validateDraftTransferPayload,
} from '@/lib/finance/transfer-server'
import { createMockSupabase } from '@/test/mockSupabase'

function buildTransferSupabase() {
  return createMockSupabase({
    districts: [
      { id: 'district-1', is_active: true },
    ],
    accounts: [
      {
        id: 'cash-1',
        district_id: 'district-1',
        currency: 'USD',
        status: 'active',
        name: 'Main Cash',
      },
      {
        id: 'bank-1',
        district_id: 'district-1',
        currency: 'USD',
        status: 'active',
        name: 'Main Bank',
      },
      {
        id: 'zar-1',
        district_id: 'district-1',
        currency: 'ZAR',
        status: 'active',
        name: 'ZAR Account',
      },
    ],
  })
}

describe('validateDraftTransferPayload', () => {
  it('accepts a valid same-currency district transfer draft', async () => {
    const supabase = buildTransferSupabase()

    const result = await validateDraftTransferPayload(supabase as never, {
      district_id: 'district-1',
      transfer_date: '2026-04-21',
      from_account_id: 'cash-1',
      to_account_id: 'bank-1',
      amount: 40,
      description: ' Move working cash to bank ',
    })

    expect(result.values).toMatchObject({
      district_id: 'district-1',
      transfer_date: '2026-04-21',
      from_account_id: 'cash-1',
      to_account_id: 'bank-1',
      amount: 40,
      description: 'Move working cash to bank',
    })
  })

  it('rejects transfers that use the same account twice', async () => {
    const supabase = buildTransferSupabase()

    await expect(
      validateDraftTransferPayload(supabase as never, {
        district_id: 'district-1',
        transfer_date: '2026-04-21',
        from_account_id: 'cash-1',
        to_account_id: 'cash-1',
        amount: 40,
      }),
    ).rejects.toMatchObject({
      code: 'TRANSFER_ACCOUNT_MATCH',
    } satisfies Partial<ApiRouteError>)
  })

  it('rejects transfers between accounts with different currencies', async () => {
    const supabase = buildTransferSupabase()

    await expect(
      validateDraftTransferPayload(supabase as never, {
        district_id: 'district-1',
        transfer_date: '2026-04-21',
        from_account_id: 'cash-1',
        to_account_id: 'zar-1',
        amount: 40,
      }),
    ).rejects.toMatchObject({
      code: 'TRANSFER_CURRENCY_MISMATCH',
    } satisfies Partial<ApiRouteError>)
  })
})

describe('transfer helpers', () => {
  it('hydrates transfer account details for the transfer workspace', async () => {
    const supabase = buildTransferSupabase()

    const [hydrated] = await hydrateTransfers(supabase as never, [
      {
        id: 'transfer-1',
        from_account_id: 'cash-1',
        to_account_id: 'bank-1',
      },
    ])

    expect(hydrated.from_account?.name).toBe('Main Cash')
    expect(hydrated.to_account?.name).toBe('Main Bank')
  })

  it('resolves transfer currency from the hydrated accounts', () => {
    expect(resolveTransferCurrency({
      from_account: { currency: 'USD' } as never,
      to_account: { currency: 'ZAR' } as never,
    })).toBe('USD')

    expect(resolveTransferCurrency({
      from_account: null,
      to_account: { currency: 'ZAR' } as never,
    })).toBe('ZAR')
  })
})
