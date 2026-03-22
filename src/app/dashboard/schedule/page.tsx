'use client'

import { useState, useEffect } from 'react'
import { useDays } from '@/hooks/useDays'
import { usePeople } from '@/hooks/usePeople'
import { useToast } from '@/components/ui/Toast'
import { DayTabs } from '@/components/schedule/DayTabs'
import { Timeline } from '@/components/schedule/Timeline'
import { PageSpinner } from '@/components/ui/Spinner'

export default function SchedulePage() {
  const { data: days, loading, create, remove } = useDays()
  const { data: people } = usePeople()
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null)
  const toast = useToast()

  // Auto-select first day
  useEffect(() => {
    if (days.length > 0 && !selectedDayId) {
      setSelectedDayId(days[0].id)
    }
  }, [days, selectedDayId])

  const handleCreateDay = async (values: { date: string; label: string | null }) => {
    try {
      await create(values)
      toast.success('Day added')
    } catch (e) {
      toast.error(String(e))
      throw e
    }
  }

  const handleDeleteDay = async (id: string) => {
    try {
      await remove(id)
      if (selectedDayId === id) setSelectedDayId(days.find((d) => d.id !== id)?.id ?? null)
      toast.success('Day deleted')
    } catch (e) {
      toast.error(String(e))
      throw e
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Schedule</h1>
        <p className="text-sm text-slate-400 mt-1">Manage days, sessions, events, and meals</p>
      </div>

      {loading ? (
        <PageSpinner />
      ) : (
        <>
          <DayTabs
            days={days}
            selectedId={selectedDayId}
            onSelect={setSelectedDayId}
            onCreate={handleCreateDay}
            onDelete={handleDeleteDay}
          />

          {days.length === 0 ? (
            <div className="bg-slate-800 rounded-xl border border-slate-700 border-dashed p-12 text-center">
              <p className="text-slate-500">No conference days yet. Add your first day above.</p>
            </div>
          ) : selectedDayId ? (
            <Timeline dayId={selectedDayId} people={people} />
          ) : null}
        </>
      )}
    </div>
  )
}
