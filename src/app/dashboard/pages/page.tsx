'use client'

import { useState } from 'react'
import { FileText, Plus } from 'lucide-react'
import { usePages } from '@/hooks/usePages'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/components/ui/Toast'
import { PageCard } from '@/components/pages/PageCard'
import { PageModal } from '@/components/pages/PageModal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Button } from '@/components/ui/Button'
import { PageSpinner } from '@/components/ui/Spinner'
import { Page } from '@/types'

export default function PagesPage() {
  const { districtId } = useAuth()
  const { data: pages, loading, create, update, remove } = usePages(districtId)
  const toast = useToast()
  const [modal, setModal] = useState<{ open: boolean; page: Page | null }>({ open: false, page: null })
  const [confirm, setConfirm] = useState<{ open: boolean; page: Page | null }>({ open: false, page: null })
  const [deleting, setDeleting] = useState(false)

  const handleSave = async (values: Omit<Page, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      if (modal.page) {
        await update(modal.page.id, values)
        toast.success('Page updated')
      } else {
        await create({ ...values, district_id: districtId! })
        toast.success('Page created')
      }
    } catch (e) {
      toast.error(String(e))
      throw e
    }
  }

  const handleDelete = async () => {
    if (!confirm.page) return
    setDeleting(true)
    try {
      await remove(confirm.page.id)
      toast.success('Page deleted')
      setConfirm({ open: false, page: null })
    } catch (e) {
      toast.error(String(e))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText className="h-7 w-7 text-cyan-400" />
          <div>
            <h1 className="text-2xl font-bold text-slate-100">Pages</h1>
            <p className="text-sm text-slate-400 mt-1">{pages.length} page{pages.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <Button onClick={() => setModal({ open: true, page: null })}>
          <Plus className="h-4 w-4" /> New Page
        </Button>
      </div>

      {loading ? (
        <PageSpinner />
      ) : pages.length === 0 ? (
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-12 text-center">
          <p className="text-slate-500">No pages yet. Create your first one.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {pages.map((page) => (
            <PageCard
              key={page.id}
              page={page}
              onEdit={() => setModal({ open: true, page })}
              onDelete={() => setConfirm({ open: true, page })}
            />
          ))}
        </div>
      )}

      <PageModal
        open={modal.open}
        onClose={() => setModal({ open: false, page: null })}
        onSave={handleSave}
        initial={modal.page}
      />

      <ConfirmDialog
        open={confirm.open}
        onClose={() => setConfirm({ open: false, page: null })}
        onConfirm={handleDelete}
        title="Delete Page"
        message={`Delete "${confirm.page?.title}"? This cannot be undone.`}
        loading={deleting}
      />
    </div>
  )
}
