import { beforeEach, describe, expect, it, vi } from 'vitest'

const { validateDraftTransactionPayloadMock, buildPostedTransactionUpdateMock } = vi.hoisted(() => ({
  validateDraftTransactionPayloadMock: vi.fn(),
  buildPostedTransactionUpdateMock: vi.fn(),
}))

vi.mock('@/lib/finance/transaction-server', () => ({
  validateDraftTransactionPayload: validateDraftTransactionPayloadMock,
  buildPostedTransactionUpdate: buildPostedTransactionUpdateMock,
}))

import {
  postCollection,
  submitCollection,
  type CollectionRecord,
} from '@/lib/finance/collection-server'
import type { DistrictActor } from '@/lib/auth/server'

type Row = Record<string, unknown>
type Filter = (row: Row) => boolean

/** In-memory stand-in for the subset of the Supabase query builder used here. */
function createFakeSupabase(tables: Record<string, Row[]>) {
  let idCounter = 0

  return {
    tables,
    from(tableName: string) {
      const rows = (tables[tableName] ??= [])
      const filters: Filter[] = []
      let insertPayload: Row | null = null
      let updatePayload: Row | null = null

      const matching = () => rows.filter((row) => filters.every((f) => f(row)))
      const execute = () => {
        if (insertPayload) {
          const row = { id: `${tableName}-${++idCounter}`, ...insertPayload }
          rows.push(row)
          return [row]
        }
        const found = matching()
        if (updatePayload) for (const row of found) Object.assign(row, updatePayload)
        return found
      }

      const builder = {
        select: () => builder,
        eq: (column: string, value: unknown) => { filters.push((r) => r[column] === value); return builder },
        is: (column: string, value: unknown) => { filters.push((r) => (r[column] ?? null) === value); return builder },
        in: (column: string, values: unknown[]) => { filters.push((r) => values.includes(r[column])); return builder },
        insert: (payload: Row) => { insertPayload = payload; return builder },
        update: (payload: Row) => { updatePayload = payload; return builder },
        async maybeSingle() { return { data: execute()[0] ?? null, error: null } },
        async single() {
          const found = execute()
          return found.length === 1
            ? { data: found[0], error: null }
            : { data: null, error: { message: `${found.length} rows` } }
        },
        then(onFulfilled: (value: unknown) => unknown) {
          return Promise.resolve({ data: execute(), error: null }).then(onFulfilled)
        },
      }
      return builder
    },
  }
}

const actor = { user: { id: 'ao-1' }, role: 'accounting_officer', isSuperuser: false } as unknown as DistrictActor

function collection(overrides: Partial<CollectionRecord> = {}): CollectionRecord {
  return {
    id: 'col-1',
    district_id: 'district-1',
    scope_member_id: 'assembly-1',
    collected_on: '2026-10-05',
    reference: 'Sunday service',
    notes: null,
    currency: 'USD',
    status: 'submitted',
    recorded_by: 'sec-1',
    submitted_at: null,
    received_by: null,
    posted_at: null,
    voided_at: null,
    voided_by: null,
    created_at: '',
    updated_at: '',
    lines: [
      { id: 'line-1', collection_id: 'col-1', collection_type_id: 'tithe', member_id: 'person-1', contributor_name: null, amount: 50, cashbook_transaction_id: null, created_at: '' },
      { id: 'line-2', collection_id: 'col-1', collection_type_id: 'offering', member_id: null, contributor_name: 'Loose offering', amount: 12.5, cashbook_transaction_id: null, created_at: '' },
    ],
    ...overrides,
  }
}

function seed(record: CollectionRecord) {
  const { lines, ...header } = record
  return createFakeSupabase({
    collections: [{ ...header }],
    collection_lines: lines.map((line) => ({ ...line })),
    collection_types: [{ id: 'tithe', name: 'Tithes' }, { id: 'offering', name: 'Offering' }],
    members: [{ id: 'assembly-1', name: 'Takadzoka Assembly' }],
    cashbook_transactions: [],
  })
}

