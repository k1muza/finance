'use client'

import { useState } from 'react'
import { District, Region, Person, PersonRole, PersonRoleType } from '@/types'
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
  roles: PersonRole[]
  people: Person[]
  onUpdateDistrict: (id: string, values: Partial<District>) => Promise<void>
  onDeleteDistrict: (id: string) => Promise<void>
  onCreateRegion: (values: Omit<Region, 'id' | 'created_at' | 'updated_at' | 'district'>) => Promise<void>
  onUpdateRegion: (id: string, values: Partial<Region>) => Promise<void>
  onDeleteRegion: (id: string) => Promise<void>
  onSetRole: (entityType: 'district' | 'region', entityId: string, role: PersonRoleType, personId: string | null) => Promise<void>
}

type RoleForm = {
  chairperson_id: string | null
  vice_chairperson_id: string | null
  secretary_id: string | null
  vice_secretary_id: string | null
}

function getDistrictRoles(roles: PersonRole[], districtId: string): RoleForm {
  const get = (role: PersonRoleType) =>
    roles.find((r) => r.entity_type === 'district' && r.entity_id === districtId && r.role === role)?.person_id ?? null
  return {
    chairperson_id:       get('chairperson'),
    vice_chairperson_id:  get('vice_chairperson'),
    secretary_id:         get('secretary'),
    vice_secretary_id:    get('vice_secretary'),
  }
}

export function DistrictNode({
  district,
  regions,
  roles,
  people,
  onUpdateDistrict,
  onDeleteDistrict,
  onCreateRegion,
  onUpdateRegion,
  onDeleteRegion,
  onSetRole,
}: DistrictNodeProps) {
  const [expanded, setExpanded] = useState(true)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [addRegionOpen, setAddRegionOpen] = useState(false)
  const [name, setName] = useState('')
  const [newRegionName, setNewRegionName] = useState('')
  const [roleForm, setRoleForm] = useState<RoleForm>({ chairperson_id: null, vice_chairperson_id: null, secretary_id: null, vice_secretary_id: null })
  const [loading, setLoading] = useState(false)

  // People in this district (via their region's district_id)
  const districtPeople = people.filter((p) => {
    const region = regions.find((r) => r.id === p.region_id)
    return !!region
  })

  const openEdit = () => {
    setName(district.name)
    setRoleForm(getDistrictRoles(roles, district.id))
    setEditOpen(true)
  }

  const openAddRegion = () => {
    setNewRegionName('')
    setAddRegionOpen(true)
  }

  const handleEdit = async () => {
    if (!name.trim()) return
    setLoading(true)
    try {
      await onUpdateDistrict(district.id, { name: name.trim() })
      const original = getDistrictRoles(roles, district.id)
      const roleKeys: PersonRoleType[] = ['chairperson', 'vice_chairperson', 'secretary', 'vice_secretary']
      for (const role of roleKeys) {
        const key = `${role}_id` as keyof RoleForm
        if (roleForm[key] !== original[key]) {
          await onSetRole('district', district.id, role, roleForm[key])
        }
      }
      setEditOpen(false)
    } finally {
      setLoading(false)
    }
  }

  const handleAddRegion = async () => {
    if (!newRegionName.trim()) return
    setLoading(true)
    try {
      await onCreateRegion({ district_id: district.id, name: newRegionName.trim() })
      setAddRegionOpen(false)
    } finally {
      setLoading(false)
    }
  }

  // Display helpers
  const roleName = (role: PersonRoleType) => {
    const pr = roles.find((r) => r.entity_type === 'district' && r.entity_id === district.id && r.role === role)
    return pr?.person?.name ?? null
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
            {roleName('chairperson') && <span>Chair: <span className="text-slate-400">{roleName('chairperson')}</span></span>}
            {roleName('vice_chairperson') && <span>Vice: <span className="text-slate-400">{roleName('vice_chairperson')}</span></span>}
            {roleName('secretary') && <span>Sec: <span className="text-slate-400">{roleName('secretary')}</span></span>}
            {roleName('vice_secretary') && <span>Vice Sec: <span className="text-slate-400">{roleName('vice_secretary')}</span></span>}
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
              roles={roles}
              people={people}
              onUpdate={onUpdateRegion}
              onDelete={onDeleteRegion}
              onSetRole={onSetRole}
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
          <Input label="District Name *" value={name} onChange={(e) => setName(e.target.value)} />
          <div>
            <p className="text-xs text-slate-500 mb-2">Leadership roles (only people in this district are selectable)</p>
            <LeadershipForm
              chairperson_id={roleForm.chairperson_id}
              vice_chairperson_id={roleForm.vice_chairperson_id}
              secretary_id={roleForm.secretary_id}
              vice_secretary_id={roleForm.vice_secretary_id}
              onChange={(role, id) => setRoleForm((f) => ({ ...f, [`${role}_id`]: id }))}
              people={districtPeople}
            />
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="ghost" onClick={() => setEditOpen(false)} className="flex-1">Cancel</Button>
            <Button onClick={handleEdit} loading={loading} className="flex-1">Save</Button>
          </div>
        </div>
      </Modal>

      {/* Add region modal */}
      <Modal open={addRegionOpen} onClose={() => setAddRegionOpen(false)} title="Add Region" size="sm">
        <div className="space-y-4">
          <Input label="Region Name *" value={newRegionName} onChange={(e) => setNewRegionName(e.target.value)} />
          <p className="text-xs text-slate-500">Leadership roles can be assigned after the region is created.</p>
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
