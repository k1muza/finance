'use client'

import { useState, useEffect } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { Event, Person } from '@/types'

interface EventModalProps {
  open: boolean
  onClose: () => void
  onSave: (values: Partial<Event>) => Promise<void>
  initial?: Event | null
  sessionId: string
  people: Person[]
}

export function EventModal({ open, onClose, onSave, initial, sessionId, people }: EventModalProps) {
  const [form, setForm] = useState({ title: '', allocated_person: '', start_time: '09:00', duration: '30' })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setForm({
      title: initial?.title ?? '',
      allocated_person: initial?.allocated_person ?? '',
      start_time: initial?.start_time?.slice(0, 5) ?? '09:00',
      duration: String(initial?.duration ?? 30),
    })
  }, [initial, open])

  const handleSubmit = async () => {
    if (!form.title.trim()) return
    setLoading(true)
    try {
      await onSave({
        session_id: sessionId,
        title: form.title.trim(),
        allocated_person: form.allocated_person || null,
        start_time: form.start_time,
        duration: parseInt(form.duration) || 30,
      })
      onClose()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Edit Event' : 'Add Event'} size="sm">
      <div className="space-y-4">
        <Input label="Event Title *" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Welcome Address" />
        <Select
          label="Allocated Person"
          value={form.allocated_person}
          onChange={(e) => setForm((f) => ({ ...f, allocated_person: e.target.value }))}
          placeholder="Select person"
          options={people.map((p) => ({ value: p.id, label: p.name }))}
        />
        <Input label="Start Time" type="time" value={form.start_time} onChange={(e) => setForm((f) => ({ ...f, start_time: e.target.value }))} />
        <Input label="Duration (minutes)" type="number" min="1" value={form.duration} onChange={(e) => setForm((f) => ({ ...f, duration: e.target.value }))} />
        <div className="flex gap-3 pt-2">
          <Button variant="ghost" onClick={onClose} className="flex-1" disabled={loading}>Cancel</Button>
          <Button onClick={handleSubmit} loading={loading} className="flex-1">{initial ? 'Save' : 'Add Event'}</Button>
        </div>
      </div>
    </Modal>
  )
}
