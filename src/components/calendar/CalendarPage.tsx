'use client'

import { useMemo, useState, type FormEvent } from 'react'
import { Building2, CalendarDays, ChevronLeft, ChevronRight, Clock, MapPin, Plus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Select } from '@/components/ui/Select'
import { PageHeader } from '@/components/ui/PageHeader'
import { useToast } from '@/components/ui/Toast'
import { SelectDistrictHint } from '@/components/layout/SelectDistrictHint'
import { useAuth } from '@/contexts/AuthContext'
import { usePermissions } from '@/hooks/usePermissions'
import { useDistrictEvents, type DistrictEventInput } from '@/hooks/useDistrictEvents'
import { useDepartments } from '@/hooks/useDepartments'
import {
  WEEKDAY_LABELS,
  addMonths,
  compareEvents,
  eventOccursOn,
  formatDayLong,
  formatEventWhen,
  formatMonthTitle,
  formatTime,
  isSameMonth,
  monthGrid,
  startOfMonth,
  todayIso,
} from '@/lib/calendar'
import { cn } from '@/lib/utils/cn'
import type { DistrictEvent } from '@/types'

const TITLE = 'Calendar'
const DESCRIPTION = 'District services, conferences and meetings.'
const MAX_CHIPS_PER_DAY = 3

interface EventFormState {
  title: string
  allDay: boolean
  start_date: string
  start_time: string
  end_date: string
  end_time: string
  location: string
  description: string
  /** '' when the event isn't tied to a department */
  department_id: string
}

function emptyForm(date: string, departmentId = ''): EventFormState {
  return {
    title: '',
    allDay: true,
    start_date: date,
    start_time: '09:00',
    end_date: date,
    end_time: '',
    location: '',
    description: '',
    department_id: departmentId,
  }
}

function formFromEvent(event: DistrictEvent): EventFormState {
  return {
    title: event.title,
    allDay: event.start_time === null,
    start_date: event.start_date,
    start_time: event.start_time ? formatTime(event.start_time) : '09:00',
    end_date: event.end_date,
    end_time: event.end_time ? formatTime(event.end_time) : '',
    location: event.location ?? '',
    description: event.description ?? '',
    department_id: event.department_id ?? '',
  }
}

function validateForm(form: EventFormState): string | null {
  if (!form.title.trim()) return 'Title is required'
  if (!form.start_date || !form.end_date) return 'Start and end dates are required'
  if (form.end_date < form.start_date) return 'End date can’t be before the start date'
  if (!form.allDay) {
    if (!form.start_time) return 'Start time is required, or tick “All day”'
    if (form.end_time && form.end_date === form.start_date && form.end_time < form.start_time) {
      return 'End time can’t be before the start time'
    }
  }
  return null
}

function toInput(form: EventFormState): DistrictEventInput {
  return {
    title: form.title.trim(),
    description: form.description.trim() || null,
    location: form.location.trim() || null,
    start_date: form.start_date,
    end_date: form.end_date,
    start_time: form.allDay ? null : form.start_time,
    end_time: form.allDay || !form.end_time ? null : form.end_time,
    department_id: form.department_id || null,
  }
}

type Dialog =
  | { kind: 'create'; date: string }
  | { kind: 'event'; event: DistrictEvent }
  | { kind: 'day'; date: string }

