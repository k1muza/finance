import { describe, expect, it } from 'vitest'
import {
  addMonths,
  compareEvents,
  eventOccursOn,
  monthGrid,
  startOfMonth,
  todayIso,
} from '@/lib/calendar'
import type { DistrictEvent } from '@/types'

function event(overrides: Partial<DistrictEvent>): DistrictEvent {
  return {
    id: 'e',
    district_id: 'd',
    title: 'Event',
    description: null,
    location: null,
    start_date: '2026-10-12',
    end_date: '2026-10-12',
    start_time: null,
    end_time: null,
    created_by: null,
    created_at: '',
    updated_at: '',
    ...overrides,
  }
}

describe('calendar helpers', () => {
  it('builds a 6-week Sunday-first grid around the month', () => {
    const grid = monthGrid('2026-10-06')
    expect(grid).toHaveLength(42)
    // 1 Oct 2026 is a Thursday, so the grid starts on Sunday 27 Sep.
    expect(grid[0]).toBe('2026-09-27')
    expect(grid[4]).toBe('2026-10-01')
    expect(grid[41]).toBe('2026-11-07')
  })

  it('moves between months across year boundaries', () => {
    expect(addMonths('2026-12-31', 1)).toBe('2027-01-01')
    expect(addMonths('2026-01-15', -1)).toBe('2025-12-01')
    expect(startOfMonth('2026-03-30')).toBe('2026-03-01')
  })

  it('formats today using local date parts', () => {
    expect(todayIso(new Date(2026, 9, 6, 23, 59))).toBe('2026-10-06')
  })

  it('matches multi-day events on every day they span', () => {
    const conference = event({ start_date: '2026-10-30', end_date: '2026-11-01' })
    expect(eventOccursOn(conference, '2026-10-29')).toBe(false)
    expect(eventOccursOn(conference, '2026-10-31')).toBe(true)
    expect(eventOccursOn(conference, '2026-11-01')).toBe(true)
    expect(eventOccursOn(conference, '2026-11-02')).toBe(false)
  })

  it('orders all-day events before timed ones', () => {
    const timed = event({ id: 't', title: 'A', start_time: '09:00:00' })
    const allDay = event({ id: 'a', title: 'B' })
    expect([timed, allDay].sort(compareEvents).map((e) => e.id)).toEqual(['a', 't'])
  })
})
