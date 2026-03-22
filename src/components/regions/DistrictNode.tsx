'use client'

import { useState } from 'react'
import { District, Region } from '@/types'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { LeadershipForm } from './LeadershipForm'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { RegionNode } from './RegionNode'
import { ChevronDown, ChevronRight, Pencil, Trash2, Plus, MapPin } from 'lucide-react'

interface DistrictNodeProps {
  district: District
  regions: Region[]
  onUpdateDistrict: (id: string, values: Partial<District>) => Promise<void>
  onDeleteDistrict: (id: string) => Promise<void>
  onCreateRegion: (values: Omit<Region, 'id' | 'created_at' | 'updated_at' | 'district'>) => Promise<void>
  onUpdateRegion: (id: string, values: Partial<Region>) => Promise<void>
  onDeleteRegion: (id: string) => Promise<void>
}

type EditForm = {
  name: string; chairperson: string; vice_chairperson: string; secretary: string; vice_secretary: string
}

const emptyForm: EditForm = { name: '', chairperson: '', vice_chairperson: '', secretary: '', vice_secretary: '' }

export function DistrictNode({ district, regions, onUpdateDistrict, onDeleteDistrict, onCreateRegion, onUpdateRegion, onDeleteRegion }: DistrictNodeProps) {
  const [expanded, setExpanded] = useState(true)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [addRegionOpen, setAddRegionOpen] = useState(false)
  const [form, setForm] = useState<EditForm>(emptyForm)
  const [loading, setLoading] = useState(false)

  const openEdit = () => {
    setForm({
      name: district.name,
      chairperson: district.chairperson,
      vice_chairperson: district.vice_chairperson ?? '',
      secretary: district.secretary ?? '',
      vice_secretary: district.vice_secretary ?? '',
    })
    setEditOpen(true)
  }

  const openAddRegion = () => {
    setForm(emptyForm)
    setAddRegionOpen(true)
  }

  const set = (field: string, value: string) => setForm((f) => ({ ...f, [field]: value }))

  const handleEdit = async () => {
    if (!form.name.trim() || !form.chairperson.trim()) return
    setLoading(true)
    try {
      await onUpdateDistrict(district.id, {
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

  const handleAddRegion = async () => {
    if (!form.name.trim() || !form.chairperson.trim()) return
    setLoading(true)
    try {
      await onCreateRegion({
        district_id: district.id,
        name: form.name.trim(),
        chairperson: form.chairperson.trim(),
        vice_chairperson: form.vice_chairperson || null,
        secretary: form.secretary || null,
        vice_secretary: form.vice_secretary || null,
      })
      setAddRegionOpen(false)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
      {/* District header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-slate-800">
        <button onClick={() => setExpanded(!expanded)} className="text-slate-400 hover:text-slate-100">
          {expanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-slate-100">{district.name}</h3>
            <span className="text-xs bg-cyan-500/10 text-cyan-400 px-2 py-0.5 rounded-full">District</span>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-xs text-slate-500">
            <span>Chair: <span className="text-slate-400">{district.chairperson}</span></span>
            {district.vice_chairperson && <span>Vice: <span className="text-slate-400">{district.vice_chairperson}</span></span>}
            {district.secretary && <span>Sec: <span className="text-slate-400">{district.secretary}</span></span>}
            {district.vice_secretary && <span>Vice Sec: <span className="text-slate-400">{district.vice_secretary}</span></span>}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={openEdit}><Pencil className="h-4 w-4" /></Button>
          <Button variant="ghost" size="sm" onClick={() => setDeleteOpen(true)} className="text-red-400 hover:text-red-300">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Regions */}
      {expanded && (
        <div className="border-t border-slate-700 px-4 py-3 space-y-2">
          {regions.length === 0 && (
            <p className="text-slate-500 text-sm py-2">No regions yet</p>
          )}
          {regions.map((region) => (
            <RegionNode
              key={region.id}
              region={region}
              onUpdate={onUpdateRegion}
              onDelete={onDeleteRegion}
            />
          ))}
          <Button variant="ghost" size="sm" onClick={openAddRegion} className="mt-2">
            <Plus className="h-4 w-4" />
            <MapPin className="h-4 w-4" />
            Add Region
          </Button>
        </div>
      )}

      {/* Edit district modal */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit District" size="md">
        <div className="space-y-4">
          <Input label="District Name *" value={form.name} onChange={(e) => set('name', e.target.value)} />
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

      {/* Add region modal */}
      <Modal open={addRegionOpen} onClose={() => setAddRegionOpen(false)} title="Add Region" size="md">
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
            <Button variant="ghost" onClick={() => setAddRegionOpen(false)} className="flex-1">Cancel</Button>
            <Button onClick={handleAddRegion} loading={loading} className="flex-1">Add Region</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={async () => { await onDeleteDistrict(district.id); setDeleteOpen(false) }}
        title="Delete District"
        message={`Delete "${district.name}" and all its regions?`}
      />
    </div>
  )
}
