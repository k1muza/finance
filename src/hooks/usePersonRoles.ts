'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PersonRole, PersonRoleType, PersonRoleEntityType } from '@/types'

export function usePersonRoles() {
  const [data, setData] = useState<PersonRole[]>([])
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const fetch = useCallback(async () => {
    setLoading(true)
    const { data: rows } = await supabase
      .from('person_roles')
      .select('*, person:people(id, name, region_id)')
      .order('created_at')
    setData((rows as PersonRole[]) ?? [])
    setLoading(false)
  }, []) // eslint-disable-line

  const setRole = useCallback(
    async (
      entityType: PersonRoleEntityType,
      entityId: string,
      role: PersonRoleType,
      personId: string | null
    ): Promise<void> => {
      if (personId === null) {
        // Delete the role slot
        await supabase
          .from('person_roles')
          .delete()
          .eq('entity_type', entityType)
          .eq('entity_id', entityId)
          .eq('role', role)
      } else {
        // Upsert — unique constraint on (entity_type, entity_id, role)
        await supabase
          .from('person_roles')
          .upsert(
            { person_id: personId, entity_type: entityType, entity_id: entityId, role },
            { onConflict: 'entity_type,entity_id,role' }
          )
      }
      await fetch()
    },
    [fetch] // eslint-disable-line
  )

  return { data, loading, fetch, setRole }
}
