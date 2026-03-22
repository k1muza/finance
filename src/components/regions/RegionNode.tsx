'use client'

import { useState } from 'react'
import { Region } from '@/types'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { LeadershipForm } from './LeadershipForm'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Pencil, Trash2, MapPin, Users } from 'lucide-react'
import { RegionMembersModal } from './RegionMembersModal'

interface RegionNodeProps {
  region: Region
  onUpdate: (id: string, values: Partial<Region>) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

export function RegionNode({ region, onUpdate, onDelete }: RegionNodeProps) {
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [membersOpen, setMembersOpen] = useState(false)
  const [form, setForm] = useState({
    name: region.name,
    chairperson: region.chairperson,
    vice_chairperson: region.vice_chairperson ?? '',
    secretary: region.secretary ?? '',
    vice_secretary: region.vice_secretary ?? '',
  })
  const [loading, setLoading] = useState(false)

  const set = (field: string, value: string) => setForm((f) => ({ ...f, [field]: value }))

  const openEdit = () => {
    setForm({
      name: region.name,
      chairperson: region.chairperson,
      vice_chairperson: region.vice_chairperson ?? '',
      secretary: region.secretary ?? '',
      vice_secretary: region.vice_secretary ?? '',
    })
    setEditOpen(true)
  }

  const handleEdit = async () => {
    if (!form.name.trim() || !form.chairperson.trim()) return
    setLoading(true)
    try {
      await onUpdate(region.id, {
        name: form.name.trim(),
        chairperson: form.chairperson.trim(),
        vice_chairperson: form.vice_chairperson || null,
        secretary: form.secretary || null,
        vice_secretary: form.vice_secretary || null,
      })
      setEditOpen(false)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-start gap-3 bg-slate-700/40 rounded-lg px-3 py-2.5">
      <MapPin className="h-4 w-4 text-slate-500 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium text-slate-200">{region.name}</span>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-slate-500">
          <span>Chair: <span className="text-slate-400">{region.chairperson}</span></span>
          {region.vice_chairperson && <span>Vice: <span className="text-slate-400">{region.vice_chairperson}</span></span>}
          {region.secretary && <span>Sec: <span className="text-slate-400">{region.secretary}</span></span>}
          {region.vice_secretary && <span>Vice Sec: <span className="text-slate-400">{region.vice_secretary}</span></span>}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Button variant="ghost" size="sm" onClick={() => setMembersOpen(true)}>
          <Users className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="sm" onClick={openEdit}><Pencil className="h-3.5 w-3.5" /></Button>
        <Button variant="ghost" size="sm" onClick={() => setDeleteOpen(true)} className="text-red-400 hover:text-red-300">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      <RegionMembersModal
        open={membersOpen}
        onClose={() => setMembersOpen(false)}
        region={region}
      />

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit Region" size="md">
        <div className="space-y-4">
          <Input label="Region Name *" value={form.name} onChange={(e) => set('name', e.target.value)} />
          <LeadershipForm
            chairperson={form.chairperson}
            vice_chairperson={form.vice_chairperson}
            secretary={form.secretary}
            vice_secretary={form.vice_secretary}
            onChange={set}
          />
          <div className="flex gap-3 pt-2">
            <Button variant="ghost" onClick={() => setEditOpen(false)} className="flex-1">Cancel</Button>
            <Button onClick={handleEdit} loading={loading} className="flex-1">Save</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={async () => { await onDelete(region.id); setDeleteOpen(false) }}
        title="Delete Region"
        message={`Delete region "${region.name}"?`}
      />
    </div>
  )
}
