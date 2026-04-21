'use client'

import dynamic from 'next/dynamic'
import { Landmark } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'

const RegisterForm = dynamic(() => import('./RegisterForm'), {
  ssr: false,
  loading: () => <RegisterPageLoading />,
})

export default function RegisterPage() {
  return <RegisterForm />
}

function RegisterPageLoading() {
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
          <CardContent className="p-6">
            <div className="flex flex-col items-center gap-3 text-center">
              <Spinner className="h-6 w-6" />
              <div className="space-y-1">
                <p className="text-base font-semibold text-[var(--text-primary)]">Loading registration</p>
                <p className="text-sm text-[var(--text-tertiary)]">
                  Preparing the account setup form in your browser.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
