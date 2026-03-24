'use client'

import { useEffect, useState } from 'react'
import { useDistricts } from '@/hooks/useDistricts'
import { useRegions } from '@/hooks/useRegions'
import { usePeople } from '@/hooks/usePeople'
import { usePersonRoles } from '@/hooks/usePersonRoles'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/components/ui/Toast'
import { DistrictNode } from '@/components/regions/DistrictNode'
import { PageSpinner } from '@/components/ui/Spinner'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { District, PersonRoleType } from '@/types'
import { Upload, FileText } from 'lucide-react'

export default function RegionsPage() {
  const { districtId, isAdmin } = useAuth()
  const [importing, setImporting] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importLoading, setImportLoading] = useState(false)
  const [importResult, setImportResult] = useState<{ imported: number; updated: number; errors: string[] } | null>(null)

  const { data: allDistricts, loading: dLoading, create: createDistrict, update: updateDistrict, remove: removeDistrict } = useDistricts()
  const { data: regions, create: createRegion, update: updateRegion, remove: removeRegion, refresh: refreshRegions } = useRegions()
  const { data: people } = usePeople()
  const { data: roles, fetch: fetchRoles, setRole } = usePersonRoles()
  const toast = useToast()

  useEffect(() => { fetchRoles() }, [fetchRoles])

  const districts = districtId ? allDistricts.filter((d) => d.id === districtId) : allDistricts

  const handleImport = async () => {
    if (!importFile) return
    setImportLoading(true)
    setImportResult(null)
    try {
      const fd = new FormData()
      fd.append('file', importFile)
      if (districtId) fd.append('district_id', districtId)
      const res = await fetch('/api/import/regions', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Import failed')
      setImportResult({ imported: json.imported, updated: json.updated, errors: json.errors ?? [] })
      if (json.imported > 0 || json.updated > 0) {
        await refreshRegions()
        toast.success(`${json.imported} added, ${json.updated} updated`)
      }
    } catch (e) {
      toast.error(String(e))
    } finally {
      setImportLoading(false)
    }
  }

  const handleSetRole = async (
    entityType: 'district' | 'region',
    entityId: string,
    role: PersonRoleType,
    personId: string | null
  ) => {
    try {
      await setRole(entityType, entityId, role, personId)
    } catch (e) {
      toast.error(String(e))
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Regions & Districts</h1>
          <p className="text-sm text-slate-400 mt-1">
            {districts.length} district{districts.length !== 1 ? 's' : ''} · {regions.length} region{regions.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button variant="ghost" onClick={() => { setImporting(true); setImportResult(null); setImportFile(null) }}>
          <Upload className="h-4 w-4" /> Import CSV
        </Button>
      </div>

      <Modal
        open={importing}
        onClose={() => { setImporting(false); setImportFile(null); setImportResult(null) }}
        title="Import Regions from CSV"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-400">
            CSV columns: <span className="text-slate-300 font-mono">name</span>
            {districtId
              ? <span> — regions will be added to the active district.</span>
              : <span> — include a <span className="text-slate-300 font-mono">district</span> column to specify the target district by name.</span>
            }
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

      {dLoading ? (
        <PageSpinner />
      ) : districts.length === 0 ? (
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-12 text-center">
          <p className="text-slate-500">No districts yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {districts.map((d) => (
            <DistrictNode
              key={d.id}
              district={d}
              regions={regions.filter((r) => r.district_id === d.id)}
              roles={roles}
              people={people}
              onUpdateDistrict={async (id, values) => {
                try { await updateDistrict(id, values as Partial<District>); toast.success('District updated') }
                catch (e) { toast.error(String(e)) }
              }}
              onDeleteDistrict={async (id) => {
                try { await removeDistrict(id); toast.success('District deleted') }
                catch (e) { toast.error(String(e)) }
              }}
              onCreateRegion={async (values) => {
                try { await createRegion(values); toast.success('Region added') }
                catch (e) { toast.error(String(e)) }
              }}
              onUpdateRegion={async (id, values) => {
                try { await updateRegion(id, values); toast.success('Region updated') }
                catch (e) { toast.error(String(e)) }
              }}
              onDeleteRegion={async (id) => {
                try { await removeRegion(id); toast.success('Region deleted') }
                catch (e) { toast.error(String(e)) }
              }}
              onSetRole={handleSetRole}
            />
          ))}
        </div>
      )}
    </div>
  )
}
