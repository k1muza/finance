'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useAppUiStore } from '@/stores/app-ui-store'
import { districtPath } from '@/lib/district-routes'

// Submitting hands the query to the cashbook search for the active district.
export function GlobalSearch() {
  const router = useRouter()
  const { districtId } = useAuth()
  const setCashbookFilterDraft = useAppUiStore((state) => state.setCashbookFilterDraft)
  const [query, setQuery] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!districtId) return
    setCashbookFilterDraft(districtId, { search: query.trim() })
    router.push(districtPath(districtId, 'cashbook'))
  }

  return (
    <form
      role="search"
      onSubmit={handleSubmit}
      className="flex w-full max-w-md items-center gap-2 rounded-sm border border-slate-700 bg-slate-900/80 px-3 py-2"
    >
      <Search className="h-4 w-4 shrink-0 text-slate-500" />
      <input
        type="search"
        aria-label="Search transactions"
        className="w-full bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500 disabled:cursor-not-allowed"
        placeholder={districtId ? 'Search transactions...' : 'Select a district to search'}
        disabled={!districtId}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
    </form>
  )
}
