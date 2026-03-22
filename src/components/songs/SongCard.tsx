import { Pencil, Trash2, Eye, EyeOff, Music } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Song } from '@/types'

interface Props {
  song: Song
  onEdit: () => void
  onDelete: () => void
  onView: () => void
}

export function SongCard({ song, onEdit, onDelete, onView }: Props) {
  const lineCount = song.lyrics ? song.lyrics.split('\n').filter(Boolean).length : 0

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 flex flex-col gap-3 hover:border-slate-600 transition-colors">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-slate-700 flex items-center justify-center">
          <Music className="h-4 w-4 text-cyan-400" />
        </div>
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={onView}
            className="text-left w-full group"
          >
            <p className="font-medium text-slate-100 group-hover:text-cyan-400 transition-colors truncate">
              {song.title}
            </p>
          </button>
          {song.author && (
            <p className="text-xs text-slate-500 truncate mt-0.5">{song.author}</p>
          )}
        </div>
        {song.song_key && (
          <span className="shrink-0 px-2 py-0.5 rounded bg-slate-700 text-xs font-mono text-slate-300 border border-slate-600">
            {song.song_key}
          </span>
        )}
      </div>

      {song.lyrics && (
        <p className="text-xs text-slate-500 line-clamp-2 font-mono leading-relaxed">
          {song.lyrics}
        </p>
      )}

      <div className="flex items-center justify-between mt-auto pt-1 border-t border-slate-700/50">
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${
            song.published
              ? 'bg-green-900/30 text-green-400 border-green-700/50'
              : 'bg-slate-700/50 text-slate-500 border-slate-600/50'
          }`}>
            {song.published ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
            {song.published ? 'Published' : 'Draft'}
          </span>
          {lineCount > 0 && (
            <span className="text-xs text-slate-600">{lineCount} lines</span>
          )}
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" onClick={onDelete} className="text-red-400 hover:text-red-300">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  )
}
