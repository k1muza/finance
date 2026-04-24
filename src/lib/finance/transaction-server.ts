import type {
  CashbookEffectDirection,
  CounterpartyType,
  Currency,
  IndividualTitle,
  MemberType,
  TransactionKind,
} from '@/types'
import { createServerClient } from '@/lib/supabase/server'
import { ApiRouteError } from '@/lib/server/errors'
import {
  defaultEffectDirectionForTransactionKind,
  deriveMemberSnapshotsFromChain,
  fundNatureAllowsTransactionKind,
  transactionKindNeedsPartyDetails,
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
  requires_individual_member: boolean
}

type MemberRecord = {
  id: string
  district_id: string
  type: MemberType
  name: string
  title: IndividualTitle
  is_active: boolean
  parent_id: string | null
}

type CounterpartyRecord = {
  id: string
  district_id: string
  type: CounterpartyType
  name: string
  is_active: boolean
}

type DistrictWorkflowSettings = {
  id: string
  auto_post_cashbook_transactions: boolean
}

export interface TransactionDraftPayload {
  district_id: string
  account_id: string
  fund_id?: string | null
  member_id?: string | null
  counterparty_id?: string | null
  kind: TransactionKind
  effect_direction?: CashbookEffectDirection | null
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
  member: MemberRecord | null
  counterpartyRecord: CounterpartyRecord | null
  values: {
    district_id: string
    account_id: string
    fund_id: string | null
    member_id: string | null
    counterparty_id: string | null
    kind: TransactionKind
    effect_direction: CashbookEffectDirection
    transaction_date: string
    counterparty: string | null
    narration: string | null
    currency: Currency
    total_amount: number
    client_generated_id: string | null
    device_id: string | null
  }
}

type HydratableTransaction = {
  member_id: string | null
  counterparty_id: string | null
  assembly_member_snapshot_id?: string | null
  region_member_snapshot_id?: string | null
}

export async function hydrateTransactionParties<T extends HydratableTransaction>(
  supabase: ServerSupabase,
  rows: T[],
): Promise<Array<T & {
  member: MemberRecord | null
  counterparty_record: CounterpartyRecord | null
  assembly_member_snapshot: MemberRecord | null
  region_member_snapshot: MemberRecord | null
}>> {
  if (rows.length === 0) return []

  const memberIds = Array.from(new Set(
    rows.flatMap((row) => [
      row.member_id,
      row.assembly_member_snapshot_id ?? null,
      row.region_member_snapshot_id ?? null,
    ].filter((value): value is string => Boolean(value))),
  ))
  const counterpartyIds = Array.from(new Set(
    rows
      .map((row) => row.counterparty_id)
      .filter((value): value is string => Boolean(value)),
  ))

  const memberMap = new Map<string, MemberRecord>()
  const counterpartyMap = new Map<string, CounterpartyRecord>()

  if (memberIds.length > 0) {
    const { data: members, error } = await supabase
      .from('members')
      .select('id, district_id, type, name, title, is_active, parent_id')
      .in('id', memberIds)

    if (error) {
      throw new ApiRouteError(
        'MEMBER_HYDRATION_FAILED',
        error.message,
        500,
      )
    }

    for (const member of members ?? []) {
      memberMap.set(member.id, member as MemberRecord)
    }
  }

  if (counterpartyIds.length > 0) {
    const { data: counterparties, error } = await supabase
      .from('counterparties')
      .select('id, district_id, type, name, is_active')
      .in('id', counterpartyIds)

    if (error) {
      throw new ApiRouteError(
        'COUNTERPARTY_HYDRATION_FAILED',
        error.message,
        500,
      )
    }

    for (const counterparty of counterparties ?? []) {
      counterpartyMap.set(counterparty.id, counterparty as CounterpartyRecord)
    }
  }

  return rows.map((row) => ({
    ...row,
    member: row.member_id ? memberMap.get(row.member_id) ?? null : null,
    counterparty_record: row.counterparty_id
      ? counterpartyMap.get(row.counterparty_id) ?? null
      : null,
    assembly_member_snapshot: row.assembly_member_snapshot_id
      ? memberMap.get(row.assembly_member_snapshot_id) ?? null
      : null,
    region_member_snapshot: row.region_member_snapshot_id
      ? memberMap.get(row.region_member_snapshot_id) ?? null
      : null,
  }))
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
    .select('id, district_id, nature, is_active, requires_individual_member')
    .eq('id', fundId)
    .maybeSingle()

  if (error || !fund) {
    throw new ApiRouteError('FUND_NOT_FOUND', 'Fund not found.', 404)
  }

  return fund as FundRecord
}

