'use client'

import { useState, useEffect } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Session } from '@/types'

interface SessionModalProps {
  open: boolean
  onClose: () => void
  onSave: (values: Partial<Session>) => Promise<void>
  initial?: Session | null
  dayId: string
}

export function SessionModal({ open, onClose, onSave, initial, dayId }: SessionModalProps) {
  const [form, setForm] = useState({ name: '', start_time: '09:00', allocated_duration: '60' })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setForm({
      name: initial?.name ?? '',
      start_time: initial?.start_time?.slice(0, 5) ?? '09:00',
      allocated_duration: String(initial?.allocated_duration ?? 60),
    })
  }, [initial, open])

  const handleSubmit = async () => {
    if (!form.name.trim()) return
    setLoading(true)
    try {
      await onSave({
        day_id: dayId,
        name: form.name.trim(),
        start_time: form.start_time,
        allocated_duration: parseInt(form.allocated_duration) || 60,
      })
      onClose()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Edit Session' : 'Add Session'} size="sm">
      <div className="space-y-4">
        <Input label="Session Name *" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Morning Worship" />
        <Input label="Start Time" type="time" value={form.start_time} onChange={(e) => setForm((f) => ({ ...f, start_time: e.target.value }))} />
        <Input label="Duration (minutes)" type="number" min="1" value={form.allocated_duration} onChange={(e) => setForm((f) => ({ ...f, allocated_duration: e.target.value }))} />
        <div className="flex gap-3 pt-2">
          <Button variant="ghost" onClick={onClose} className="flex-1" disabled={loading}>Cancel</Button>
          <Button onClick={handleSubmit} loading={loading} className="flex-1">{initial ? 'Save' : 'Add Session'}</Button>
        </div>
      </div>
    </Modal>
  )
}
