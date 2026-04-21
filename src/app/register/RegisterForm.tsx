'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Landmark } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { createClient } from '@/lib/supabase/client'
import { Select } from '@/components/ui/Select'

const registrationEnabled = process.env.NEXT_PUBLIC_REGISTRATION_ENABLED === 'true'

type DistrictOption = {
  id: string
  name: string
}

export default function RegisterForm() {
  const router = useRouter()
  const [supabase] = useState(() => createClient())
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [districtId, setDistrictId] = useState('')
  const [districts, setDistricts] = useState<DistrictOption[]>([])
  const [districtsLoading, setDistrictsLoading] = useState(registrationEnabled)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    let cancelled = false

    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (session && !cancelled) {
        router.replace('/dashboard/overview')
      }
    })

    return () => {
      cancelled = true
    }
  }, [router, supabase])

  useEffect(() => {
    if (!registrationEnabled) return

    let cancelled = false

    async function loadDistricts() {
      try {
        setDistrictsLoading(true)
        const res = await fetch('/api/public/districts', { cache: 'no-store' })
        const json = await res.json()

        if (!res.ok) {
          throw new Error(json.error ?? 'Failed to load districts.')
        }

        if (!cancelled) {
          setDistricts(json.districts ?? [])
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load districts.')
        }
      } finally {
        if (!cancelled) {
          setDistrictsLoading(false)
        }
      }
    }

    void loadDistricts()

    return () => {
      cancelled = true
    }
  }, [])

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!districtId) {
      setError('Please select a district.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    setLoading(true)

    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, district_id: districtId }),
    })

    const json = await res.json()

    if (!res.ok) {
      setError(json.error ?? 'Registration failed. Please try again.')
      setLoading(false)
    } else {
      setSuccess(true)
    }
  }

  const selectedDistrictName = districts.find((district) => district.id === districtId)?.name

  if (!registrationEnabled) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--surface-app)] p-4">
        <div className="w-full max-w-sm space-y-8 text-center">
          <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-[var(--radius-2xl)] border bg-[var(--accent-soft)] [border-color:var(--accent-border)]">
            <Landmark className="h-8 w-8 text-[var(--theme-accent-400)]" />
          </div>
          <Card>
            <CardContent className="space-y-4 p-6">
              <p className="text-base font-semibold text-[var(--text-primary)]">Registration closed</p>
              <p className="text-sm text-[var(--text-tertiary)]">
                New account registration is currently disabled. Contact your finance administrator to get access.
              </p>
              <Link
                href="/login"
                className="inline-flex w-full items-center justify-center rounded-[var(--radius-sm)] border bg-[var(--button-secondary-bg)] px-4 py-2.5 text-sm font-medium text-[var(--text-primary)] transition-colors [border-color:var(--border-strong)] hover:bg-[var(--button-secondary-hover)]"
              >
                Back to sign in
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--surface-app)] p-4">
        <div className="w-full max-w-sm space-y-8 text-center">
          <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-[var(--radius-2xl)] border bg-[var(--accent-soft)] [border-color:var(--accent-border)]">
            <Landmark className="h-8 w-8 text-[var(--theme-accent-400)]" />
          </div>
          <Card>
            <CardContent className="space-y-4 p-6">
              <p className="text-base font-semibold text-[var(--text-primary)]">Account created</p>
              <p className="text-sm text-[var(--text-tertiary)]">
                Your district account{selectedDistrictName ? ` for ${selectedDistrictName}` : ''} has been created successfully. You can now sign in.
              </p>
              <Link
                href="/login"
                className="inline-flex w-full items-center justify-center rounded-[var(--radius-sm)] border bg-[var(--accent-solid)] px-4 py-2.5 text-sm font-semibold text-[var(--accent-contrast)] shadow-[var(--shadow-button)] transition-colors [border-color:var(--button-primary-border)] hover:bg-[var(--accent-solid-hover)]"
              >
                Sign in
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const noDistrictsAvailable = !districtsLoading && districts.length === 0

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--surface-app)] p-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-[var(--radius-2xl)] border bg-[var(--accent-soft)] [border-color:var(--accent-border)]">
            <Landmark className="h-8 w-8 text-[var(--theme-accent-400)]" />
          </div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">District Finance Dashboard</h1>
          <p className="mt-1 text-sm text-[var(--text-tertiary)]">
            Create a district finance account
          </p>
        </div>

        <Card>
          <CardContent className="space-y-5 p-6">
            <div>
              <p className="mb-1 text-base font-semibold text-[var(--text-primary)]">Create account</p>
              <p className="text-sm text-[var(--text-tertiary)]">Register a district user account and link it to an existing district</p>
            </div>

            {error && (
              <div className="rounded-[var(--radius-sm)] border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            {noDistrictsAvailable && (
              <div className="rounded-[var(--radius-sm)] border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
                No districts are available for self-registration yet. Contact an administrator to create the first district.
              </div>
            )}

            <form onSubmit={handleRegister} className="space-y-4">
              <Select
                id="district"
                label="District *"
                value={districtId}
                onChange={(e) => setDistrictId(e.target.value)}
                options={districts.map((district) => ({ value: district.id, label: district.name }))}
                placeholder={districtsLoading ? 'Loading districts...' : 'Select a district'}
                disabled={districtsLoading || noDistrictsAvailable}
                required
              />

              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                label="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />

              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                label="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 8 characters"
              />

              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                required
                label="Confirm password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm password"
              />

              <Button
                type="submit"
                disabled={loading || districtsLoading || noDistrictsAvailable}
                loading={loading}
                className="w-full"
              >
                {loading ? 'Creating account...' : 'Create account'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-[var(--text-muted)]">
          Already have an account?{' '}
          <Link href="/login" className="text-[var(--theme-accent-400)] transition-colors hover:text-[var(--theme-accent-300)]">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
