'use client'

import { useState, useEffect } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Session, Person } from '@/types'
import { X } from 'lucide-react'

type SaveValues = {
  day_id: string
  name: string
  start_time: string
  allocated_duration: number
  mc_ids: string[]
  manager_ids: string[]
}

interface SessionModalProps {
  open: boolean
  onClose: () => void
  onSave: (values: SaveValues) => Promise<void>
  initial?: Session | null
  dayId: string
  people: Person[]
}

function PeoplePicker({
  label,
  selected,
  all,
  onChange,
}: {
  label: string
  selected: Person[]
  all: Person[]
  onChange: (ids: string[]) => void
}) {
  const [search, setSearch] = useState('')
  const selectedIds = selected.map((p) => p.id)

  const toggle = (id: string) =>
    onChange(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id])

  const available = all.filter(
    (p) => !selectedIds.includes(p.id) && p.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-slate-300">{label}</label>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-1">
          {selected.map((p) => (
            <span key={p.id} className="flex items-center gap-1 text-xs bg-cyan-500/10 text-cyan-400 px-2 py-1 rounded-full">
              {p.name}
              <button type="button" onClick={() => toggle(p.id)}>
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
        <div className="border border-slate-700 rounded-lg overflow-hidden max-h-32 overflow-y-auto">
          {available.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => { toggle(p.id); setSearch('') }}
              className="w-full text-left px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 transition"
            >
              {p.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function SessionModal({ open, onClose, onSave, initial, dayId, people }: SessionModalProps) {
  const [form, setForm] = useState({ name: '', start_time: '09:00', allocated_duration: '60' })
  const [mcIds, setMcIds] = useState<string[]>([])
  const [managerIds, setManagerIds] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setForm({
      name: initial?.name ?? '',
      start_time: initial?.start_time?.slice(0, 5) ?? '09:00',
      allocated_duration: String(initial?.allocated_duration ?? 60),
    })
    setMcIds(initial?.mcs?.map((p) => p.id) ?? [])
    setManagerIds(initial?.managers?.map((p) => p.id) ?? [])
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
        mc_ids: mcIds,
        manager_ids: managerIds,
      })
      onClose()
    } finally {
      setLoading(false)
    }
  }

  const selectedMcs = people.filter((p) => mcIds.includes(p.id))
  const selectedManagers = people.filter((p) => managerIds.includes(p.id))

  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Edit Session' : 'Add Session'} size="sm">
      <div className="space-y-4">
        <Input label="Session Name *" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Morning Worship" />
        <Input label="Start Time" type="time" value={form.start_time} onChange={(e) => setForm((f) => ({ ...f, start_time: e.target.value }))} />
        <Input label="Duration (minutes)" type="number" min="1" value={form.allocated_duration} onChange={(e) => setForm((f) => ({ ...f, allocated_duration: e.target.value }))} />

        <PeoplePicker
          label="MCs"
          selected={selectedMcs}
          all={people}
          onChange={setMcIds}
        />
        <PeoplePicker
          label="Managers"
          selected={selectedManagers}
          all={people}
          onChange={setManagerIds}
        />

        <div className="flex gap-3 pt-2">
          <Button variant="ghost" onClick={onClose} className="flex-1" disabled={loading}>Cancel</Button>
          <Button onClick={handleSubmit} loading={loading} className="flex-1">{initial ? 'Save' : 'Add Session'}</Button>
        </div>
      </div>
    </Modal>
  )
}
