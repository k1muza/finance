'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, CheckCircle, AlertCircle, Loader, FileText, Trash2, Building2, Landmark } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useAuth } from '@/contexts/AuthContext'
import { useDistricts } from '@/hooks/useDistricts'

interface ImportResult {
  imported: number
  updated?: number
  errors: string[]
  error?: string
}

interface TabConfig {
  key: string
  label: string
  endpoint: string
  columns: string[]
  notes?: string
  requiresDistrict?: boolean
}

const IMPORT_TABS: TabConfig[] = [
  {
    key: 'districts',
    label: 'Districts',
    endpoint: '/api/import/districts',
    columns: ['id', 'name'],
    notes: 'id is optional. Use it when you want to safely upsert districts from a controlled source file.',
  },
  {
    key: 'income',
    label: 'Income',
    endpoint: '/api/import/income',
    columns: ['district', 'description', 'amount', 'date', 'category'],
    notes: 'date must be in YYYY-MM-DD format. category is optional.',
    requiresDistrict: true,
  },
  {
    key: 'expenses',
    label: 'Expenditure',
    endpoint: '/api/import/expenses',
    columns: ['district', 'description', 'amount', 'date', 'category'],
    notes: 'date must be in YYYY-MM-DD format. category is optional.',
    requiresDistrict: true,
  },
]

function ImportSection({ tab, districtId }: { tab: TabConfig; districtId: string | null }) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    setFileName(file?.name ?? null)
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
      setResult({ imported: 0, errors: [], error: String(e) })
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
          </thead>
          <tbody>
            <tr>
              {tab.columns.map((col) => (
                <td key={col} className="px-2 py-1 text-slate-600 italic border border-slate-700/50">
                  {col === 'id' ? 'optional' : col === 'date' ? 'YYYY-MM-DD' : '...'}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {tab.requiresDistrict && !districtId ? (
        <p className="text-xs text-amber-400">Select an active district before importing {tab.label.toLowerCase()}.</p>
      ) : (
        <div className="flex items-center gap-3 flex-wrap">
          <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-600 bg-slate-700/50 hover:bg-slate-700 cursor-pointer text-sm text-slate-300 transition-colors">
            <FileText className="h-4 w-4 shrink-0 text-slate-400" />
            <span className="truncate max-w-50">{fileName ?? 'Choose CSV file...'}</span>
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
            {loading ? 'Importing...' : 'Import'}
          </Button>
        </div>
      )}

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
                <span>
                  {result.imported} imported
                  {typeof result.updated === 'number' ? ` · ${result.updated} updated` : ''}
                </span>
              </div>
              {result.errors.length > 0 && (
                <ul className="mt-1 space-y-0.5 text-amber-400 text-xs">
                  {result.errors.map((err, i) => (
                    <li key={i} className="flex items-start gap-1">
                      <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                      {err}
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

  const [confirmDistrict, setConfirmDistrict] = useState(false)
  const [loadingDistrict, setLoadingDistrict] = useState(false)
  const [errorDistrict, setErrorDistrict] = useState<string | null>(null)

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
        setActiveDistrictId(null)
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

      {districtId && (
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-sm text-slate-300 font-medium">Delete this district</p>
            <p className="text-xs text-slate-500 mt-0.5">Permanently removes the district and all associated income and expenditure data.</p>
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
      )}

      {errorDistrict && (
        <div className="flex items-center gap-2 text-sm text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {errorDistrict}
        </div>
      )}
    </div>
  )
}

export function SettingsPanel() {
  const { districtId, isAdmin } = useAuth()

  return (
    <div className="space-y-6">
      {districtId ? (
        <DistrictSettings key={districtId} districtId={districtId} />
      ) : (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 flex items-start gap-3">
          <Landmark className="h-5 w-5 text-cyan-400 shrink-0 mt-0.5" />
          <div>
            <h2 className="text-sm font-semibold text-slate-100">Select a district</h2>
            <p className="text-sm text-slate-400 mt-1">
              Choose a district from the top bar to rename it, import scoped finance data, or delete it.
            </p>
          </div>
        </div>
      )}

      {isAdmin && (
        <>
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 space-y-2">
            <h2 className="font-semibold text-slate-100 flex items-center gap-2">
              <Upload className="h-5 w-5 text-cyan-400" />
              CSV Import
            </h2>
            <p className="text-sm text-slate-400">
              Import districts, income, or expenditure from CSV files. Each file must have the headers shown below in the first row.
            </p>
          </div>

          <div className="space-y-4">
            <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Finance import tools</p>
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