export function CalendarPage() {
  const { districtId } = useAuth()
  const { can, role, scopeDepartmentId } = usePermissions()
  // Departmental secretaries manage only their own department's events.
  const canManageAll = can('events.manage')
  const ownDepartmentId = role === 'departmental_secretary' ? scopeDepartmentId : null
  const canCreate = canManageAll || Boolean(ownDepartmentId)
  const canManageEvent = (event: DistrictEvent) =>
    canManageAll || (ownDepartmentId !== null && event.department_id === ownDepartmentId)
  const { data: departments } = useDepartments(districtId, { withRoster: false })
  const departmentName = (id: string | null) => departments.find((d) => d.id === id)?.name ?? null
  const departmentOptions = departments
    .filter((d) => d.is_active && (canManageAll || d.id === ownDepartmentId))
    .map((d) => ({ value: d.id, label: d.name }))
  const toast = useToast()

  const today = todayIso()
  const [month, setMonth] = useState(() => startOfMonth(today))
  const grid = useMemo(() => monthGrid(month), [month])
  const { data: events, loading, error, add, update, remove } = useDistrictEvents(
    districtId,
    grid[0],
    grid[grid.length - 1],
  )

  const [dialog, setDialog] = useState<Dialog | null>(null)
  const [form, setForm] = useState<EventFormState>(() => emptyForm(today))
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const sortedEvents = useMemo(() => [...events].sort(compareEvents), [events])
  const eventsOn = (day: string) => sortedEvents.filter((e) => eventOccursOn(e, day))
  const monthEvents = sortedEvents.filter((e) => e.end_date >= month && e.start_date < addMonths(month, 1))

  if (!districtId) {
    return (
      <div className="mx-auto max-w-7xl space-y-6 p-6">
        <PageHeader title={TITLE} description={DESCRIPTION} />
        <SelectDistrictHint description="Choose a district to see its calendar." />
      </div>
    )
  }

  const openCreate = (date: string) => {
    if (!canCreate) return
    setForm(emptyForm(date, canManageAll ? '' : ownDepartmentId ?? ''))
    setEditing(true)
    setDialog({ kind: 'create', date })
  }

  const openEvent = (event: DistrictEvent) => {
    setForm(formFromEvent(event))
    setEditing(false)
    setDialog({ kind: 'event', event })
  }

  const closeDialog = () => {
    setDialog(null)
    setEditing(false)
    setConfirmDelete(false)
  }

  const setField = <K extends keyof EventFormState>(key: K, value: EventFormState[K]) => {
    setForm((current) => {
      const next = { ...current, [key]: value }
      // Keep the range valid when the start moves past the end.
      if (key === 'start_date' && next.end_date < next.start_date) next.end_date = next.start_date
      return next
    })
  }

  const handleSave = async (e: FormEvent) => {
    e.preventDefault()
    const problem = validateForm(form)
    if (problem) {
      toast.error(problem)
      return
    }
    setSaving(true)
    try {
      if (dialog?.kind === 'event') {
        await update(dialog.event.id, toInput(form))
        toast.success('Event updated')
      } else {
        await add(toInput(form))
        toast.success('Event added')
      }
      // Jump to the event's month so the user sees what they just saved.
      if (!isSameMonth(form.start_date, month)) setMonth(startOfMonth(form.start_date))
      closeDialog()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (dialog?.kind !== 'event') return
    setSaving(true)
    try {
      await remove(dialog.event.id)
      toast.success('Event deleted')
      closeDialog()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  const dialogTitle = !dialog
    ? ''
    : dialog.kind === 'create'
      ? 'New event'
      : dialog.kind === 'day'
        ? formatDayLong(dialog.date)
        : editing ? 'Edit event' : dialog.event.title

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <PageHeader
        title={TITLE}
        description={DESCRIPTION}
        actions={canCreate ? (
          <Button onClick={() => openCreate(isSameMonth(today, month) ? today : month)}>
            <Plus className="h-4 w-4" />
            New event
          </Button>
        ) : undefined}
      />

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3 [border-color:var(--border-subtle)]">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">{formatMonthTitle(month)}</h2>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => setMonth(startOfMonth(today))}>
              Today
            </Button>
            <Button variant="ghost" size="sm" aria-label="Previous month" onClick={() => setMonth(addMonths(month, -1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" aria-label="Next month" onClick={() => setMonth(addMonths(month, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {error && (
          <CardContent>
            <p className="text-sm text-red-400">{error}</p>
          </CardContent>
        )}

        {/* Month grid — tablet and up */}
        <div className={cn('hidden md:block', loading && 'opacity-60')}>
          <div className="grid grid-cols-7 border-b text-xs font-medium uppercase tracking-wide text-[var(--text-tertiary)] [border-color:var(--border-subtle)]">
            {WEEKDAY_LABELS.map((label) => (
              <div key={label} className="px-2 py-2">{label}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {grid.map((day, index) => {
              const dayEvents = eventsOn(day)
              const overflow = dayEvents.length - MAX_CHIPS_PER_DAY
              const inMonth = isSameMonth(day, month)
              return (
                <div
                  key={day}
                  onClick={() => openCreate(day)}
                  className={cn(
                    'flex min-h-28 flex-col gap-1 border-b border-r p-1.5 [border-color:var(--border-subtle)]',
                    index % 7 === 6 && 'border-r-0',
                    index >= 35 && 'border-b-0',
                    !inMonth && 'bg-[var(--surface-panel-muted)]',
                    canCreate && 'cursor-pointer hover:bg-[var(--button-ghost-hover)]'
                  )}
                >
                  <span
                    className={cn(
                      'inline-flex h-6 w-6 items-center justify-center self-end rounded-full text-xs',
                      day === today
                        ? 'bg-[var(--accent-solid)] font-semibold text-[var(--accent-contrast)]'
                        : inMonth ? 'text-[var(--text-secondary)]' : 'text-[var(--text-muted)]'
                    )}
                  >
                    {Number(day.slice(8))}
                  </span>
                  {dayEvents.slice(0, MAX_CHIPS_PER_DAY).map((event) => (
                    <button
                      key={event.id}
                      type="button"
                      onClick={(e) => { e.stopPropagation(); openEvent(event) }}
                      title={event.title}
                      className="truncate rounded-sm border border-cyan-500/20 bg-cyan-500/10 px-1.5 py-0.5 text-left text-xs text-cyan-400 hover:bg-cyan-500/20"
                    >
                      {event.start_time && event.start_date === day && (
                        <span className="mr-1 opacity-75">{formatTime(event.start_time)}</span>
                      )}
                      {event.title}
                    </button>
                  ))}
                  {overflow > 0 && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setDialog({ kind: 'day', date: day }) }}
                      className="px-1.5 text-left text-xs text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                    >
                      +{overflow} more
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Agenda — phones */}
        <div className="md:hidden">
          {monthEvents.length === 0 ? (
            <CardContent>
              <p className="text-sm text-[var(--text-tertiary)]">{loading ? 'Loading…' : 'No events this month.'}</p>
            </CardContent>
          ) : (
            <ul className="divide-y [&>li]:[border-color:var(--border-subtle)]">
              {monthEvents.map((event) => (
                <li key={event.id}>
                  <EventRow event={event} onOpen={openEvent} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      <Modal open={dialog !== null && !confirmDelete} onClose={closeDialog} title={dialogTitle}>
        {dialog?.kind === 'day' && (
          <div className="space-y-2">
            <ul className="-mx-6 divide-y [&>li]:[border-color:var(--border-subtle)]">
              {eventsOn(dialog.date).map((event) => (
                <li key={event.id}>
                  <EventRow event={event} onOpen={openEvent} />
                </li>
              ))}
            </ul>
            {canCreate && (
              <div className="flex justify-end pt-2">
                <Button size="sm" onClick={() => openCreate(dialog.date)}>
                  <Plus className="h-4 w-4" />
                  Add event this day
                </Button>
              </div>
            )}
          </div>
        )}

        {dialog?.kind === 'event' && !editing && (
          <div className="space-y-4">
            <div className="space-y-2 text-sm">
              <p className="flex items-start gap-2 text-[var(--text-primary)]">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-[var(--text-tertiary)]" />
                {formatEventWhen(dialog.event)}
              </p>
              {dialog.event.location && (
                <p className="flex items-start gap-2 text-[var(--text-primary)]">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[var(--text-tertiary)]" />
                  {dialog.event.location}
                </p>
              )}
              {departmentName(dialog.event.department_id) && (
                <p className="flex items-start gap-2 text-[var(--text-primary)]">
                  <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--text-tertiary)]" />
                  {departmentName(dialog.event.department_id)}
                </p>
              )}
            </div>
            {dialog.event.description && (
              <p className="whitespace-pre-wrap text-sm text-[var(--text-secondary)]">{dialog.event.description}</p>
            )}
            {canManageEvent(dialog.event) && (
              <div className="flex justify-end gap-3 pt-2">
                <Button variant="ghost" onClick={() => setConfirmDelete(true)}>Delete</Button>
                <Button onClick={() => setEditing(true)}>Edit</Button>
              </div>
            )}
          </div>
        )}

        {(dialog?.kind === 'create' || (dialog?.kind === 'event' && editing)) && (
          <form onSubmit={handleSave} className="space-y-4">
            <Input
              id="event-title"
              label="Title"
              value={form.title}
              onChange={(e) => setField('title', e.target.value)}
              placeholder="e.g. District youth conference"
              autoFocus
            />
            <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
              <input
                type="checkbox"
                checked={form.allDay}
                onChange={(e) => setField('allDay', e.target.checked)}
                className="h-4 w-4 accent-[var(--accent-solid)]"
              />
              All day
            </label>
            <div className="grid grid-cols-2 gap-3">
              <Input
                id="event-start-date"
                label="Starts"
                type="date"
                value={form.start_date}
                onChange={(e) => setField('start_date', e.target.value)}
              />
              {!form.allDay && (
                <Input
                  id="event-start-time"
                  label="Start time"
                  type="time"
                  value={form.start_time}
                  onChange={(e) => setField('start_time', e.target.value)}
                />
              )}
              <Input
                id="event-end-date"
                label="Ends"
                type="date"
                min={form.start_date}
                value={form.end_date}
                onChange={(e) => setField('end_date', e.target.value)}
              />
              {!form.allDay && (
                <Input
                  id="event-end-time"
                  label="End time (optional)"
                  type="time"
                  value={form.end_time}
                  onChange={(e) => setField('end_time', e.target.value)}
                />
              )}
            </div>
            <Input
              id="event-location"
              label="Location (optional)"
              value={form.location}
              onChange={(e) => setField('location', e.target.value)}
            />
            {departmentOptions.length > 0 && (
              <Select
                id="event-department"
                label={canManageAll ? 'Department (optional)' : 'Department'}
                value={form.department_id}
                options={departmentOptions}
                placeholder={canManageAll ? 'Whole district' : undefined}
                disabled={!canManageAll}
                onChange={(e) => setField('department_id', e.target.value)}
              />
            )}
            <div className="flex flex-col gap-1">
              <label htmlFor="event-description" className="text-sm font-medium text-[var(--text-secondary)]">
                Notes (optional)
              </label>
              <textarea
                id="event-description"
                rows={3}
                value={form.description}
                onChange={(e) => setField('description', e.target.value)}
                className="w-full rounded-sm border bg-[var(--field-bg)] px-3 py-2 text-sm text-[var(--text-primary)] shadow-[var(--field-shadow)] outline-none [border-color:var(--field-border)] hover:[border-color:var(--field-border-hover)] focus:ring-2 focus:ring-[var(--accent-ring)] focus:[border-color:var(--accent-border)]"
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="ghost"
                disabled={saving}
                onClick={() => (dialog.kind === 'event' ? setEditing(false) : closeDialog())}
              >
                Cancel
              </Button>
              <Button type="submit" loading={saving}>
                {dialog.kind === 'event' ? 'Save changes' : 'Add event'}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => void handleDelete()}
        title="Delete event?"
        message={dialog?.kind === 'event' ? `“${dialog.event.title}” will be removed from the calendar.` : ''}
        loading={saving}
      />
    </div>
  )
}

function EventRow({ event, onOpen }: { event: DistrictEvent; onOpen: (event: DistrictEvent) => void }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(event)}
      className="flex w-full items-start gap-3 px-5 py-3 text-left transition-colors hover:bg-[var(--button-ghost-hover)]"
    >
      <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent-solid)]" />
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-[var(--text-primary)]">{event.title}</span>
        <span className="block text-xs text-[var(--text-tertiary)]">
          {formatEventWhen(event)}
          {event.location ? ` · ${event.location}` : ''}
        </span>
      </span>
    </button>
  )
}
