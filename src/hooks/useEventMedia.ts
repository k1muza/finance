'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { EventVideo, EventCommentary, EventPhoto } from '@/types'

export function useEventMedia(eventId: string | null) {
  const [videos, setVideos] = useState<EventVideo[]>([])
  const [commentaries, setCommentaries] = useState<EventCommentary[]>([])
  const [photos, setPhotos] = useState<EventPhoto[]>([])
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const fetch = useCallback(async () => {
    if (!eventId) { setVideos([]); setCommentaries([]); setPhotos([]); return }
    setLoading(true)
    const [vRes, cRes, pRes] = await Promise.all([
      supabase.from('event_videos').select('*').eq('event_id', eventId).order('created_at'),
      supabase.from('event_commentaries').select('*, speaker:people(id,name)').eq('event_id', eventId).order('created_at'),
      supabase.from('event_photos').select('*').eq('event_id', eventId).order('created_at'),
    ])
    setVideos(vRes.data ?? [])
    setCommentaries(cRes.data ?? [])
    setPhotos(pRes.data ?? [])
    setLoading(false)
  }, [eventId]) // eslint-disable-line

  useEffect(() => { fetch() }, [fetch])

  // ── Videos ──────────────────────────────────────────────────
  const addVideo = async (values: Omit<EventVideo, 'id' | 'created_at' | 'updated_at'>) => {
    const { error } = await supabase.from('event_videos').insert(values)
    if (error) throw new Error(error.message)
    await fetch()
  }

  const updateVideo = async (id: string, values: Partial<Omit<EventVideo, 'id' | 'created_at' | 'updated_at'>>) => {
    const { error } = await supabase.from('event_videos').update(values).eq('id', id)
    if (error) throw new Error(error.message)
    await fetch()
  }

  const removeVideo = async (id: string) => {
    const { error } = await supabase.from('event_videos').delete().eq('id', id)
    if (error) throw new Error(error.message)
    await fetch()
  }

  // ── Commentaries ─────────────────────────────────────────────
  const addCommentary = async (values: Omit<EventCommentary, 'id' | 'created_at' | 'updated_at' | 'speaker'>) => {
    const { error } = await supabase.from('event_commentaries').insert(values)
    if (error) throw new Error(error.message)
    await fetch()
  }

  const updateCommentary = async (id: string, values: Partial<Omit<EventCommentary, 'id' | 'created_at' | 'updated_at' | 'speaker'>>) => {
    const { error } = await supabase.from('event_commentaries').update(values).eq('id', id)
    if (error) throw new Error(error.message)
    await fetch()
  }

  const removeCommentary = async (id: string) => {
    const { error } = await supabase.from('event_commentaries').delete().eq('id', id)
    if (error) throw new Error(error.message)
    await fetch()
  }

  // ── Photos ───────────────────────────────────────────────────
  const addPhoto = async (values: Omit<EventPhoto, 'id' | 'created_at' | 'updated_at'>) => {
    const { error } = await supabase.from('event_photos').insert(values)
    if (error) throw new Error(error.message)
    await fetch()
  }

  const updatePhoto = async (id: string, values: Partial<Omit<EventPhoto, 'id' | 'created_at' | 'updated_at'>>) => {
    const { error } = await supabase.from('event_photos').update(values).eq('id', id)
    if (error) throw new Error(error.message)
    await fetch()
  }

  const removePhoto = async (id: string) => {
    const { error } = await supabase.from('event_photos').delete().eq('id', id)
    if (error) throw new Error(error.message)
    await fetch()
  }

  return {
    videos, commentaries, photos, loading, refresh: fetch,
    addVideo, updateVideo, removeVideo,
    addCommentary, updateCommentary, removeCommentary,
    addPhoto, updatePhoto, removePhoto,
  }
}
