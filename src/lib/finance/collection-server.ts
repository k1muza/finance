import type { createServerClient } from '@/lib/supabase/server'
import type { DistrictActor } from '@/lib/auth/server'
import {
  buildPostedTransactionUpdate,
  validateDraftTransactionPayload,
} from '@/lib/finance/transaction-server'
import { unpostedLines } from '@/lib/finance/collections'
import { ApiRouteError } from '@/lib/server/errors'
import type { Collection, CollectionLine, CollectionStatus } from '@/types'

type ServerSupabase = ReturnType<typeof createServerClient>

export interface CollectionRecord extends Collection {
  lines: CollectionLine[]
}

export async function loadCollection(supabase: ServerSupabase, id: string): Promise<CollectionRecord> {
  const { data, error } = await supabase
    .from('collections')
    .select('*, lines:collection_lines(*)')
    .eq('id', id)
    .maybeSingle()

  if (error) throw new ApiRouteError('COLLECTION_READ_FAILED', error.message, 500)
  if (!data) throw new ApiRouteError('COLLECTION_NOT_FOUND', 'Collection not found.', 404)
  return data as CollectionRecord
}

function requireStatus(collection: Collection, expected: CollectionStatus, action: string) {
  if (collection.status !== expected) {
    throw new ApiRouteError(
      'INVALID_COLLECTION_STATUS',
      `Cannot ${action} a collection that is ${collection.status}.`,
      422,
    )
  }
}

/** recorded → submitted: the money has reached the office. */
export async function submitCollection(supabase: ServerSupabase, collection: CollectionRecord, actor: DistrictActor) {
  requireStatus(collection, 'recorded', 'submit')
  if (collection.lines.length === 0) {
    throw new ApiRouteError('COLLECTION_EMPTY', 'Add at least one line before submitting.', 422)
  }

  const { data, error } = await supabase
    .from('collections')
    .update({ status: 'submitted', submitted_at: new Date().toISOString(), received_by: actor.user.id })
    .eq('id', collection.id)
    .eq('status', 'recorded')
    .select()
    .single()

  if (error || !data) throw new ApiRouteError('COLLECTION_SUBMIT_FAILED', error?.message ?? 'Failed to submit.', 500)
  return data as Collection
}

export interface PostCollectionInput {
  account_id: string
  /** collection_type_id → fund_id */
  funds: Record<string, string>
  /** Defaults to the collection date. */
  transaction_date?: string
}

/**
 * Posts every unposted line as a cashbook receipt into the fund chosen for its
 * collection type, then marks the collection posted. Lines are posted one at a
 * time and linked as they go, so a failure part-way can simply be retried.
 */
export async function postCollection(
  supabase: ServerSupabase,
  collection: CollectionRecord,
  actor: DistrictActor,
  input: PostCollectionInput,
) {
  requireStatus(collection, 'submitted', 'post')
  if (!input.account_id) throw new ApiRouteError('ACCOUNT_ID_REQUIRED', 'Choose the account that received the money.', 400)

  const pending = unpostedLines(collection.lines)
  const missingFund = pending.find((line) => !input.funds[line.collection_type_id])
  if (missingFund) {
    throw new ApiRouteError('FUND_REQUIRED', 'Choose a fund for every collection type.', 400)
  }

  const [{ data: types }, { data: scope }] = await Promise.all([
    supabase.from('collection_types').select('id, name').in('id', [...new Set(pending.map((l) => l.collection_type_id))]),
    supabase.from('members').select('name').eq('id', collection.scope_member_id).maybeSingle(),
  ])
  const typeName = new Map((types ?? []).map((t: { id: string; name: string }) => [t.id, t.name]))

  for (const line of pending) {
    const narration = [
      `${typeName.get(line.collection_type_id) ?? 'Collection'} — ${scope?.name ?? 'collection'}`,
      collection.reference ? `(${collection.reference})` : null,
    ].filter(Boolean).join(' ')

    // The line id doubles as the receipt's client_generated_id, so a retry
    // after a part-way failure picks up the receipt instead of duplicating it.
    const { data: existing, error: existingError } = await supabase
      .from('cashbook_transactions')
      .select('*')
      .eq('client_generated_id', line.id)
      .maybeSingle()
    if (existingError) throw new ApiRouteError('TRANSACTION_LOOKUP_FAILED', existingError.message, 500)
    if (existing && !['draft', 'posted'].includes(existing.status)) {
      throw new ApiRouteError(
        'COLLECTION_RECEIPT_CLOSED',
        `The receipt for one line was ${existing.status}. Return the collection to the Accounting Officer to resolve it.`,
        422,
      )
    }

    let receipt = existing
    if (!receipt) {
      const validated = await validateDraftTransactionPayload(supabase, {
        district_id: collection.district_id,
        account_id: input.account_id,
        fund_id: input.funds[line.collection_type_id],
        member_id: line.member_id,
        kind: 'receipt',
        transaction_date: input.transaction_date ?? collection.collected_on,
        counterparty: line.member_id ? null : line.contributor_name,
        narration,
        currency: collection.currency,
        total_amount: Number(line.amount),
        client_generated_id: line.id,
      })

      const { data: draft, error: draftError } = await supabase
        .from('cashbook_transactions')
        .insert({ ...validated.values, status: 'draft', created_by: actor.user.id })
        .select('*')
        .single()
      if (draftError || !draft) {
        throw new ApiRouteError('TRANSACTION_CREATE_FAILED', draftError?.message ?? 'Failed to create the receipt.', 500)
      }
      receipt = draft
    }

    if (receipt.status === 'draft') {
      const postedValues = await buildPostedTransactionUpdate(supabase, receipt, actor.user.id, { includeWorkflowActors: true })
      const { error: postError } = await supabase
        .from('cashbook_transactions')
        .update(postedValues)
        .eq('id', receipt.id)
        .eq('status', 'draft')
      if (postError) throw new ApiRouteError('TRANSACTION_POST_FAILED', postError.message, 500)
    }

    const { error: linkError } = await supabase
      .from('collection_lines')
      .update({ cashbook_transaction_id: receipt.id })
      .eq('id', line.id)
      .is('cashbook_transaction_id', null)
    if (linkError) throw new ApiRouteError('COLLECTION_LINK_FAILED', linkError.message, 500)
  }

  const { data, error } = await supabase
    .from('collections')
    .update({ status: 'posted', posted_at: new Date().toISOString() })
    .eq('id', collection.id)
    .eq('status', 'submitted')
    .select()
    .single()

  if (error || !data) throw new ApiRouteError('COLLECTION_POST_FAILED', error?.message ?? 'Failed to mark the collection posted.', 500)
  return { collection: data as Collection, posted: pending.length }
}
