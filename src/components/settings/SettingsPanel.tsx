'use client'

import { useRef, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, CheckCircle, AlertCircle, Loader, FileText, Trash2, Building2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useAuth } from '@/contexts/AuthContext'
import { useDistricts } from '@/hooks/useDistricts'

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
  {
    key: 'schedule',
    label: 'Schedule',
    endpoint: '/api/import/schedule',
    columns: ['date', 'label', 'session_name', 'session_start', 'session_duration', 'event_title', 'event_start', 'event_duration'],
    notes: 'date: YYYY-MM-DD. session_start / event_start: HH:MM (24-hour). session_duration / event_duration: minutes. label is optional. event_title, event_start, event_duration are optional — rows without event_title only create the day/session. Re-importing skips events that already exist by title within the same session.',
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
          <span className="truncate max-w-50">{fileName ?? 'Choose CSV file…'}</span>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileChange}
            className="hidden"
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

function DistrictSettings({ districtId }: { districtId: string }) {
  const { data: districts, update } = useDistricts()
  const district = districts.find((d) => d.id === districtId)

  const [name, setName] = useState(district?.name ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (district) setName(district.name)
  }, [district?.name]) // eslint-disable-line

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      await update(districtId, { name: name.trim() })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e) {
      setError(String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 space-y-4">
      <h2 className="font-semibold text-slate-100 flex items-center gap-2">
        <Building2 className="h-5 w-5 text-cyan-400" />
        District Settings
      </h2>
      <div className="flex items-end gap-3">
        <div className="flex-1 max-w-sm">
          <Input
            label="District name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="District name"
          />
        </div>
        <Button onClick={handleSave} disabled={saving || !name.trim() || name.trim() === district?.name} loading={saving}>
          Save
        </Button>
      </div>
      {saved && (
        <div className="flex items-center gap-2 text-sm text-green-400">
          <CheckCircle className="h-4 w-4 shrink-0" />
          District name updated
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
    </div>
  )
}

function DangerZone({ districtId }: { districtId?: string | null }) {
  const { data: districts, remove } = useDistricts()
  const { setActiveDistrictId } = useAuth()
  const router = useRouter()

  const [confirmPeople, setConfirmPeople] = useState(false)
  const [loadingPeople, setLoadingPeople] = useState(false)
  const [resultPeople, setResultPeople] = useState<{ ok: boolean; message: string } | null>(null)

  const [confirmDistrict, setConfirmDistrict] = useState(false)
  const [loadingDistrict, setLoadingDistrict] = useState(false)
  const [errorDistrict, setErrorDistrict] = useState<string | null>(null)

  const handleDeletePeople = async () => {
    setLoadingPeople(true)
    setResultPeople(null)
    try {
      const res = await fetch('/api/admin/delete-people', { method: 'DELETE' })
      const json = await res.json()
      setResultPeople({ ok: res.ok, message: json.message ?? (res.ok ? 'Done' : 'Error') })
    } catch (e) {
      setResultPeople({ ok: false, message: String(e) })
    } finally {
      setLoadingPeople(false)
      setConfirmPeople(false)
    }
  }

  const handleDeleteDistrict = async () => {
    if (!districtId) return
    setLoadingDistrict(true)
    setErrorDistrict(null)
    try {
      await remove(districtId)
      const remaining = districts.filter((d) => d.id !== districtId)
      if (remaining.length === 0) {
        setActiveDistrictId(null)
        router.push('/dashboard/setup')
      } else {
        setActiveDistrictId(remaining[0].id)
      }
    } catch (e) {
      setErrorDistrict(String(e))
      setConfirmDistrict(false)
    } finally {
      setLoadingDistrict(false)
    }
  }

  return (
    <div className="bg-red-950/30 border border-red-800/50 rounded-xl p-5 space-y-4">
      <h2 className="font-semibold text-red-400 flex items-center gap-2">
        <Trash2 className="h-5 w-5" />
        Danger Zone
      </h2>

      {/* Delete all people */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-sm text-slate-300 font-medium">Delete all people</p>
          <p className="text-xs text-slate-500 mt-0.5">Removes every person, their contributions, and their role assignments. This cannot be undone.</p>
        </div>
        {!confirmPeople ? (
          <Button variant="danger" size="sm" onClick={() => setConfirmPeople(true)}>
            Delete all people
          </Button>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xs text-red-400">Are you sure?</span>
            <Button variant="danger" size="sm" onClick={handleDeletePeople} disabled={loadingPeople}>
              {loadingPeople ? <Loader className="h-4 w-4 animate-spin" /> : null}
              Yes, delete
            </Button>
            <Button size="sm" onClick={() => setConfirmPeople(false)} disabled={loadingPeople}>
              Cancel
            </Button>
          </div>
        )}
      </div>
      {resultPeople && (
        <div className={`rounded-lg px-4 py-3 text-sm flex items-center gap-2 ${resultPeople.ok ? 'bg-slate-700/50 border border-slate-600 text-green-400' : 'bg-red-500/10 border border-red-500/30 text-red-400'}`}>
          {resultPeople.ok ? <CheckCircle className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
          {resultPeople.message}
        </div>
      )}

      {/* Delete district */}
      {districtId && (
        <>
          <div className="border-t border-red-900/50" />
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-sm text-slate-300 font-medium">Delete this district</p>
              <p className="text-xs text-slate-500 mt-0.5">Permanently removes the district and all associated regions, people, and data.</p>
            </div>
            {!confirmDistrict ? (
              <Button variant="danger" size="sm" onClick={() => setConfirmDistrict(true)}>
                Delete district
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs text-red-400">This cannot be undone.</span>
                <Button variant="danger" size="sm" onClick={handleDeleteDistrict} disabled={loadingDistrict}>
                  {loadingDistrict ? <Loader className="h-4 w-4 animate-spin" /> : null}
                  Yes, delete
                </Button>
                <Button size="sm" onClick={() => setConfirmDistrict(false)} disabled={loadingDistrict}>
                  Cancel
                </Button>
              </div>
            )}
          </div>
          {errorDistrict && (
            <div className="flex items-center gap-2 text-sm text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {errorDistrict}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export function SettingsPanel() {
  const { districtId, isAdmin } = useAuth()
  return (
    <div className="space-y-6">
      {/* District settings — visible to all */}
      {districtId && <DistrictSettings districtId={districtId} />}

      {/* CSV import + Danger Zone — admin only */}
      {isAdmin && (
        <>
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

          <div className="space-y-4">
            <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Run imports in order ↓</p>
            {IMPORT_TABS.map((tab) => (
              <ImportSection key={tab.key} tab={tab} districtId={districtId} />
            ))}
          </div>

          <DangerZone districtId={districtId} />
        </>
      )}
    </div>
  )
}
