'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { CheckCircle, Landmark, MapPin } from 'lucide-react'

export default function SetupPage() {
  const router = useRouter()
  const { setActiveDistrictId } = useAuth()
  const supabase = createClient()

  const [districtName, setDistrictName] = useState('')
  const [savingDistrict, setSavingDistrict] = useState(false)
  const [districtError, setDistrictError] = useState<string | null>(null)
  const [completed, setCompleted] = useState(false)

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
      setActiveDistrictId(data.id)
      setCompleted(true)
    } catch (e) {
      setDistrictError(String(e))
    } finally {
      setSavingDistrict(false)
    }
  }

  return (
    <div className="h-full flex items-center justify-center p-6">
      <div className="w-full max-w-lg space-y-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <Landmark className="h-10 w-10 text-cyan-400" />
          <h1 className="text-2xl font-bold text-slate-100">Finance Setup</h1>
          <p className="text-sm text-slate-400">Create your first district to start tracking income and expenditure.</p>
        </div>

        {!completed ? (
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 space-y-5">
            <div className="flex items-center gap-2 text-slate-400 text-sm">
              <MapPin className="h-4 w-4 text-cyan-400 shrink-0" />
              Create your first district
            </div>
            <p className="text-xs text-slate-500">
              Districts are the core finance workspaces in this app. Income, expenditure, and reports all belong to a district.
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
              Create District
            </Button>
          </div>
        ) : (
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 space-y-5 text-center">
            <CheckCircle className="h-12 w-12 text-cyan-400 mx-auto" />
            <div>
              <h2 className="text-lg font-semibold text-slate-100">You&apos;re all set!</h2>
              <p className="text-sm text-slate-400 mt-1">
                <span className="text-slate-200 font-medium">{districtName}</span> has been created.
                You can now record income, expenditure, and reports.
              </p>
            </div>
            <Button onClick={() => router.push('/dashboard/overview')} className="w-full">
              Go to Overview
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
