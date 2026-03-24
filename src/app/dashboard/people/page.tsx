'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { usePeople } from '@/hooks/usePeople'
import { useRegions } from '@/hooks/useRegions'
import { useDepartments } from '@/hooks/useDepartments'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/components/ui/Toast'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { PeopleFilters } from '@/components/people/PeopleFilters'
import { PeopleTable } from '@/components/people/PeopleTable'
import { Button } from '@/components/ui/Button'
import { PageSpinner } from '@/components/ui/Spinner'
import { Person } from '@/types'
import { Modal } from '@/components/ui/Modal'
import { UserPlus, Upload, FileText } from 'lucide-react'

export default function PeoplePage() {
  const router = useRouter()
  const { districtId, isAdmin } = useAuth()
  const [filters, setFilters] = useState({ search: '', gender: '', regionId: '', departmentId: '' })
  const [confirm, setConfirm] = useState<{ open: boolean; person: Person | null }>({ open: false, person: null })
  const [deleting, setDeleting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importLoading, setImportLoading] = useState(false)
  const [importResult, setImportResult] = useState<{ imported: number; updated: number; errors: string[] } | null>(null)

  const { data: people, loading, remove, refresh } = usePeople({
    search: filters.search,
    gender: filters.gender,
    region_id: filters.regionId,
    department_id: filters.departmentId,
  }, districtId)
  const { data: regions } = useRegions(isAdmin ? undefined : districtId ?? undefined)
  const { data: departments } = useDepartments()
  const toast = useToast()

  const handleImport = async () => {
    if (!importFile) return
    setImportLoading(true)
    setImportResult(null)
    try {
      const fd = new FormData()
      fd.append('file', importFile)
      if (districtId) fd.append('district_id', districtId)
      const res = await fetch('/api/import/people', { method: 'POST', body: fd })
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

  const handleDelete = async () => {
    if (!confirm.person) return
    setDeleting(true)
    try {
      await remove(confirm.person.id)
      toast.success('Person removed')
      setConfirm({ open: false, person: null })
    } catch (e) {
      toast.error(String(e))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">People</h1>
          <p className="text-sm text-slate-400 mt-1">{people.length} attendee{people.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => { setImporting(true); setImportResult(null); setImportFile(null) }}>
            <Upload className="h-4 w-4" /> Import CSV
          </Button>
          <Button onClick={() => router.push('/dashboard/people/new')}>
            <UserPlus className="h-4 w-4" /> Add Person
          </Button>
        </div>
      </div>

      <PeopleFilters
        search={filters.search}
        gender={filters.gender}
        regionId={filters.regionId}
        departmentId={filters.departmentId}
        regions={regions}
        departments={departments}
        onChange={(field, value) => setFilters((f) => ({ ...f, [field]: value }))}
      />

      {loading ? (
        <PageSpinner />
      ) : (
        <PeopleTable
          people={people}
          onEdit={(p) => router.push(`/dashboard/people/${p.id}`)}
          onDelete={(p) => setConfirm({ open: true, person: p })}
        />
      )}

      <Modal
        open={importing}
        onClose={() => { setImporting(false); setImportFile(null); setImportResult(null) }}
        title="Import People from CSV"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-400">
            CSV columns: <span className="text-slate-300 font-mono">name, phone, gender, region, department, total_contribution</span>
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
        onClose={() => setConfirm({ open: false, person: null })}
        onConfirm={handleDelete}
        title="Remove Person"
        message={`Are you sure you want to remove "${confirm.person?.name}"? This cannot be undone.`}
        loading={deleting}
      />
    </div>
  )
}
