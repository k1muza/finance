'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Church, MapPin, Globe, CheckCircle, Plus, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

const STEPS = ['District', 'Regions', 'Done'] as const
type Step = 0 | 1 | 2

function StepIndicator({ current }: { current: Step }) {
  return (
    <div className="flex items-center gap-2">
      {STEPS.map((label, i) => (
        <div key={label} className="flex items-center gap-2">
          <div className={cn(
            'flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold border-2 transition-colors',
            i < current  ? 'bg-cyan-500 border-cyan-500 text-slate-950' :
            i === current ? 'border-cyan-400 text-cyan-400' :
                            'border-slate-700 text-slate-600'
          )}>
            {i < current ? <CheckCircle className="h-4 w-4" /> : i + 1}
          </div>
          <span className={cn(
            'text-sm font-medium hidden sm:block',
            i === current ? 'text-slate-200' : i < current ? 'text-cyan-400' : 'text-slate-600'
          )}>
            {label}
          </span>
          {i < STEPS.length - 1 && (
            <div className={cn('w-8 h-px', i < current ? 'bg-cyan-500' : 'bg-slate-700')} />
          )}
        </div>
      ))}
    </div>
  )
}

export default function SetupPage() {
  const router = useRouter()
  const { setActiveDistrictId } = useAuth()
  const supabase = createClient()

  const [step, setStep] = useState<Step>(0)
  const [districtId, setDistrictId] = useState<string | null>(null)
  const [districtName, setDistrictName] = useState('')

  // Step 1 state
  const [savingDistrict, setSavingDistrict] = useState(false)
  const [districtError, setDistrictError] = useState<string | null>(null)

  // Step 2 state
  const [regions, setRegions] = useState<string[]>([''])
  const [savingRegions, setSavingRegions] = useState(false)
  const [regionsError, setRegionsError] = useState<string | null>(null)

  // ── Step 1: Create district ────────────────────────────────
  const handleCreateDistrict = async () => {
    if (!districtName.trim()) return
    setSavingDistrict(true)
    setDistrictError(null)
    try {
      const { data, error } = await supabase
        .from('districts')
        .insert({ name: districtName.trim() })
        .select('id')
        .single()
      if (error) throw new Error(error.message)
      setDistrictId(data.id)
      setActiveDistrictId(data.id)
      setStep(1)
    } catch (e) {
      setDistrictError(String(e))
    } finally {
      setSavingDistrict(false)
    }
  }

  // ── Step 2: Create regions ─────────────────────────────────
  const handleAddRegions = async () => {
    const names = regions.map((r) => r.trim()).filter(Boolean)
    if (names.length === 0) { setStep(2); return }
    setSavingRegions(true)
    setRegionsError(null)
    try {
      const { error } = await supabase
        .from('regions')
        .insert(names.map((name) => ({ district_id: districtId, name })))
      if (error) throw new Error(error.message)
      setStep(2)
    } catch (e) {
      setRegionsError(String(e))
    } finally {
      setSavingRegions(false)
    }
  }

  const updateRegion = (i: number, val: string) =>
    setRegions((prev) => prev.map((r, idx) => (idx === i ? val : r)))

  const addRegionRow = () => setRegions((prev) => [...prev, ''])

  const removeRegionRow = (i: number) =>
    setRegions((prev) => prev.length === 1 ? [''] : prev.filter((_, idx) => idx !== i))

  // ── Render ─────────────────────────────────────────────────
  return (
    <div className="h-full flex items-center justify-center p-6">
      <div className="w-full max-w-lg space-y-8">

        {/* Logo + title */}
        <div className="flex flex-col items-center gap-3 text-center">
          <Church className="h-10 w-10 text-cyan-400" />
          <h1 className="text-2xl font-bold text-slate-100">Conference Setup</h1>
          <p className="text-sm text-slate-400">Let's get your conference configured in a few steps.</p>
        </div>

        {/* Step indicator */}
        <div className="flex justify-center">
          <StepIndicator current={step} />
        </div>

        {/* Step 0 — District */}
        {step === 0 && (
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 space-y-5">
            <div className="flex items-center gap-2 text-slate-400 text-sm">
              <MapPin className="h-4 w-4 text-cyan-400 shrink-0" />
              Create a district
            </div>
            <p className="text-xs text-slate-500">
              Districts are the top-level units. Regions and people belong to a district.
            </p>
            <Input
              label="District name *"
              value={districtName}
              onChange={(e) => setDistrictName(e.target.value)}
              placeholder="e.g. Northern District"
              onKeyDown={(e) => e.key === 'Enter' && handleCreateDistrict()}
            />
            {districtError && <p className="text-xs text-red-400">{districtError}</p>}
            <Button onClick={handleCreateDistrict} loading={savingDistrict} disabled={!districtName.trim()} className="w-full">
              Create District &amp; Continue
            </Button>
          </div>
        )}

        {/* Step 1 — Regions */}
        {step === 1 && (
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 space-y-5">
            <div className="flex items-center gap-2 text-slate-400 text-sm">
              <Globe className="h-4 w-4 text-cyan-400 shrink-0" />
              Add regions to <span className="text-slate-200 font-medium">{districtName}</span>
            </div>
            <p className="text-xs text-slate-500">
              Regions group people within a district. You can add more later.
            </p>

            <div className="space-y-2">
              {regions.map((name, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    value={name}
                    onChange={(e) => updateRegion(i, e.target.value)}
                    placeholder={`Region ${i + 1} name`}
                    onKeyDown={(e) => e.key === 'Enter' && i === regions.length - 1 && addRegionRow()}
                  />
                  <button
                    type="button"
                    onClick={() => removeRegionRow(i)}
                    className="text-slate-600 hover:text-red-400 transition-colors shrink-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={addRegionRow}
              className="flex items-center gap-1.5 text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Add another region
            </button>

            {regionsError && <p className="text-xs text-red-400">{regionsError}</p>}

            <div className="flex gap-3 pt-1">
              <Button variant="ghost" onClick={() => setStep(2)} className="flex-1">
                Skip
              </Button>
              <Button onClick={handleAddRegions} loading={savingRegions} className="flex-1">
                Save &amp; Continue
              </Button>
            </div>
          </div>
        )}

        {/* Step 2 — Done */}
        {step === 2 && (
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 space-y-5 text-center">
            <CheckCircle className="h-12 w-12 text-cyan-400 mx-auto" />
            <div>
              <h2 className="text-lg font-semibold text-slate-100">You&apos;re all set!</h2>
              <p className="text-sm text-slate-400 mt-1">
                <span className="text-slate-200 font-medium">{districtName}</span> has been created.
                You can now import people and manage the conference.
              </p>
            </div>
            <Button onClick={() => router.push('/dashboard/overview')} className="w-full">
              Go to Dashboard
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
