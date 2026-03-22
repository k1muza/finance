'use client'

import { useState } from 'react'
import { Session, Event, Meal, Person } from '@/types'
import { useSessions } from '@/hooks/useSessions'
import { useEvents } from '@/hooks/useEvents'
import { useMeals } from '@/hooks/useMeals'
import { SessionModal } from './SessionModal'
import { EventModal } from './EventModal'
import { EventMediaModal } from './EventMediaModal'
import { MealModal } from './MealModal'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useToast } from '@/components/ui/Toast'
import { formatTime, formatDuration } from '@/lib/utils/formatTime'
import { Plus, Pencil, Trash2, Utensils, Calendar, Film } from 'lucide-react'
import { PageSpinner } from '@/components/ui/Spinner'

interface TimelineProps {
  dayId: string
  people: Person[]
}

// Unified timeline item
type TimelineItem =
  | { type: 'session'; time: string; session: Session }
  | { type: 'meal'; time: string; meal: Meal }

function SessionBlock({
  session,
  people,
  onEditSession,
  onDeleteSession,
}: {
  session: Session
  people: Person[]
  onEditSession: (s: Session) => void
  onDeleteSession: (s: Session) => void
}) {
  const { data: events, create, update, remove } = useEvents(session.id)
  const [addEventOpen, setAddEventOpen] = useState(false)
  const [editEvent, setEditEvent] = useState<Event | null>(null)
  const [deleteEvent, setDeleteEvent] = useState<Event | null>(null)
  const [mediaEvent, setMediaEvent] = useState<Event | null>(null)
  const toast = useToast()

  const handleSaveEvent = async (values: Parameters<typeof create>[0]) => {
    try {
      if (editEvent) { await update(editEvent.id, values); toast.success('Event updated') }
      else { await create(values); toast.success('Event added') }
    } catch (e) { toast.error(String(e)); throw e }
  }

  return (
    <div className="border border-slate-700 rounded-lg overflow-hidden">
      {/* Session header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-slate-800">
        <Calendar className="h-4 w-4 text-cyan-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="font-medium text-slate-100">{session.name}</span>
          <span className="ml-2 text-xs text-slate-500">
            {formatTime(session.start_time)} · {formatDuration(session.allocated_duration)}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => onEditSession(session)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onDeleteSession(session)} className="text-red-400 hover:text-red-300">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Events */}
      <div className="border-t border-slate-700/50 px-4 py-2 space-y-1 bg-slate-800/50">
        {events.map((evt) => (
          <div key={evt.id} className="flex items-center gap-3 py-1.5 px-3 rounded-md hover:bg-slate-700/40 transition group">
            <div className="w-16 text-xs text-slate-500 shrink-0">{formatTime(evt.start_time)}</div>
            <div className="flex-1 min-w-0">
              <span className="text-sm text-slate-200">{evt.title}</span>
              {evt.people && evt.people.length > 0 && (
                <span className="ml-2 text-xs text-cyan-500">{evt.people.map((p) => p.name).join(', ')}</span>
              )}
            </div>
            <span className="text-xs text-slate-500">{formatDuration(evt.duration)}</span>
            <div className="hidden group-hover:flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={() => setMediaEvent(evt)} title="Manage media">
                <Film className="h-3 w-3 text-cyan-500" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setEditEvent(evt)}>
                <Pencil className="h-3 w-3" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setDeleteEvent(evt)} className="text-red-400">
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ))}
        <Button variant="ghost" size="sm" onClick={() => setAddEventOpen(true)} className="mt-1">
          <Plus className="h-3.5 w-3.5" /> Add Event
        </Button>
      </div>

      <EventModal
        open={addEventOpen || !!editEvent}
        onClose={() => { setAddEventOpen(false); setEditEvent(null) }}
        onSave={handleSaveEvent}
        initial={editEvent}
        sessionId={session.id}
        people={people}
      />

      <ConfirmDialog
        open={!!deleteEvent}
        onClose={() => setDeleteEvent(null)}
        onConfirm={async () => {
          if (!deleteEvent) return
          try { await remove(deleteEvent.id); toast.success('Event deleted') }
          catch (e) { toast.error(String(e)) }
          setDeleteEvent(null)
        }}
        title="Delete Event"
        message={`Delete "${deleteEvent?.title}"?`}
      />

      {mediaEvent && (
        <EventMediaModal
          open={!!mediaEvent}
          onClose={() => setMediaEvent(null)}
          event={mediaEvent}
        />
      )}
    </div>
  )
}

