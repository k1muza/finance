'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Landmark } from 'lucide-react'
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
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
        <div className="w-full max-w-sm space-y-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 mb-4">
            <Landmark className="h-8 w-8 text-cyan-400" />
          </div>
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 space-y-4">
            <p className="text-base font-semibold text-slate-100">Registration closed</p>
            <p className="text-sm text-slate-400">
              New account registration is currently disabled. Contact your finance administrator to get access.
            </p>
            <Link
              href="/login"
              className="block w-full text-center bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium py-2.5 rounded-lg text-sm transition"
            >
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
        <div className="w-full max-w-sm space-y-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 mb-4">
            <Landmark className="h-8 w-8 text-cyan-400" />
          </div>
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 space-y-4">
            <p className="text-base font-semibold text-slate-100">Account created</p>
            <p className="text-sm text-slate-400">
              Your district account{selectedDistrictName ? ` for ${selectedDistrictName}` : ''} has been created successfully. You can now sign in.
            </p>
            <Link
              href="/login"
              className="block w-full text-center bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold py-2.5 rounded-lg text-sm transition"
            >
              Sign in
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const noDistrictsAvailable = !districtsLoading && districts.length === 0

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 mb-4">
            <Landmark className="h-8 w-8 text-cyan-400" />
          </div>
          <h1 className="text-2xl font-bold text-slate-100">District Finance Dashboard</h1>
          <p className="text-sm text-slate-400 mt-1">
            Create a district finance account
          </p>
        </div>

        <form onSubmit={handleRegister} className="bg-slate-900 border border-slate-700 rounded-2xl p-6 space-y-5">
          <div>
            <p className="text-base font-semibold text-slate-100 mb-1">Create account</p>
            <p className="text-sm text-slate-400">Register a district user account and link it to an existing district</p>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          {noDistrictsAvailable && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-3 text-sm text-amber-300">
              No districts are available for self-registration yet. Contact an administrator to create the first district.
            </div>
          )}

          <div className="space-y-4">
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

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-300" htmlFor="email">
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-300" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 8 characters"
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-300" htmlFor="confirm-password">
                Confirm password
              </label>
              <input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm password"
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || districtsLoading || noDistrictsAvailable}
            className="w-full bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-semibold py-2.5 rounded-lg text-sm transition flex items-center justify-center gap-2"
          >
            {loading ? (
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            ) : null}
            {loading ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        <p className="text-center text-sm text-slate-500">
          Already have an account?{' '}
          <Link href="/login" className="text-cyan-400 hover:text-cyan-300 transition">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
