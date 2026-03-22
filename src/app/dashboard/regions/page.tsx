'use client'

import { useEffect } from 'react'
import { useDistricts } from '@/hooks/useDistricts'
import { useRegions } from '@/hooks/useRegions'
import { usePeople } from '@/hooks/usePeople'
import { usePersonRoles } from '@/hooks/usePersonRoles'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/components/ui/Toast'
import { DistrictNode } from '@/components/regions/DistrictNode'
import { PageSpinner } from '@/components/ui/Spinner'
import { District, PersonRoleType } from '@/types'

export default function RegionsPage() {
  const { districtId, isAdmin } = useAuth()
  const { data: allDistricts, loading: dLoading, create: createDistrict, update: updateDistrict, remove: removeDistrict } = useDistricts()
  const { data: regions, create: createRegion, update: updateRegion, remove: removeRegion } = useRegions()
  const { data: people } = usePeople()
  const { data: roles, fetch: fetchRoles, setRole } = usePersonRoles()
  const toast = useToast()

  useEffect(() => { fetchRoles() }, [fetchRoles])

  const districts = districtId ? allDistricts.filter((d) => d.id === districtId) : allDistricts

  const handleSetRole = async (
    entityType: 'district' | 'region',
    entityId: string,
    role: PersonRoleType,
    personId: string | null
  ) => {
    try {
      await setRole(entityType, entityId, role, personId)
    } catch (e) {
      toast.error(String(e))
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Regions & Districts</h1>
        <p className="text-sm text-slate-400 mt-1">
          {districts.length} district{districts.length !== 1 ? 's' : ''} · {regions.length} region{regions.length !== 1 ? 's' : ''}
        </p>
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
              roles={roles}
              people={people}
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
              onSetRole={handleSetRole}
            />
          ))}
        </div>
      )}
    </div>
  )
}
