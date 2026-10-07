import type { Collection, CollectionLine, CollectionStatus } from '@/types'

/** Status moves the database allows (see enforce_collection_workflow). */
const TRANSITIONS: Record<CollectionStatus, ReadonlyArray<CollectionStatus>> = {
  recorded: ['submitted', 'voided'],
  submitted: ['posted', 'voided'],
  posted: [],
  voided: [],
}

export function canTransitionCollection(from: CollectionStatus, to: CollectionStatus): boolean {
  return TRANSITIONS[from].includes(to)
}

export const COLLECTION_STATUS_LABELS: Record<CollectionStatus, string> = {
  recorded: 'Awaiting hand-over',
  submitted: 'Submitted to office',
  posted: 'Posted to funds',
  voided: 'Voided',
}

/** Recorded or submitted collections can be voided until any line is posted to a fund. */
export function canVoidCollection(collection: Pick<Collection, 'status' | 'lines'>): boolean {
  if (collection.status === 'recorded') return true
  return collection.status === 'submitted' && !(collection.lines ?? []).some((line) => line.cashbook_transaction_id)
}

export function collectionTotal(lines: ReadonlyArray<Pick<CollectionLine, 'amount'>>): number {
  // Sum in cents so totals of 2dp amounts stay exact.
  return lines.reduce((sum, line) => sum + Math.round(Number(line.amount) * 100), 0) / 100
}

/** Lines still waiting to be posted to a fund. */
export function unpostedLines<T extends Pick<CollectionLine, 'cashbook_transaction_id'>>(lines: ReadonlyArray<T>): T[] {
  return lines.filter((line) => !line.cashbook_transaction_id)
}

export function lineContributor(
  line: Pick<CollectionLine, 'member_id' | 'contributor_name'>,
  memberName: (id: string) => string | null | undefined,
): string {
  return (line.member_id ? memberName(line.member_id) : null) ?? line.contributor_name ?? 'Unnamed'
}

/** Totals per scope unit (region, assembly or ministry). */
export function totalsByScope(collections: ReadonlyArray<Pick<Collection, 'scope_member_id' | 'lines'>>) {
  const totals = new Map<string, number>()
  for (const collection of collections) {
    const amount = collectionTotal(collection.lines ?? [])
    totals.set(collection.scope_member_id, Math.round(((totals.get(collection.scope_member_id) ?? 0) + amount) * 100) / 100)
  }
  return totals
}
