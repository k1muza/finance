'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { MealMenuItem } from '@/types'

export function useMealMenu(mealId: string | null) {
  const [data, setData] = useState<MealMenuItem[]>([])
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const fetch = useCallback(async () => {
    if (!mealId) { setData([]); return }
    setLoading(true)
    const { data: rows } = await supabase
      .from('meal_menu_items')
      .select('*')
      .eq('meal_id', mealId)
      .order('sort_order')
    setData(rows ?? [])
    setLoading(false)
  }, [mealId]) // eslint-disable-line

  useEffect(() => { fetch() }, [fetch])

  const add = async (name: string, notes: string | null) => {
    const sort_order = data.length
    const { error } = await supabase
      .from('meal_menu_items')
      .insert({ meal_id: mealId, name, notes, sort_order })
    if (error) throw new Error(error.message)
    await fetch()
  }

  const update = async (id: string, name: string, notes: string | null) => {
    const { error } = await supabase
      .from('meal_menu_items')
      .update({ name, notes })
      .eq('id', id)
    if (error) throw new Error(error.message)
    await fetch()
  }

  const remove = async (id: string) => {
    const { error } = await supabase
      .from('meal_menu_items')
      .delete()
      .eq('id', id)
    if (error) throw new Error(error.message)
    await fetch()
  }

  return { data, loading, add, update, remove, refresh: fetch }
}