beforeEach(() => {
  validateDraftTransactionPayloadMock.mockReset()
  buildPostedTransactionUpdateMock.mockReset()
  validateDraftTransactionPayloadMock.mockImplementation(async (_supabase, payload) => ({ values: { ...payload } }))
  buildPostedTransactionUpdateMock.mockResolvedValue({ status: 'posted', reference_number: 'R-1' })
})

describe('submitCollection', () => {
  it('moves a recorded collection to submitted and records who received it', async () => {
    const record = collection({ status: 'recorded' })
    const supabase = seed(record)

    const result = await submitCollection(supabase as never, record, actor)

    expect(result.status).toBe('submitted')
    expect(result.received_by).toBe('ao-1')
    expect(result.submitted_at).toBeTruthy()
  })

  it('rejects collections that are not awaiting hand-over', async () => {
    const record = collection({ status: 'submitted' })
    await expect(submitCollection(seed(record) as never, record, actor)).rejects.toMatchObject({ code: 'INVALID_COLLECTION_STATUS' })
  })

  it('rejects empty collections', async () => {
    const record = collection({ status: 'recorded', lines: [] })
    await expect(submitCollection(seed(record) as never, record, actor)).rejects.toMatchObject({ code: 'COLLECTION_EMPTY' })
  })
})

describe('postCollection', () => {
  const input = { account_id: 'cash', funds: { tithe: 'fund-tithe', offering: 'fund-general' } }

  it('posts one receipt per line into the chosen funds and marks the collection posted', async () => {
    const record = collection()
    const supabase = seed(record)

    const result = await postCollection(supabase as never, record, actor, input)

    expect(result.posted).toBe(2)
    expect(result.collection.status).toBe('posted')

    const receipts = supabase.tables.cashbook_transactions
    expect(receipts).toHaveLength(2)
    expect(receipts.every((r) => r.status === 'posted')).toBe(true)

    expect(validateDraftTransactionPayloadMock).toHaveBeenCalledWith(supabase, expect.objectContaining({
      kind: 'receipt',
      account_id: 'cash',
      fund_id: 'fund-tithe',
      member_id: 'person-1',
      counterparty: null,
      total_amount: 50,
      transaction_date: '2026-10-05',
      client_generated_id: 'line-1',
      narration: 'Tithes — Takadzoka Assembly (Sunday service)',
    }))
    expect(validateDraftTransactionPayloadMock).toHaveBeenCalledWith(supabase, expect.objectContaining({
      fund_id: 'fund-general',
      member_id: null,
      counterparty: 'Loose offering',
      total_amount: 12.5,
    }))

    const lines = supabase.tables.collection_lines
    expect(lines.map((l) => l.cashbook_transaction_id)).toEqual(receipts.map((r) => r.id))
  })

  it('requires a fund for every collection type', async () => {
    const record = collection()
    await expect(
      postCollection(seed(record) as never, record, actor, { account_id: 'cash', funds: { tithe: 'fund-tithe' } }),
    ).rejects.toMatchObject({ code: 'FUND_REQUIRED' })
    expect(validateDraftTransactionPayloadMock).not.toHaveBeenCalled()
  })

  it('only posts submitted collections', async () => {
    const record = collection({ status: 'recorded' })
    await expect(postCollection(seed(record) as never, record, actor, input)).rejects.toMatchObject({ code: 'INVALID_COLLECTION_STATUS' })
  })

  it('reuses a receipt left behind by an earlier attempt instead of duplicating it', async () => {
    const record = collection()
    const supabase = seed(record)
    supabase.tables.cashbook_transactions.push({ id: 'txn-earlier', client_generated_id: 'line-1', status: 'posted' })

    await postCollection(supabase as never, record, actor, input)

    expect(supabase.tables.cashbook_transactions).toHaveLength(2)
    expect(supabase.tables.collection_lines[0].cashbook_transaction_id).toBe('txn-earlier')
  })
})
