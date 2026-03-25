'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { DepartmentPhoto } from '@/types'

export function useDepartmentPhotos(departmentId: string | null, districtId: string | null) {
  const [data, setData] = useState<DepartmentPhoto[]>([])
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const fetch = useCallback(async () => {
    if (!departmentId || !districtId) { setData([]); return }
    setLoading(true)
    const { data: rows } = await supabase
      .from('department_photos')
      .select('*')
      .eq('department_id', departmentId)
      .eq('district_id', districtId)
      .order('sort_order')
      .order('created_at')
    setData(rows ?? [])
    setLoading(false)
  }, [departmentId, districtId]) // eslint-disable-line

  useEffect(() => { fetch() }, [fetch])

  const add = async (values: { url: string; caption?: string | null; taken_at?: string | null }) => {
    if (!departmentId || !districtId) return
    const { error } = await supabase.from('department_photos').insert({
      department_id: departmentId,
      district_id: districtId,
      url: values.url,
      caption: values.caption ?? null,
      taken_at: values.taken_at ?? null,
      sort_order: data.length,
    })
    if (error) throw new Error(error.message)
    await fetch()
  }

  const update = async (id: string, values: { url?: string; caption?: string | null; taken_at?: string | null }) => {
    const { error } = await supabase.from('department_photos').update(values).eq('id', id)
    if (error) throw new Error(error.message)
    await fetch()
  }

  const remove = async (id: string) => {
    const { error } = await supabase.from('department_photos').delete().eq('id', id)
    if (error) throw new Error(error.message)
    await fetch()
  }

  return { data, loading, add, update, remove, refresh: fetch }
}
