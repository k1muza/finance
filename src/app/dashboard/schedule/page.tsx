'use client'

import { useState, useEffect } from 'react'
import { useDays } from '@/hooks/useDays'
import { usePeople } from '@/hooks/usePeople'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/components/ui/Toast'
import { DayTabs } from '@/components/schedule/DayTabs'
import { Timeline } from '@/components/schedule/Timeline'
import { PageSpinner } from '@/components/ui/Spinner'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Upload, FileText } from 'lucide-react'

export default function SchedulePage() {
  const { districtId } = useAuth()
  const { data: days, loading, create, remove, refresh } = useDays(districtId)
  const { data: people } = usePeople({}, districtId)
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null)
  const toast = useToast()

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
      const res = await fetch('/api/import/schedule', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Import failed')
      setImportResult({ imported: json.imported, updated: json.updated, errors: json.errors ?? [] })
      if (json.imported > 0 || json.updated > 0) {
        await refresh()
        toast.success(`${json.imported} events added, ${json.updated} updated`)
      }
    } catch (e) {
      toast.error(String(e))
    } finally {
      setImportLoading(false)
    }
  }

  // Auto-select first day
  useEffect(() => {
    if (days.length > 0 && !selectedDayId) {
      setSelectedDayId(days[0].id)
    }
  }, [days, selectedDayId])

  const handleCreateDay = async (values: { date: string; label: string | null }) => {
    try {
      await create({ ...values, district_id: districtId! })
      toast.success('Day added')
    } catch (e) {
      toast.error(String(e))
      throw e
    }
  }

  const handleDeleteDay = async (id: string) => {
    try {
      await remove(id)
      if (selectedDayId === id) setSelectedDayId(days.find((d) => d.id !== id)?.id ?? null)
      toast.success('Day deleted')
    } catch (e) {
      toast.error(String(e))
      throw e
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Schedule</h1>
          <p className="text-sm text-slate-400 mt-1">Manage days, sessions, events, and meals</p>
        </div>
        <Button variant="ghost" onClick={() => { setImporting(true); setImportResult(null); setImportFile(null) }}>
          <Upload className="h-4 w-4" /> Import CSV
        </Button>
      </div>

      <Modal
        open={importing}
        onClose={() => { setImporting(false); setImportFile(null); setImportResult(null) }}
        title="Import Schedule from CSV"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-400">
            CSV columns: <span className="text-slate-300 font-mono">date, label, session_name, session_start, session_duration, event_title, event_start, event_duration</span>
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
                  {importResult.imported} events added, {importResult.updated} updated.
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

      {loading ? (
        <PageSpinner />
      ) : (
        <>
          <DayTabs
            days={days}
            selectedId={selectedDayId}
            onSelect={setSelectedDayId}
            onCreate={handleCreateDay}
            onDelete={handleDeleteDay}
          />

          {days.length === 0 ? (
            <div className="bg-slate-800 rounded-xl border border-slate-700 border-dashed p-12 text-center">
              <p className="text-slate-500">No conference days yet. Add your first day above.</p>
            </div>
          ) : selectedDayId ? (
            <Timeline dayId={selectedDayId} people={people} />
          ) : null}
        </>
      )}
    </div>
  )
}
