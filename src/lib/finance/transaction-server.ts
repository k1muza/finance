import type {
  Currency,
  SourceType,
  TransactionKind,
} from '@/types'
import { createServerClient } from '@/lib/supabase/server'
import { ApiRouteError } from '@/lib/server/errors'
import {
  deriveSourceSnapshotsFromChain,
  fundNatureAllowsTransactionKind,
  transactionKindNeedsCounterpartyOrSource,
  transactionKindRequiresFund,
} from '@/lib/finance/transactions'

type ServerSupabase = ReturnType<typeof createServerClient>

type AccountRecord = {
  id: string
  district_id: string
  currency: Currency
  status: 'active' | 'archived'
}

type FundRecord = {
  id: string
  district_id: string
  nature: 'income_only' | 'expense_only' | 'mixed'
  is_active: boolean
  requires_individual_source: boolean
}

type SourceRecord = {
  id: string
  district_id: string
  type: SourceType
  name: string
  is_active: boolean
  parent_id: string | null
}

export interface TransactionDraftPayload {
  district_id: string
  account_id: string
  fund_id?: string | null
  source_id?: string | null
  kind: TransactionKind
  transaction_date: string
  counterparty?: string | null
  narration?: string | null
  currency: Currency
  total_amount: number
  client_generated_id?: string | null
  device_id?: string | null
}

export interface ValidatedTransactionDraft {
  account: AccountRecord
  fund: FundRecord | null
  source: SourceRecord | null
  values: {
    district_id: string
    account_id: string
    fund_id: string | null
    source_id: string | null
    kind: TransactionKind
    transaction_date: string
    counterparty: string | null
    narration: string | null
    currency: Currency
    total_amount: number
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
      'Inactive districts cannot be used for new transactions.',
      422,
    )
  }

  return district
}

async function loadAccount(
  supabase: ServerSupabase,
  accountId: string,
) {
  const { data: account, error } = await supabase
    .from('accounts')
    .select('id, district_id, currency, status')
    .eq('id', accountId)
    .maybeSingle()

  if (error || !account) {
    throw new ApiRouteError('ACCOUNT_NOT_FOUND', 'Account not found.', 404)
  }

  return account as AccountRecord
}

async function loadFund(
  supabase: ServerSupabase,
  fundId: string,
) {
  const { data: fund, error } = await supabase
    .from('funds')
    .select('id, district_id, nature, is_active, requires_individual_source')
    .eq('id', fundId)
    .maybeSingle()

  if (error || !fund) {
    throw new ApiRouteError('FUND_NOT_FOUND', 'Fund not found.', 404)
  }

  return fund as FundRecord
}

async function loadSource(
  supabase: ServerSupabase,
  sourceId: string,
) {
  const { data: source, error } = await supabase
    .from('sources')
    .select('id, district_id, type, name, is_active, parent_id')
    .eq('id', sourceId)
    .maybeSingle()

  if (error || !source) {
    throw new ApiRouteError('SOURCE_NOT_FOUND', 'Source not found.', 404)
  }

  return source as SourceRecord
}

