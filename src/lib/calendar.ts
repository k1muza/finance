// Calendar date helpers. Dates are plain 'YYYY-MM-DD' strings (matching the
// DATE columns) and all arithmetic runs in UTC, so results never shift with
// the browser's timezone.

import type { DistrictEvent } from '@/types'

export const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

function toIso(date: Date) {
  return date.toISOString().slice(0, 10)
}

function parseIso(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

export function addDays(iso: string, days: number) {
  const date = parseIso(iso)
  date.setUTCDate(date.getUTCDate() + days)
  return toIso(date)
}

/** First day of the month containing `iso`. */
export function startOfMonth(iso: string) {
  return `${iso.slice(0, 7)}-01`
}

export function addMonths(iso: string, months: number) {
  const date = parseIso(startOfMonth(iso))
  date.setUTCMonth(date.getUTCMonth() + months)
  return toIso(date)
}

/** Today's date in the viewer's local timezone, as 'YYYY-MM-DD'. */
export function todayIso(now = new Date()) {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Six Sunday-first weeks (42 days) covering the month containing `iso`. */
export function monthGrid(iso: string): string[] {
  const first = startOfMonth(iso)
  const gridStart = addDays(first, -parseIso(first).getUTCDay())
  return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i))
}

export function isSameMonth(a: string, b: string) {
  return a.slice(0, 7) === b.slice(0, 7)
}

export function eventOccursOn(event: Pick<DistrictEvent, 'start_date' | 'end_date'>, day: string) {
  return event.start_date <= day && event.end_date >= day
}

/** All-day events first, then by start time, then title. */
export function compareEvents(a: DistrictEvent, b: DistrictEvent) {
  if (a.start_date !== b.start_date) return a.start_date < b.start_date ? -1 : 1
  const at = a.start_time ?? ''
  const bt = b.start_time ?? ''
  if (at !== bt) return at < bt ? -1 : 1
  return a.title.localeCompare(b.title)
}

export function formatMonthTitle(iso: string) {
  return parseIso(iso).toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

export function formatDayLong(iso: string) {
  return parseIso(iso).toLocaleDateString(undefined, {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  })
}

export function formatDayShort(iso: string) {
  return parseIso(iso).toLocaleDateString(undefined, {
    weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC',
  })
}

/** 'HH:MM[:SS]' → '09:30' */
export function formatTime(time: string) {
  return time.slice(0, 5)
}

export function formatEventWhen(event: DistrictEvent) {
  const days = event.start_date === event.end_date
    ? formatDayShort(event.start_date)
    : `${formatDayShort(event.start_date)} – ${formatDayShort(event.end_date)}`
  if (!event.start_time) return `${days} · All day`
  const times = event.end_time
    ? `${formatTime(event.start_time)}–${formatTime(event.end_time)}`
    : formatTime(event.start_time)
  return `${days} · ${times}`
}
