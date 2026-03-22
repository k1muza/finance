'use client'

import { useState } from 'react'
import { useDistricts } from '@/hooks/useDistricts'
import { useRegions } from '@/hooks/useRegions'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/components/ui/Toast'
import { DistrictNode } from '@/components/regions/DistrictNode'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { LeadershipForm } from '@/components/regions/LeadershipForm'
import { Button } from '@/components/ui/Button'
import { PageSpinner } from '@/components/ui/Spinner'
import { District } from '@/types'
import { Plus } from 'lucide-react'

export default function RegionsPage() {
  const { districtId, isAdmin } = useAuth()
  const { data: allDistricts, loading: dLoading, create: createDistrict, update: updateDistrict, remove: removeDistrict } = useDistricts()
  const { data: regions, create: createRegion, update: updateRegion, remove: removeRegion } = useRegions()

  // District users only see their own district
  const districts = isAdmin ? allDistricts : allDistricts.filter((d) => d.id === districtId)
  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState({ name: '', chairperson: '', vice_chairperson: '', secretary: '', vice_secretary: '' })
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  const set = (field: string, value: string) => setForm((f) => ({ ...f, [field]: value }))

  const handleAddDistrict = async () => {
    if (!form.name.trim() || !form.chairperson.trim()) return
    setSaving(true)
    try {
      await createDistrict({
        name: form.name.trim(),
        chairperson: form.chairperson.trim(),
        vice_chairperson: form.vice_chairperson || null,
        secretary: form.secretary || null,
        vice_secretary: form.vice_secretary || null,
      })
      toast.success('District created')
      setAddOpen(false)
      setForm({ name: '', chairperson: '', vice_chairperson: '', secretary: '', vice_secretary: '' })
    } catch (e) {
      toast.error(String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Regions & Districts</h1>
          <p className="text-sm text-slate-400 mt-1">
            {districts.length} district{districts.length !== 1 ? 's' : ''} · {regions.length} region{regions.length !== 1 ? 's' : ''}
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" /> New District
          </Button>
        )}
      </div>

      {dLoading ? (
        <PageSpinner />
      ) : districts.length === 0 ? (
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-12 text-center">
          <p className="text-slate-500">No districts yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {districts.map((d) => (
            <DistrictNode
              key={d.id}
              district={d}
              regions={regions.filter((r) => r.district_id === d.id)}
              onUpdateDistrict={async (id, values) => {
                try { await updateDistrict(id, values as Partial<District>); toast.success('District updated') }
                catch (e) { toast.error(String(e)) }
              }}
              onDeleteDistrict={async (id) => {
                try { await removeDistrict(id); toast.success('District deleted') }
                catch (e) { toast.error(String(e)) }
              }}
              onCreateRegion={async (values) => {
                try { await createRegion(values); toast.success('Region added') }
                catch (e) { toast.error(String(e)) }
              }}
              onUpdateRegion={async (id, values) => {
                try { await updateRegion(id, values); toast.success('Region updated') }
                catch (e) { toast.error(String(e)) }
              }}
              onDeleteRegion={async (id) => {
                try { await removeRegion(id); toast.success('Region deleted') }
                catch (e) { toast.error(String(e)) }
              }}
            />
          ))}
        </div>
      )}

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="New District" size="md">
        <div className="space-y-4">
          <Input label="District Name *" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Northern District" />
          <LeadershipForm
            chairperson={form.chairperson}
            vice_chairperson={form.vice_chairperson}
            secretary={form.secretary}
            vice_secretary={form.vice_secretary}
            onChange={set}
          />
          <div className="flex gap-3 pt-2">
            <Button variant="ghost" onClick={() => setAddOpen(false)} className="flex-1">Cancel</Button>
            <Button onClick={handleAddDistrict} loading={saving} className="flex-1">Create District</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
