import { createServerClient } from '@/lib/supabase/server'
import { ApiRouteError } from '@/lib/server/errors'
import type {
  Account,
  Currency,
  Transfer,
} from '@/types'

type ServerSupabase = ReturnType<typeof createServerClient>

type AccountRecord = Pick<Account, 'id' | 'district_id' | 'currency' | 'status' | 'name'>

export interface TransferDraftPayload {
  district_id: string
  transfer_date: string
  from_account_id: string
  to_account_id: string
  amount: number
  description?: string | null
  client_generated_id?: string | null
  device_id?: string | null
}

export interface ValidatedTransferDraft {
  fromAccount: AccountRecord
  toAccount: AccountRecord
  values: {
    district_id: string
    transfer_date: string
    from_account_id: string
    to_account_id: string
    amount: number
    description: string | null
    client_generated_id: string | null
    device_id: string | null
  }
}

function normalizeNullableText(value: string | null | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
}

async function requireActiveDistrict(
  supabase: ServerSupabase,
  districtId: string,
) {
  const { data: district, error } = await supabase
    .from('districts')
    .select('id, is_active')
    .eq('id', districtId)
    .maybeSingle()

  if (error || !district) {
    throw new ApiRouteError('DISTRICT_NOT_FOUND', 'District not found.', 404)
  }

  if (!district.is_active) {
    throw new ApiRouteError(
      'DISTRICT_INACTIVE',
      'Inactive districts cannot be used for new transfers.',
      422,
    )
  }
}

async function loadAccount(
  supabase: ServerSupabase,
  accountId: string,
) {
  const { data: account, error } = await supabase
    .from('accounts')
    .select('id, district_id, currency, status, name')
    .eq('id', accountId)
    .maybeSingle()

  if (error || !account) {
    throw new ApiRouteError('ACCOUNT_NOT_FOUND', 'Account not found.', 404)
  }

  return account as AccountRecord
}

export async function validateDraftTransferPayload(
  supabase: ServerSupabase,
  payload: TransferDraftPayload,
): Promise<ValidatedTransferDraft> {
  if (!payload.district_id) {
    throw new ApiRouteError('DISTRICT_ID_REQUIRED', 'district_id is required.', 400)
  }
  if (!payload.transfer_date || !isIsoDate(payload.transfer_date)) {
    throw new ApiRouteError(
      'TRANSFER_DATE_INVALID',
      'transfer_date must be a valid ISO date (YYYY-MM-DD).',
      400,
    )
  }
  if (!payload.from_account_id) {
    throw new ApiRouteError('FROM_ACCOUNT_REQUIRED', 'from_account_id is required.', 400)
  }
  if (!payload.to_account_id) {
    throw new ApiRouteError('TO_ACCOUNT_REQUIRED', 'to_account_id is required.', 400)
  }
  if (!Number.isFinite(payload.amount) || payload.amount <= 0) {
    throw new ApiRouteError('TRANSFER_AMOUNT_INVALID', 'amount must be greater than 0.', 400)
  }

  await requireActiveDistrict(supabase, payload.district_id)

  const [fromAccount, toAccount] = await Promise.all([
    loadAccount(supabase, payload.from_account_id),
    loadAccount(supabase, payload.to_account_id),
  ])

  if (fromAccount.id === toAccount.id) {
    throw new ApiRouteError(
      'TRANSFER_ACCOUNT_MATCH',
      'Source and destination accounts must be different.',
      422,
    )
  }
  if (fromAccount.district_id !== payload.district_id || toAccount.district_id !== payload.district_id) {
    throw new ApiRouteError(
      'TRANSFER_ACCOUNT_DISTRICT_MISMATCH',
      'Transfer accounts must belong to the selected district.',
      422,
    )
  }
  if (fromAccount.status !== 'active' || toAccount.status !== 'active') {
    throw new ApiRouteError(
      'TRANSFER_ACCOUNT_INACTIVE',
      'Both transfer accounts must be active.',
      422,
    )
  }
  if (fromAccount.currency !== toAccount.currency) {
    throw new ApiRouteError(
      'TRANSFER_CURRENCY_MISMATCH',
      `Accounts must share the same currency. ${fromAccount.name} is ${fromAccount.currency} while ${toAccount.name} is ${toAccount.currency}.`,
      422,
    )
  }

  return {
    fromAccount,
    toAccount,
    values: {
      district_id: payload.district_id,
      transfer_date: payload.transfer_date,
      from_account_id: fromAccount.id,
      to_account_id: toAccount.id,
      amount: payload.amount,
      description: normalizeNullableText(payload.description),
      client_generated_id: payload.client_generated_id ?? null,
      device_id: payload.device_id ?? null,
    },
  }
}

export async function hydrateTransfers<T extends Pick<Transfer, 'from_account_id' | 'to_account_id'>>(
  supabase: ServerSupabase,
  rows: T[],
): Promise<Array<T & { from_account: AccountRecord | null; to_account: AccountRecord | null }>> {
  if (rows.length === 0) return []

  const accountIds = Array.from(new Set(
    rows.flatMap((row) => [row.from_account_id, row.to_account_id]),
  ))

  const { data: accounts, error } = await supabase
    .from('accounts')
    .select('id, district_id, currency, status, name')
    .in('id', accountIds)

  if (error) {
    throw new ApiRouteError('TRANSFER_ACCOUNT_HYDRATION_FAILED', error.message, 500)
  }

  const accountMap = new Map<string, AccountRecord>()
  for (const account of accounts ?? []) {
    accountMap.set(account.id, account as AccountRecord)
  }

  return rows.map((row) => ({
    ...row,
    from_account: accountMap.get(row.from_account_id) ?? null,
    to_account: accountMap.get(row.to_account_id) ?? null,
  }))
}

export function resolveTransferCurrency(
  transfer: Pick<Transfer, 'from_account' | 'to_account'>,
): Currency {
  return (transfer.from_account?.currency
    ?? transfer.to_account?.currency
    ?? 'USD') as Currency
}