export async function validateDraftTransactionPayload(
  supabase: ServerSupabase,
  payload: TransactionDraftPayload,
): Promise<ValidatedTransactionDraft> {
  if (!payload.district_id) {
    throw new ApiRouteError('DISTRICT_ID_REQUIRED', 'district_id is required.', 400)
  }
  if (!payload.account_id) {
    throw new ApiRouteError('ACCOUNT_ID_REQUIRED', 'account_id is required.', 400)
  }
  if (!payload.kind) {
    throw new ApiRouteError('KIND_REQUIRED', 'kind is required.', 400)
  }
  if (!payload.transaction_date || !isIsoDate(payload.transaction_date)) {
    throw new ApiRouteError(
      'TRANSACTION_DATE_INVALID',
      'transaction_date must be a valid ISO date (YYYY-MM-DD).',
      400,
    )
  }
  if (!payload.currency) {
    throw new ApiRouteError('CURRENCY_REQUIRED', 'currency is required.', 400)
  }
  if (!Number.isFinite(payload.total_amount) || payload.total_amount <= 0) {
    throw new ApiRouteError(
      'TOTAL_AMOUNT_INVALID',
      'total_amount must be greater than 0.',
      400,
    )
  }

  await requireActiveDistrict(supabase, payload.district_id)

  const account = await loadAccount(supabase, payload.account_id)

  if (account.district_id !== payload.district_id) {
    throw new ApiRouteError(
      'ACCOUNT_DISTRICT_MISMATCH',
      'Account does not belong to the selected district.',
      422,
    )
  }
  if (account.status !== 'active') {
    throw new ApiRouteError(
      'ACCOUNT_INACTIVE',
      'Inactive accounts cannot be used for new transactions.',
      422,
    )
  }
  if (account.currency !== payload.currency) {
    throw new ApiRouteError(
      'ACCOUNT_CURRENCY_MISMATCH',
      `Account currency is ${account.currency}, not ${payload.currency}.`,
      422,
    )
  }

  let fund: FundRecord | null = null
  if (payload.fund_id) {
    fund = await loadFund(supabase, payload.fund_id)

    if (fund.district_id !== payload.district_id) {
      throw new ApiRouteError(
        'FUND_DISTRICT_MISMATCH',
        'Fund does not belong to the selected district.',
        422,
      )
    }
    if (!fund.is_active) {
      throw new ApiRouteError(
        'FUND_INACTIVE',
        'Inactive funds cannot be used for new transactions.',
        422,
      )
    }
    if (!fundNatureAllowsTransactionKind(fund.nature, payload.kind)) {
      throw new ApiRouteError(
        'FUND_KIND_MISMATCH',
        'The selected fund does not support this transaction kind.',
        422,
      )
    }
  }

  if (transactionKindRequiresFund(payload.kind) && !fund) {
    throw new ApiRouteError(
      'FUND_REQUIRED',
      'Receipts and payments must be assigned to a fund.',
      422,
    )
  }

  let source: SourceRecord | null = null
  if (payload.source_id) {
    source = await loadSource(supabase, payload.source_id)

    if (source.district_id !== payload.district_id) {
      throw new ApiRouteError(
        'SOURCE_DISTRICT_MISMATCH',
        'Source does not belong to the selected district.',
        422,
      )
    }
    if (!source.is_active) {
      throw new ApiRouteError(
        'SOURCE_INACTIVE',
        'Inactive sources cannot be used for new transactions.',
        422,
      )
    }
  }

  if (fund?.requires_individual_source && source?.type !== 'individual') {
    throw new ApiRouteError(
      'INDIVIDUAL_SOURCE_REQUIRED',
      'This fund requires an individual source.',
      422,
    )
  }

  const counterparty = normalizeNullableText(payload.counterparty)
  if (transactionKindNeedsCounterpartyOrSource(payload.kind) && !source && !counterparty) {
    throw new ApiRouteError(
      'SOURCE_OR_COUNTERPARTY_REQUIRED',
      'Provide either a district source or a fallback counterparty name.',
      422,
    )
  }

  return {
    account,
    fund,
    source,
    values: {
      district_id: payload.district_id,
      account_id: account.id,
      fund_id: fund?.id ?? null,
      source_id: source?.id ?? null,
      kind: payload.kind,
      transaction_date: payload.transaction_date,
      counterparty,
      narration: normalizeNullableText(payload.narration),
      currency: payload.currency,
      total_amount: payload.total_amount,
      client_generated_id: payload.client_generated_id ?? null,
      device_id: payload.device_id ?? null,
    },
  }
}

export async function buildPostingSnapshots(
  supabase: ServerSupabase,
  districtId: string,
  sourceId: string | null,
) {
  if (!sourceId) {
    const emptySnapshots = deriveSourceSnapshotsFromChain(null)
    if (!emptySnapshots.ok) {
      throw new ApiRouteError(
        'SOURCE_SNAPSHOT_DERIVATION_FAILED',
        'Failed to derive source snapshots.',
        500,
      )
    }
    return emptySnapshots.snapshots
  }

  const source = await loadSource(supabase, sourceId)

  if (source.district_id !== districtId) {
    throw new ApiRouteError(
      'SOURCE_DISTRICT_MISMATCH',
      'Source does not belong to the selected district.',
      422,
    )
  }
  if (!source.is_active) {
    throw new ApiRouteError(
      'SOURCE_INACTIVE',
      'Inactive sources cannot be used when posting transactions.',
      422,
    )
  }

  const parent = source.parent_id ? await loadSource(supabase, source.parent_id) : null
  const grandparent = parent?.parent_id ? await loadSource(supabase, parent.parent_id) : null

  if (parent && (!parent.is_active || parent.district_id !== districtId)) {
    throw new ApiRouteError(
      'SOURCE_HIERARCHY_INVALID',
      'The selected source has an inactive or cross-district parent.',
      422,
    )
  }

  if (grandparent && (!grandparent.is_active || grandparent.district_id !== districtId)) {
    throw new ApiRouteError(
      'SOURCE_HIERARCHY_INVALID',
      'The selected source has an inactive or cross-district ancestor.',
      422,
    )
  }

  const derived = deriveSourceSnapshotsFromChain({
    source: {
      id: source.id,
      name: source.name,
      type: source.type,
    },
    parent: parent
      ? {
          id: parent.id,
          name: parent.name,
          type: parent.type,
        }
      : null,
    grandparent: grandparent
      ? {
          id: grandparent.id,
          name: grandparent.name,
          type: grandparent.type,
        }
      : null,
  })

  if (!derived.ok) {
    throw new ApiRouteError(derived.code, derived.message, 422)
  }

  return derived.snapshots
}
