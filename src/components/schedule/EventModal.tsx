'use client'

import { useState, useEffect } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Event, Person } from '@/types'
import { X } from 'lucide-react'

interface EventModalProps {
  open: boolean
  onClose: () => void
  onSave: (values: { session_id: string; title: string; start_time: string; duration: number; person_ids: string[] }) => Promise<void>
  initial?: Event | null
  sessionId: string
  people: Person[]
}

export function EventModal({ open, onClose, onSave, initial, sessionId, people }: EventModalProps) {
  const [title, setTitle] = useState('')
  const [startTime, setStartTime] = useState('09:00')
  const [duration, setDuration] = useState('30')
  const [personIds, setPersonIds] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setTitle(initial?.title ?? '')
    setStartTime(initial?.start_time?.slice(0, 5) ?? '09:00')
    setDuration(String(initial?.duration ?? 30))
    setPersonIds(initial?.people?.map((p) => p.id) ?? [])
    setSearch('')
  }, [initial, open])

  const togglePerson = (id: string) =>
    setPersonIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])

  const selected = people.filter((p) => personIds.includes(p.id))
  const available = people.filter(
    (p) => !personIds.includes(p.id) && p.name.toLowerCase().includes(search.toLowerCase())
  )

  const handleSubmit = async () => {
    if (!title.trim()) return
    setLoading(true)
    try {
      await onSave({
        session_id: sessionId,
        title: title.trim(),
        start_time: startTime,
        duration: parseInt(duration) || 30,
        person_ids: personIds,
      })
      onClose()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Edit Event' : 'Add Event'} size="sm">
      <div className="space-y-4">
        <Input
          label="Event Title *"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Welcome Address"
        />

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-300">People</label>
          {selected.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-1">
              {selected.map((p) => (
                <span key={p.id} className="flex items-center gap-1 text-xs bg-cyan-500/10 text-cyan-400 px-2 py-1 rounded-full">
                  {p.name}
                  <button type="button" onClick={() => togglePerson(p.id)}>
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <input
            type="text"
            placeholder="Search to add…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />
          {search && available.length > 0 && (
            <div className="border border-slate-700 rounded-lg overflow-hidden max-h-36 overflow-y-auto">
              {available.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => { togglePerson(p.id); setSearch('') }}
                  className="w-full text-left px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 transition"
                >
                  {p.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <Input
          label="Start Time"
          type="time"
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
        />
        <Input
          label="Duration (minutes)"
          type="number"
          min="1"
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
        />
        <div className="flex gap-3 pt-2">
          <Button variant="ghost" onClick={onClose} className="flex-1" disabled={loading}>Cancel</Button>
          <Button onClick={handleSubmit} loading={loading} className="flex-1">
            {initial ? 'Save' : 'Add Event'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
