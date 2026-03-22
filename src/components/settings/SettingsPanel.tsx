'use client'

import { useRef, useState } from 'react'
import { Upload, CheckCircle, AlertCircle, Loader, FileText, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/contexts/AuthContext'

interface ImportResult {
  imported: number
  updated: number
  errors: string[]
  error?: string
}

interface TabConfig {
  key: string
  label: string
  endpoint: string
  columns: string[]
  notes?: string
}

const IMPORT_TABS: TabConfig[] = [
  {
    key: 'districts',
    label: 'Districts',
    endpoint: '/api/import/districts',
    columns: ['id', 'name'],
    notes: 'id is optional — leave blank to auto-generate. Providing a stable id enables safe re-imports. Leadership roles are assigned via the Regions UI.',
  },
  {
    key: 'departments',
    label: 'Departments',
    endpoint: '/api/import/departments',
    columns: ['id', 'name', 'hod'],
    notes: 'Departments are shared across all districts.',
  },
  {
    key: 'regions',
    label: 'Regions',
    endpoint: '/api/import/regions',
    columns: ['id', 'name'],
    notes: 'Regions are imported into the active district. Leadership roles are assigned via the Regions UI.',
  },
  {
    key: 'people',
    label: 'People',
    endpoint: '/api/import/people',
    columns: ['id', 'name', 'phone', 'gender', 'region_id', 'department', 'total_contribution'],
    notes: 'region_id must match a region in the active district. department is matched by name (case-insensitive). gender: male | female | other. total_contribution creates/updates a single "sheet_import" contribution entry per person.',
  },
]

function ImportSection({ tab, districtId }: { tab: TabConfig; districtId?: string | null }) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    setFileName(f?.name ?? null)
    setResult(null)
  }

  const handleImport = async () => {
    const file = inputRef.current?.files?.[0]
    if (!file) return
    setLoading(true)
    setResult(null)
    try {
      const body = new FormData()
      body.append('file', file)
      if (districtId) body.append('district_id', districtId)
      const res = await fetch(tab.endpoint, { method: 'POST', body })
      const json = await res.json()
      setResult(json)
    } catch (e) {
      setResult({ imported: 0, updated: 0, errors: [], error: String(e) })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 space-y-4">
      <div>
        <h3 className="font-semibold text-slate-100">{tab.label}</h3>
        {tab.notes && <p className="text-xs text-slate-500 mt-0.5">{tab.notes}</p>}
      </div>

      {/* Column reference */}
      <div className="overflow-x-auto">
        <table className="text-xs w-full">
          <thead>
            <tr>
              {tab.columns.map((col) => (
                <th key={col} className="text-left px-2 py-1 text-slate-400 font-mono bg-slate-900 border border-slate-700 first:rounded-tl last:rounded-tr">
                  {col}
                </th>
              ))}
            </tr>
            <tr>
              {tab.columns.map((col) => (
                <td key={col} className="px-2 py-1 text-slate-600 italic border border-slate-700/50">
                  {col === 'id' ? 'optional' : col === 'gender' ? 'male|female|other' : '…'}
                </td>
              ))}
            </tr>
          </thead>
        </table>
      </div>

      {/* File picker + import button */}
      <div className="flex items-center gap-3 flex-wrap">
        <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-600 bg-slate-700/50 hover:bg-slate-700 cursor-pointer text-sm text-slate-300 transition-colors">
          <FileText className="h-4 w-4 shrink-0 text-slate-400" />
          <span className="truncate max-w-[200px]">{fileName ?? 'Choose CSV file…'}</span>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileChange}
            className="sr-only"
          />
        </label>
        <Button onClick={handleImport} disabled={loading || !fileName} size="sm">
          {loading ? <Loader className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {loading ? 'Importing…' : 'Import'}
        </Button>
      </div>

      {/* Result */}
      {result && (
        <div className={`rounded-lg px-4 py-3 text-sm space-y-1 ${result.error ? 'bg-red-500/10 border border-red-500/30 text-red-400' : 'bg-slate-700/50 border border-slate-600'}`}>
          {result.error ? (
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{result.error}</span>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 text-green-400">
                <CheckCircle className="h-4 w-4 shrink-0" />
                <span>{result.imported} inserted · {result.updated} updated</span>
              </div>
              {result.errors.length > 0 && (
                <ul className="mt-1 space-y-0.5 text-amber-400 text-xs">
                  {result.errors.map((e, i) => (
                    <li key={i} className="flex items-start gap-1">
                      <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                      {e}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

function DangerZone() {
  const [confirm, setConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)

  const handleDelete = async () => {
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch('/api/admin/delete-people', { method: 'DELETE' })
      const json = await res.json()
      setResult({ ok: res.ok, message: json.message ?? (res.ok ? 'Done' : 'Error') })
    } catch (e) {
      setResult({ ok: false, message: String(e) })
    } finally {
      setLoading(false)
      setConfirm(false)
    }
  }

  return (
    <div className="bg-red-950/30 border border-red-800/50 rounded-xl p-5 space-y-4">
      <h2 className="font-semibold text-red-400 flex items-center gap-2">
        <Trash2 className="h-5 w-5" />
        Danger Zone
      </h2>
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-sm text-slate-300 font-medium">Delete all people</p>
          <p className="text-xs text-slate-500 mt-0.5">Removes every person, their contributions, and their role assignments. This cannot be undone.</p>
        </div>
        {!confirm ? (
          <Button variant="danger" size="sm" onClick={() => setConfirm(true)}>
            Delete all people
          </Button>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xs text-red-400">Are you sure?</span>
            <Button variant="danger" size="sm" onClick={handleDelete} disabled={loading}>
              {loading ? <Loader className="h-4 w-4 animate-spin" /> : null}
              Yes, delete
            </Button>
            <Button size="sm" onClick={() => setConfirm(false)} disabled={loading}>
              Cancel
            </Button>
          </div>
        )}
      </div>
      {result && (
        <div className={`rounded-lg px-4 py-3 text-sm flex items-center gap-2 ${result.ok ? 'bg-slate-700/50 border border-slate-600 text-green-400' : 'bg-red-500/10 border border-red-500/30 text-red-400'}`}>
          {result.ok ? <CheckCircle className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
          {result.message}
        </div>
      )}
    </div>
  )
}

export function SettingsPanel() {
  const { districtId } = useAuth()
  return (
    <div className="space-y-6">
      {/* CSV import info */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 space-y-2">
        <h2 className="font-semibold text-slate-100 flex items-center gap-2">
          <Upload className="h-5 w-5 text-cyan-400" />
          CSV Import
        </h2>
        <p className="text-sm text-slate-400">
          Import data from CSV files. Each file must have the column headers shown below in the first row.
          Rows with a provided <code className="text-cyan-400 bg-slate-700 px-1 rounded text-xs">id</code> are upserted (safe to re-run); rows without an id are always inserted as new records.
        </p>
      </div>

      {/* Import sections — run in order */}
      <div className="space-y-4">
        <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Run imports in order ↓</p>
        {IMPORT_TABS.map((tab) => (
          <ImportSection key={tab.key} tab={tab} districtId={districtId} />
        ))}
      </div>

      {/* Danger zone */}
      <DangerZone />
    </div>
  )
}