export function Timeline({ dayId, people }: TimelineProps) {
  const { data: sessions, loading: sLoading, create: createSession, update: updateSession, remove: removeSession } = useSessions(dayId)
  const { data: meals, create: createMeal, update: updateMeal, remove: removeMeal } = useMeals(dayId)
  const [sessionModal, setSessionModal] = useState<{ open: boolean; session: Session | null }>({ open: false, session: null })
  const [mealModal, setMealModal] = useState<{ open: boolean; meal: Meal | null }>({ open: false, meal: null })
  const [deleteSession, setDeleteSession] = useState<Session | null>(null)
  const [deleteMeal, setDeleteMeal] = useState<Meal | null>(null)
  const toast = useToast()

  if (sLoading) return <PageSpinner />

  // Build sorted timeline
  const items: TimelineItem[] = [
    ...sessions.map((s): TimelineItem => ({ type: 'session', time: s.start_time, session: s })),
    ...meals.map((m): TimelineItem => ({ type: 'meal', time: m.scheduled_time, meal: m })),
  ].sort((a, b) => a.time.localeCompare(b.time))

  const handleSaveSession = async (values: Partial<Session>) => {
    try {
      if (sessionModal.session) { await updateSession(sessionModal.session.id, values); toast.success('Session updated') }
      else { await createSession(values as Parameters<typeof createSession>[0]); toast.success('Session added') }
    } catch (e) { toast.error(String(e)); throw e }
  }

  const handleSaveMeal = async (values: Partial<Meal>) => {
    try {
      if (mealModal.meal) { await updateMeal(mealModal.meal.id, values); toast.success('Meal updated') }
      else { await createMeal(values as Parameters<typeof createMeal>[0]); toast.success('Meal added') }
    } catch (e) { toast.error(String(e)); throw e }
  }

  return (
    <div className="space-y-3">
      {items.length === 0 && (
        <div className="bg-slate-800 rounded-xl border border-slate-700 border-dashed p-10 text-center">
          <p className="text-slate-500">No sessions or meals yet. Add one below.</p>
        </div>
      )}

      {items.map((item, i) => (
        <div key={i} className="flex gap-3">
          <div className="w-1 bg-slate-700 rounded-full shrink-0 mt-3 mb-0" />
          <div className="flex-1">
            {item.type === 'session' ? (
              <SessionBlock
                session={item.session}
                people={people}
                onEditSession={(s) => setSessionModal({ open: true, session: s })}
                onDeleteSession={(s) => setDeleteSession(s)}
              />
            ) : (
              <div className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-2.5 group">
                <Utensils className="h-4 w-4 text-amber-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-amber-300">{item.meal.name}</span>
                  <span className="ml-2 text-xs text-amber-500/70">
                    {formatTime(item.meal.scheduled_time)} · {formatDuration(item.meal.duration)}
                  </span>
                </div>
                <div className="hidden group-hover:flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => setMealModal({ open: true, meal: item.meal })}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setDeleteMeal(item.meal)} className="text-red-400">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      ))}

      {/* Add buttons */}
      <div className="flex gap-3 pt-2">
        <Button variant="secondary" onClick={() => setSessionModal({ open: true, session: null })}>
          <Plus className="h-4 w-4" /> Add Session
        </Button>
        <Button variant="ghost" onClick={() => setMealModal({ open: true, meal: null })}>
          <Utensils className="h-4 w-4" /> Add Meal
        </Button>
      </div>

      <SessionModal
        open={sessionModal.open}
        onClose={() => setSessionModal({ open: false, session: null })}
        onSave={handleSaveSession}
        initial={sessionModal.session}
        dayId={dayId}
      />

      <MealModal
        open={mealModal.open}
        onClose={() => setMealModal({ open: false, meal: null })}
        onSave={handleSaveMeal}
        initial={mealModal.meal}
        dayId={dayId}
      />

      <ConfirmDialog
        open={!!deleteSession}
        onClose={() => setDeleteSession(null)}
        onConfirm={async () => {
          if (!deleteSession) return
          try { await removeSession(deleteSession.id); toast.success('Session deleted') }
          catch (e) { toast.error(String(e)) }
          setDeleteSession(null)
        }}
        title="Delete Session"
        message={`Delete "${deleteSession?.name}" and all its events?`}
      />

      <ConfirmDialog
        open={!!deleteMeal}
        onClose={() => setDeleteMeal(null)}
        onConfirm={async () => {
          if (!deleteMeal) return
          try { await removeMeal(deleteMeal.id); toast.success('Meal deleted') }
          catch (e) { toast.error(String(e)) }
          setDeleteMeal(null)
        }}
        title="Delete Meal"
        message={`Delete meal "${deleteMeal?.name}"?`}
      />
    </div>
  )
}
