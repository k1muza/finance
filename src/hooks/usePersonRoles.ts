'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PersonRole, PersonRoleType } from '@/types'

export function usePersonRoles() {
  const [data, setData] = useState<PersonRole[]>([])
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const fetch = useCallback(async () => {
    setLoading(true)
    const [{ data: districtRows }, { data: regionRows }] = await Promise.all([
      supabase.from('district_roles').select('*, person:people(id, name, region_id)').order('created_at'),
      supabase.from('region_roles').select('*, person:people(id, name, region_id)').order('created_at'),
    ])

    const districtRoles: PersonRole[] = (districtRows ?? []).map((r) => ({
      id: r.id,
      person_id: r.person_id,
      entity_type: 'district' as const,
      entity_id: r.district_id,
      role: r.role as PersonRoleType,
      created_at: r.created_at,
      person: r.person as PersonRole['person'],
    }))

    const regionRoles: PersonRole[] = (regionRows ?? []).map((r) => ({
      id: r.id,
      person_id: r.person_id,
      entity_type: 'region' as const,
      entity_id: r.region_id,
      role: r.role as PersonRoleType,
      created_at: r.created_at,
      person: r.person as PersonRole['person'],
    }))

    setData([...districtRoles, ...regionRoles])
    setLoading(false)
  }, []) // eslint-disable-line

  const setRole = useCallback(
    async (
      entityType: 'district' | 'region',
      entityId: string,
      role: PersonRoleType,
      personId: string | null
    ): Promise<void> => {
      if (entityType === 'district') {
        if (personId === null) {
          await supabase.from('district_roles').delete().eq('district_id', entityId).eq('role', role)
        } else {
          await supabase
            .from('district_roles')
            .upsert({ person_id: personId, district_id: entityId, role }, { onConflict: 'district_id,role' })
        }
      } else {
        if (personId === null) {
          await supabase.from('region_roles').delete().eq('region_id', entityId).eq('role', role)
        } else {
          await supabase
            .from('region_roles')
            .upsert({ person_id: personId, region_id: entityId, role }, { onConflict: 'region_id,role' })
        }
      }
      await fetch()
    },
    [fetch] // eslint-disable-line
  )

  return { data, loading, fetch, setRole }
}
