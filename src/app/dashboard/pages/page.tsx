'use client'

import { useState } from 'react'
import { FileText, Plus, Upload } from 'lucide-react'
import { usePages } from '@/hooks/usePages'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/components/ui/Toast'
import { PageCard } from '@/components/pages/PageCard'
import { PageModal } from '@/components/pages/PageModal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Button } from '@/components/ui/Button'
import { PageSpinner } from '@/components/ui/Spinner'
import { Modal } from '@/components/ui/Modal'
import { Page } from '@/types'

export default function PagesPage() {
  const { districtId } = useAuth()
  const { data: pages, loading, create, update, remove, refresh } = usePages(districtId)
  const toast = useToast()
  const [modal, setModal] = useState<{ open: boolean; page: Page | null }>({ open: false, page: null })
  const [confirm, setConfirm] = useState<{ open: boolean; page: Page | null }>({ open: false, page: null })
  const [deleting, setDeleting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importLoading, setImportLoading] = useState(false)
  const [importResult, setImportResult] = useState<{ imported: number; updated: number; errors: string[] } | null>(null)

  const handleImport = async () => {
    if (!importFile) return
    setImportLoading(true)
    setImportResult(null)
    try {
      const fd = new FormData()
      fd.append('file', importFile)
      if (districtId) fd.append('district_id', districtId)
      const res = await fetch('/api/import/pages', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Import failed')
      setImportResult({ imported: json.imported, updated: json.updated, errors: json.errors ?? [] })
      if (json.imported > 0 || json.updated > 0) {
        await refresh()
        toast.success(`${json.imported} added, ${json.updated} updated`)
      }
    } catch (e) {
      toast.error(String(e))
    } finally {
      setImportLoading(false)
    }
  }

  const handleSave = async (values: Omit<Page, 'id' | 'created_at' | 'updated_at' | 'district_id'>) => {
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
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => { setImporting(true); setImportResult(null); setImportFile(null) }}>
            <Upload className="h-4 w-4" /> Import CSV
          </Button>
          <Button onClick={() => setModal({ open: true, page: null })}>
            <Plus className="h-4 w-4" /> New Page
          </Button>
        </div>
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

      <Modal
        open={importing}
        onClose={() => { setImporting(false); setImportFile(null); setImportResult(null) }}
        title="Import Pages from CSV"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-400">
            CSV columns: <span className="text-slate-300 font-mono">title, slug, content, icon_class, sort_order, published</span>
          </p>

          <label className="flex items-center gap-2 cursor-pointer bg-slate-800 border border-slate-700 hover:border-cyan-500/50 transition rounded-lg px-4 py-2 text-sm text-slate-300">
            <FileText className="h-4 w-4 text-slate-400 shrink-0" />
            <span className="truncate">{importFile ? importFile.name : 'Choose CSV file…'}</span>
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => { setImportFile(e.target.files?.[0] ?? null); setImportResult(null) }}
            />
          </label>

          {importResult && (
            <div className="space-y-2">
              {(importResult.imported > 0 || importResult.updated > 0) && (
                <p className="text-xs text-emerald-400">
                  {importResult.imported} added, {importResult.updated} updated.
                </p>
              )}
              {importResult.errors.length > 0 && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 space-y-1">
                  <p className="text-xs font-medium text-red-400">{importResult.errors.length} row{importResult.errors.length !== 1 ? 's' : ''} skipped:</p>
                  <ul className="space-y-0.5">
                    {importResult.errors.map((err, i) => (
                      <li key={i} className="text-xs text-red-300">{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => { setImporting(false); setImportFile(null); setImportResult(null) }} disabled={importLoading}>
              Cancel
            </Button>
            <Button onClick={handleImport} loading={importLoading} disabled={!importFile || importLoading}>
              Import
            </Button>
          </div>
        </div>
      </Modal>

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
