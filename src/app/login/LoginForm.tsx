'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Landmark } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { createClient } from '@/lib/supabase/client'

const registrationEnabled = process.env.NEXT_PUBLIC_REGISTRATION_ENABLED === 'true'

export default function LoginForm() {
  const router = useRouter()
  const [supabase] = useState(() => createClient())
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return
    setLoading(true)
    setError('')

    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      setError(authError.message)
      setLoading(false)
    } else {
      router.push('/dashboard/overview')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--surface-app)] p-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-[var(--radius-2xl)] border bg-[var(--accent-soft)] [border-color:var(--accent-border)]">
            <Landmark className="h-8 w-8 text-[var(--theme-accent-400)]" />
          </div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">District Finance Dashboard</h1>
          <p className="mt-1 text-sm text-[var(--text-tertiary)]">
            Secure district income and expenditure tracking
          </p>
        </div>

        <Card>
          <CardContent className="space-y-5 p-6">
            <div>
              <p className="mb-1 text-base font-semibold text-[var(--text-primary)]">Sign in</p>
              <p className="text-sm text-[var(--text-tertiary)]">Enter your finance dashboard credentials</p>
            </div>

            {error && (
              <div className="rounded-[var(--radius-sm)] border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
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
                autoComplete="current-password"
                required
                label="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
              />

              <Button type="submit" disabled={loading} loading={loading} className="w-full">
                {loading ? 'Signing in...' : 'Sign in'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {registrationEnabled ? (
          <p className="text-center text-sm text-[var(--text-muted)]">
            Don&apos;t have an account?{' '}
            <Link href="/register" className="text-[var(--theme-accent-400)] transition-colors hover:text-[var(--theme-accent-300)]">
              Create one
            </Link>
          </p>
        ) : (
          <p className="text-center text-xs text-[var(--text-muted)]">
            Contact your administrator if you need access.
          </p>
        )}
      </div>
    </div>
  )
}
