'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
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
          <Landmark className="h-10 w-10 text-[var(--theme-accent-400)]" />
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Finance Setup</h1>
          <p className="text-sm text-[var(--text-tertiary)]">Create your first district to start tracking income and expenditure.</p>
        </div>

        {!completed ? (
          <Card>
            <CardContent className="space-y-5 p-6">
              <div className="flex items-center gap-2 text-sm text-[var(--text-tertiary)]">
                <MapPin className="h-4 w-4 shrink-0 text-[var(--theme-accent-400)]" />
                Create your first district
              </div>
              <p className="text-xs text-[var(--text-muted)]">
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
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="space-y-5 p-6 text-center">
              <CheckCircle className="mx-auto h-12 w-12 text-[var(--theme-accent-400)]" />
              <div>
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">You&apos;re all set!</h2>
                <p className="mt-1 text-sm text-[var(--text-tertiary)]">
                  <span className="font-medium text-[var(--text-secondary)]">{districtName}</span> has been created.
                  You can now record income, expenditure, and reports.
                </p>
              </div>
              <Button onClick={() => router.push('/dashboard/overview')} className="w-full">
                Go to Overview
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
