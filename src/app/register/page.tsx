'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Church } from 'lucide-react'

const registrationEnabled = process.env.NEXT_PUBLIC_REGISTRATION_ENABLED === 'true'

export default function RegisterPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const supabase = createClient()

  // Redirect if already logged in
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace('/dashboard/overview')
    })
  }, []) // eslint-disable-line

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

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
      body: JSON.stringify({ email, password }),
    })

    const json = await res.json()

    if (!res.ok) {
      setError(json.error ?? 'Registration failed. Please try again.')
      setLoading(false)
    } else {
      setSuccess(true)
    }
  }

  // Registration disabled state
  if (!registrationEnabled) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
        <div className="w-full max-w-sm space-y-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 mb-4">
            <Church className="h-8 w-8 text-cyan-400" />
          </div>
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 space-y-4">
            <p className="text-base font-semibold text-slate-100">Registration closed</p>
            <p className="text-sm text-slate-400">
              New account registration is currently disabled. Contact your administrator to get access.
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

  // Success state
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
        <div className="w-full max-w-sm space-y-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 mb-4">
            <Church className="h-8 w-8 text-cyan-400" />
          </div>
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 space-y-4">
            <p className="text-base font-semibold text-slate-100">Account created</p>
            <p className="text-sm text-slate-400">
              Your account has been created successfully. You can now sign in.
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
      <div className="w-full max-w-sm space-y-8">
        {/* Logo */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 mb-4">
            <Church className="h-8 w-8 text-cyan-400" />
          </div>
          <h1 className="text-2xl font-bold text-slate-100">Conference</h1>
          <p className="text-sm text-slate-400 mt-1">
            ZAOGA FIF · Easter Conference 2026
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleRegister} className="bg-slate-900 border border-slate-700 rounded-2xl p-6 space-y-5">
          <div>
            <p className="text-base font-semibold text-slate-100 mb-1">Create account</p>
            <p className="text-sm text-slate-400">Register an admin account</p>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <div className="space-y-4">
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
                placeholder="••••••••"
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-semibold py-2.5 rounded-lg text-sm transition flex items-center justify-center gap-2"
          >
            {loading ? (
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            ) : null}
            {loading ? 'Creating account…' : 'Create account'}
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
