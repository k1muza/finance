'use client'

import { useState } from 'react'
import { Region, Person, PersonRole, PersonRoleType } from '@/types'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { LeadershipForm } from './LeadershipForm'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Pencil, Trash2, MapPin, Users } from 'lucide-react'
import { RegionMembersModal } from './RegionMembersModal'

interface RegionNodeProps {
  region: Region
  roles: PersonRole[]
  people: Person[]
  onUpdate: (id: string, values: Partial<Region>) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onSetRole: (entityType: 'district' | 'region', entityId: string, role: PersonRoleType, personId: string | null) => Promise<void>
}

type RoleForm = {
  chairperson_id: string | null
  vice_chairperson_id: string | null
  secretary_id: string | null
  vice_secretary_id: string | null
}

function getRegionRoles(roles: PersonRole[], regionId: string): RoleForm {
  const get = (role: PersonRoleType) =>
    roles.find((r) => r.entity_type === 'region' && r.entity_id === regionId && r.role === role)?.person_id ?? null
  return {
    chairperson_id:       get('chairperson'),
    vice_chairperson_id:  get('vice_chairperson'),
    secretary_id:         get('secretary'),
    vice_secretary_id:    get('vice_secretary'),
  }
}

export function RegionNode({ region, roles, people, onUpdate, onDelete, onSetRole }: RegionNodeProps) {
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [membersOpen, setMembersOpen] = useState(false)
  const [name, setName] = useState(region.name)
  const [roleForm, setRoleForm] = useState<RoleForm>({ chairperson_id: null, vice_chairperson_id: null, secretary_id: null, vice_secretary_id: null })
  const [loading, setLoading] = useState(false)

  // People in this region
  const regionPeople = people.filter((p) => p.region_id === region.id)

  const openEdit = () => {
    setName(region.name)
    setRoleForm(getRegionRoles(roles, region.id))
    setEditOpen(true)
  }

  const handleEdit = async () => {
    if (!name.trim()) return
    setLoading(true)
    try {
      await onUpdate(region.id, { name: name.trim() })
      const original = getRegionRoles(roles, region.id)
      const roleKeys: PersonRoleType[] = ['chairperson', 'vice_chairperson', 'secretary', 'vice_secretary']
      for (const role of roleKeys) {
        const key = `${role}_id` as keyof RoleForm
        if (roleForm[key] !== original[key]) {
          await onSetRole('region', region.id, role, roleForm[key])
        }
      }
      setEditOpen(false)
    } finally {
      setLoading(false)
    }
  }

  // Display helpers
  const roleName = (role: PersonRoleType) => {
    const pr = roles.find((r) => r.entity_type === 'region' && r.entity_id === region.id && r.role === role)
    return pr?.person?.name ?? null
  }

  return (
    <div className="flex items-start gap-3 bg-slate-700/40 rounded-lg px-3 py-2.5">
      <MapPin className="h-4 w-4 text-slate-500 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium text-slate-200">{region.name}</span>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-slate-500">
          {roleName('chairperson') && <span>Chair: <span className="text-slate-400">{roleName('chairperson')}</span></span>}
          {roleName('vice_chairperson') && <span>Vice: <span className="text-slate-400">{roleName('vice_chairperson')}</span></span>}
          {roleName('secretary') && <span>Sec: <span className="text-slate-400">{roleName('secretary')}</span></span>}
          {roleName('vice_secretary') && <span>Vice Sec: <span className="text-slate-400">{roleName('vice_secretary')}</span></span>}
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
          <Input label="Region Name *" value={name} onChange={(e) => setName(e.target.value)} />
          <div>
            <p className="text-xs text-slate-500 mb-2">Leadership roles (only members of this region are selectable)</p>
            <LeadershipForm
              chairperson_id={roleForm.chairperson_id}
              vice_chairperson_id={roleForm.vice_chairperson_id}
              secretary_id={roleForm.secretary_id}
              vice_secretary_id={roleForm.vice_secretary_id}
              onChange={(role, id) => setRoleForm((f) => ({ ...f, [`${role}_id`]: id }))}
              people={regionPeople}
            />
          </div>
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
