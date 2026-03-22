'use client'

import { useState } from 'react'
import { Music, Plus } from 'lucide-react'
import { useSongs } from '@/hooks/useSongs'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/components/ui/Toast'
import { SongCard } from '@/components/songs/SongCard'
import { SongModal } from '@/components/songs/SongModal'
import { SlideOver } from '@/components/ui/SlideOver'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Button } from '@/components/ui/Button'
import { PageSpinner } from '@/components/ui/Spinner'
import { Song } from '@/types'

export default function SongsPage() {
  const { isAdmin } = useAuth()
  const { data: songs, loading, create, update, remove } = useSongs()
  const toast = useToast()
  const [modal, setModal] = useState<{ open: boolean; song: Song | null }>({ open: false, song: null })
  const [viewer, setViewer] = useState<Song | null>(null)
  const [confirm, setConfirm] = useState<{ open: boolean; song: Song | null }>({ open: false, song: null })
  const [deleting, setDeleting] = useState(false)

  const handleSave = async (values: Omit<Song, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      if (modal.song) {
        await update(modal.song.id, values)
        toast.success('Song updated')
      } else {
        await create(values)
        toast.success('Song created')
      }
    } catch (e) {
      toast.error(String(e))
      throw e
    }
  }

  const handleDelete = async () => {
    if (!confirm.song) return
    setDeleting(true)
    try {
      await remove(confirm.song.id)
      toast.success('Song deleted')
      setConfirm({ open: false, song: null })
    } catch (e) {
      toast.error(String(e))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Music className="h-7 w-7 text-cyan-400" />
          <div>
            <h1 className="text-2xl font-bold text-slate-100">Songs</h1>
            <p className="text-sm text-slate-400 mt-1">{songs.length} song{songs.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        {isAdmin && (
          <Button onClick={() => setModal({ open: true, song: null })}>
            <Plus className="h-4 w-4" /> New Song
          </Button>
        )}
      </div>

      {loading ? (
        <PageSpinner />
      ) : songs.length === 0 ? (
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-12 text-center">
          <p className="text-slate-500">No songs yet. Add your first one.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {songs.map((song) => (
            <SongCard
              key={song.id}
              song={song}
              onView={() => setViewer(song)}
              onEdit={() => setModal({ open: true, song })}
              onDelete={() => setConfirm({ open: true, song })}
              isAdmin={isAdmin}
            />
          ))}
        </div>
      )}

      <SongModal
        open={modal.open}
        onClose={() => setModal({ open: false, song: null })}
        onSave={handleSave}
        initial={modal.song}
      />

      {/* Lyrics viewer */}
      <SlideOver
        open={!!viewer}
        onClose={() => setViewer(null)}
        title={viewer?.title ?? ''}
      >
        {viewer && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
              {viewer.author && (
                <span className="text-sm text-slate-400">{viewer.author}</span>
              )}
              {viewer.song_key && (
                <span className="px-2 py-0.5 rounded bg-slate-700 text-xs font-mono text-slate-300 border border-slate-600">
                  Key of {viewer.song_key}
                </span>
              )}
            </div>
            {viewer.lyrics ? (
              <pre className="whitespace-pre-wrap font-sans text-sm text-slate-200 leading-relaxed">
                {viewer.lyrics}
              </pre>
            ) : (
              <p className="text-slate-500 text-sm">No lyrics added yet.</p>
            )}
            {isAdmin && (
              <div className="pt-4 border-t border-slate-700 flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => { setViewer(null); setModal({ open: true, song: viewer }) }}>
                  Edit Song
                </Button>
              </div>
            )}
          </div>
        )}
      </SlideOver>

      <ConfirmDialog
        open={confirm.open}
        onClose={() => setConfirm({ open: false, song: null })}
        onConfirm={handleDelete}
        title="Delete Song"
        message={`Delete "${confirm.song?.title}"? This cannot be undone.`}
        loading={deleting}
      />
    </div>
  )
}
