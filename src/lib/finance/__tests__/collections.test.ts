import { describe, expect, it } from 'vitest'
import {
  canTransitionCollection,
  canVoidCollection,
  collectionTotal,
  lineContributor,
  totalsByScope,
  unpostedLines,
} from '@/lib/finance/collections'

describe('collection workflow', () => {
  it('allows recorded → submitted → posted, with voiding before posting', () => {
    expect(canTransitionCollection('recorded', 'submitted')).toBe(true)
    expect(canTransitionCollection('submitted', 'posted')).toBe(true)
    expect(canTransitionCollection('recorded', 'voided')).toBe(true)
    expect(canTransitionCollection('submitted', 'voided')).toBe(true)
  })

  it('never skips the hand-over, goes backwards, or leaves posted / voided', () => {
    expect(canTransitionCollection('recorded', 'posted')).toBe(false)
    expect(canTransitionCollection('submitted', 'recorded')).toBe(false)
    expect(canTransitionCollection('posted', 'voided')).toBe(false)
    expect(canTransitionCollection('voided', 'recorded')).toBe(false)
  })

  it('allows voiding only until a line is posted to a fund', () => {
    const line = (posted: boolean) => ({ cashbook_transaction_id: posted ? 'txn' : null }) as never
    expect(canVoidCollection({ status: 'recorded', lines: [line(false)] })).toBe(true)
    expect(canVoidCollection({ status: 'submitted', lines: [line(false)] })).toBe(true)
    expect(canVoidCollection({ status: 'submitted', lines: [line(true), line(false)] })).toBe(false)
    expect(canVoidCollection({ status: 'posted', lines: [line(true)] })).toBe(false)
    expect(canVoidCollection({ status: 'voided', lines: [] })).toBe(false)
  })
})

describe('collection totals', () => {
  it('adds 2dp amounts exactly', () => {
    expect(collectionTotal([{ amount: 0.1 }, { amount: 0.2 }])).toBe(0.3)
    expect(collectionTotal([])).toBe(0)
  })

  it('totals collections per unit', () => {
    const totals = totalsByScope([
      { scope_member_id: 'a', lines: [{ amount: 10 } as never, { amount: 5 } as never] },
      { scope_member_id: 'b', lines: [{ amount: 7 } as never] },
      { scope_member_id: 'a', lines: [{ amount: 2.5 } as never] },
    ])
    expect(totals.get('a')).toBe(17.5)
    expect(totals.get('b')).toBe(7)
  })
})

describe('collection lines', () => {
  it('finds lines still to post', () => {
    const lines = [
      { id: '1', cashbook_transaction_id: null },
      { id: '2', cashbook_transaction_id: 'txn' },
    ]
    expect(unpostedLines(lines).map((l) => l.id)).toEqual(['1'])
  })

  it('names the contributor from the member or the free-text name', () => {
    const names = (id: string) => (id === 'm1' ? 'Tendai Moyo' : null)
    expect(lineContributor({ member_id: 'm1', contributor_name: null }, names)).toBe('Tendai Moyo')
    expect(lineContributor({ member_id: null, contributor_name: 'Loose offering' }, names)).toBe('Loose offering')
    expect(lineContributor({ member_id: null, contributor_name: null }, names)).toBe('Unnamed')
  })
})