async function loadMember(
  supabase: ServerSupabase,
  memberId: string,
) {
  const { data: member, error } = await supabase
    .from('members')
    .select('id, district_id, type, name, title, is_active, parent_id')
    .eq('id', memberId)
    .maybeSingle()

  if (error || !member) {
    throw new ApiRouteError('MEMBER_NOT_FOUND', 'Member not found.', 404)
  }

  return member as MemberRecord
}

async function loadCounterparty(
  supabase: ServerSupabase,
  counterpartyId: string,
) {
  const { data: counterparty, error } = await supabase
    .from('counterparties')
    .select('id, district_id, type, name, is_active')
    .eq('id', counterpartyId)
    .maybeSingle()

  if (error || !counterparty) {
    throw new ApiRouteError('COUNTERPARTY_NOT_FOUND', 'Counterparty not found.', 404)
  }

  return counterparty as CounterpartyRecord
}

interface TransactionDraftValidationOptions {
  allowStandaloneTransfer?: boolean
}

export async function validateDraftTransactionPayload(
  supabase: ServerSupabase,
  payload: TransactionDraftPayload,
  options: TransactionDraftValidationOptions = {},
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
  if (payload.kind === 'transfer' && !options.allowStandaloneTransfer) {
    throw new ApiRouteError(
      'TRANSFER_WORKFLOW_REQUIRED',
      'Use the dedicated transfer workflow instead of creating transfer cashbook rows directly.',
      422,
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

  if (payload.member_id && payload.counterparty_id) {
    throw new ApiRouteError(
      'PARTY_SELECTION_CONFLICT',
      'Select either a member or a registered counterparty, not both.',
      422,
    )
  }

  let member: MemberRecord | null = null
  if (payload.member_id) {
    member = await loadMember(supabase, payload.member_id)

    if (member.district_id !== payload.district_id) {
      throw new ApiRouteError(
        'MEMBER_DISTRICT_MISMATCH',
        'Member does not belong to the selected district.',
        422,
      )
    }
    if (!member.is_active) {
      throw new ApiRouteError(
        'MEMBER_INACTIVE',
        'Inactive members cannot be used for new transactions.',
        422,
      )
    }
  }

  let counterpartyRecord: CounterpartyRecord | null = null
  if (payload.counterparty_id) {
    if (payload.kind !== 'payment') {
      throw new ApiRouteError(
        'COUNTERPARTY_KIND_MISMATCH',
        'Registered counterparties can only be used on payment transactions.',
        422,
      )
    }

    counterpartyRecord = await loadCounterparty(supabase, payload.counterparty_id)

    if (counterpartyRecord.district_id !== payload.district_id) {
      throw new ApiRouteError(
        'COUNTERPARTY_DISTRICT_MISMATCH',
        'Counterparty does not belong to the selected district.',
        422,
      )
    }
    if (!counterpartyRecord.is_active) {
      throw new ApiRouteError(
        'COUNTERPARTY_INACTIVE',
        'Inactive counterparties cannot be used for new transactions.',
        422,
      )
    }
  }

  if (payload.kind === 'receipt' && fund?.requires_individual_member && member?.type !== 'individual') {
    throw new ApiRouteError(
      'INDIVIDUAL_MEMBER_REQUIRED',
      'This fund requires an individual member on receipts.',
      422,
    )
  }

  const counterparty = normalizeNullableText(payload.counterparty)
  if (
    transactionKindNeedsPartyDetails(payload.kind)
    && !member
    && !counterpartyRecord
    && !counterparty
  ) {
    throw new ApiRouteError(
      'PARTY_REQUIRED',
      'Provide either a district member, a registered counterparty, or a fallback counterparty name.',
      422,
    )
  }

  const defaultDirection = defaultEffectDirectionForTransactionKind(payload.kind)
  const effectDirection = payload.kind === 'adjustment'
    ? (payload.effect_direction ?? defaultDirection ?? 'in')
    : defaultDirection

  if (!effectDirection) {
    if (payload.kind === 'reversal') {
      throw new ApiRouteError(
        'REVERSAL_DRAFT_FORBIDDEN',
        'Reversal transactions are generated by the reversal workflow.',
        422,
      )
    }

    throw new ApiRouteError(
      'EFFECT_DIRECTION_REQUIRED',
      'Unable to determine the signed effect of this transaction.',
      422,
    )
  }

  if (payload.effect_direction && payload.kind !== 'adjustment' && payload.effect_direction !== effectDirection) {
    throw new ApiRouteError(
      'EFFECT_DIRECTION_CONFLICT',
      'The supplied effect direction does not match the selected transaction kind.',
      422,
    )
  }

  return {
    account,
    fund,
    member,
    counterpartyRecord,
    values: {
      district_id: payload.district_id,
      account_id: account.id,
      fund_id: fund?.id ?? null,
      member_id: member?.id ?? null,
      counterparty_id: counterpartyRecord?.id ?? null,
      kind: payload.kind,
      effect_direction: effectDirection,
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
  memberId: string | null,
) {
  if (!memberId) {
    const emptySnapshots = deriveMemberSnapshotsFromChain(null)
    if (!emptySnapshots.ok) {
      throw new ApiRouteError(
        'MEMBER_SNAPSHOT_DERIVATION_FAILED',
        'Failed to derive member snapshots.',
        500,
      )
    }
    return emptySnapshots.snapshots
  }

  const member = await loadMember(supabase, memberId)

  if (member.district_id !== districtId) {
    throw new ApiRouteError(
      'MEMBER_DISTRICT_MISMATCH',
      'Member does not belong to the selected district.',
      422,
    )
  }
  if (!member.is_active) {
    throw new ApiRouteError(
      'MEMBER_INACTIVE',
      'Inactive members cannot be used when posting transactions.',
      422,
    )
  }

  const parent = member.parent_id ? await loadMember(supabase, member.parent_id) : null
  const grandparent = parent?.parent_id ? await loadMember(supabase, parent.parent_id) : null

  if (parent && (!parent.is_active || parent.district_id !== districtId)) {
    throw new ApiRouteError(
      'MEMBER_HIERARCHY_INVALID',
      'The selected member has an inactive or cross-district parent.',
      422,
    )
  }

  if (grandparent && (!grandparent.is_active || grandparent.district_id !== districtId)) {
    throw new ApiRouteError(
      'MEMBER_HIERARCHY_INVALID',
      'The selected member has an inactive or cross-district ancestor.',
      422,
    )
  }

  const derived = deriveMemberSnapshotsFromChain({
    member: {
      id: member.id,
      name: member.name,
      type: member.type,
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

export async function loadDistrictWorkflowSettings(
  supabase: ServerSupabase,
  districtId: string,
) {
  const { data: district, error } = await supabase
    .from('districts')
    .select('id, auto_post_cashbook_transactions')
    .eq('id', districtId)
    .maybeSingle()

  if (error || !district) {
    throw new ApiRouteError('DISTRICT_NOT_FOUND', 'District not found.', 404)
  }

  return district as DistrictWorkflowSettings
}

interface PostableTransactionRecord {
  district_id: string
  account_id: string
  fund_id: string | null
  member_id: string | null
  counterparty_id: string | null
  kind: TransactionKind
  effect_direction: CashbookEffectDirection
  transaction_date: string
  counterparty: string | null
  narration: string | null
  currency: Currency
  total_amount: number
}

interface BuildPostedTransactionUpdateOptions {
  includeWorkflowActors?: boolean
  now?: string
}

export async function buildPostedTransactionUpdate(
  supabase: ServerSupabase,
  txn: PostableTransactionRecord,
  actorUserId: string,
  options: BuildPostedTransactionUpdateOptions = {},
) {
  await validateDraftTransactionPayload(
    supabase,
    {
      district_id: txn.district_id,
      account_id: txn.account_id,
      fund_id: txn.fund_id,
      member_id: txn.member_id,
      counterparty_id: txn.counterparty_id,
      kind: txn.kind,
      effect_direction: txn.effect_direction,
      transaction_date: txn.transaction_date,
      counterparty: txn.counterparty,
      narration: txn.narration,
      currency: txn.currency,
      total_amount: txn.total_amount,
    },
    {
      allowStandaloneTransfer: txn.kind === 'transfer',
    },
  )

  const snapshots = await buildPostingSnapshots(
    supabase,
    txn.district_id,
    txn.member_id,
  )

  const { data: refData, error: refError } = await supabase
    .rpc('next_transaction_number', { p_district_id: txn.district_id })

  if (refError || !refData) {
    throw new ApiRouteError(
      'REFERENCE_NUMBER_FAILED',
      refError?.message ?? 'Failed to generate reference number.',
      500,
    )
  }

  const now = options.now ?? new Date().toISOString()

  return {
    status: 'posted' as const,
    reference_number: refData as string,
    posted_by: actorUserId,
    posted_at: now,
    member_name_snapshot: snapshots.memberNameSnapshot,
    member_type_snapshot: snapshots.memberTypeSnapshot,
    member_parent_name_snapshot: snapshots.memberParentNameSnapshot,
    assembly_member_snapshot_id: snapshots.assemblyMemberSnapshotId,
    region_member_snapshot_id: snapshots.regionMemberSnapshotId,
    ...(options.includeWorkflowActors
      ? {
          submitted_by: actorUserId,
          submitted_at: now,
          approved_by: actorUserId,
          approved_at: now,
        }
      : {}),
  }
}
