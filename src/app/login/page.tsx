'use client'

import dynamic from 'next/dynamic'
import { Landmark } from 'lucide-react'
import { Spinner } from '@/components/ui/Spinner'

const LoginForm = dynamic(() => import('./LoginForm'), {
  ssr: false,
  loading: () => <LoginPageLoading />,
})

export default function LoginPage() {
  return <LoginForm />
}

function LoginPageLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 mb-4">
            <Landmark className="h-8 w-8 text-cyan-400" />
          </div>
          <h1 className="text-2xl font-bold text-slate-100">District Finance Dashboard</h1>
          <p className="text-sm text-slate-400 mt-1">
            Secure district income and expenditure tracking
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6">
          <div className="flex flex-col items-center gap-3 text-center">
            <Spinner className="h-6 w-6" />
            <div className="space-y-1">
              <p className="text-base font-semibold text-slate-100">Loading sign in</p>
              <p className="text-sm text-slate-400">
                Preparing the secure sign-in form in your browser.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
