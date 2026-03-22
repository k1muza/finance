import { Pencil, Trash2, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Page } from '@/types'

interface Props {
  page: Page
  onEdit: () => void
  onDelete: () => void
}

export function PageCard({ page, onEdit, onDelete }: Props) {
  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden flex flex-col group">
      {/* Featured image */}
      {page.featured_image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={page.featured_image_url}
          alt=""
          className="w-full h-32 object-cover"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
        />
      ) : (
        <div className="w-full h-32 bg-slate-700/50 flex items-center justify-center">
          {page.icon_class
            ? <i className={`${page.icon_class} text-4xl text-slate-500`} />
            : <span className="text-slate-600 text-sm">No image</span>}
        </div>
      )}

      <div className="p-4 flex flex-col flex-1 gap-3">
        <div className="flex items-start gap-2 min-w-0">
          {page.icon_class && (
            <i className={`${page.icon_class} text-lg text-cyan-400 mt-0.5 shrink-0`} />
          )}
          <div className="min-w-0">
            <p className="font-medium text-slate-100 truncate">{page.title}</p>
            <p className="text-xs text-slate-500 font-mono truncate">/{page.slug}</p>
          </div>
        </div>

        <div className="flex items-center justify-between mt-auto">
          <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${
            page.published
              ? 'bg-green-900/30 text-green-400 border-green-700/50'
              : 'bg-slate-700/50 text-slate-500 border-slate-600/50'
          }`}>
            {page.published ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
            {page.published ? 'Published' : 'Draft'}
          </span>

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
    </div>
  )
}
