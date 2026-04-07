'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { Search, Users, Globe, FileText, Music, X } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

type ResultType = 'person' | 'region' | 'page' | 'song'

interface SearchResult {
  id: string
  type: ResultType
  title: string
  subtitle?: string
  href: string
}

const TYPE_META: Record<ResultType, { label: string; icon: React.ReactNode; color: string }> = {
  person:  { label: 'People',  icon: <Users     className="h-3.5 w-3.5" />, color: 'text-cyan-400' },
  region:  { label: 'Regions', icon: <Globe     className="h-3.5 w-3.5" />, color: 'text-violet-400' },
  page:    { label: 'Pages',   icon: <FileText  className="h-3.5 w-3.5" />, color: 'text-amber-400' },
  song:    { label: 'Songs',   icon: <Music     className="h-3.5 w-3.5" />, color: 'text-green-400' },
}

const LIMIT = 4

export function GlobalSearch({ className }: { className?: string }) {
  const { districtId } = useAuth()
  const router = useRouter()
  const supabase = createClient()

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)

  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const search = useCallback(async (term: string) => {
    if (term.length < 2) { setResults([]); setOpen(false); return }
    setLoading(true)
    const like = `%${term}%`

    const queries: Promise<SearchResult[]>[] = []

    // People — scoped to active district via regions inner join
    queries.push(
      (async () => {
        let q = supabase
          .from('people')
          .select('id, name, regions!inner(name, district_id)')
          .ilike('name', like)
          .limit(LIMIT)
        if (districtId) q = q.eq('regions.district_id', districtId)
        const { data } = await q
        return (data ?? []).map((r) => ({
          id: r.id,
          type: 'person' as const,
          title: r.name,
          subtitle: (r.regions as unknown as { name: string })?.name,
          href: `/dashboard/people`,
        }))
      })()
    )

    // Regions — scoped to active district
    queries.push(
      (async () => {
        let q = supabase
          .from('regions')
          .select('id, name')
          .ilike('name', like)
          .limit(LIMIT)
        if (districtId) q = q.eq('district_id', districtId)
        const { data } = await q
        return (data ?? []).map((r) => ({
          id: r.id,
          type: 'region' as const,
          title: r.name,
          href: `/dashboard/regions`,
        }))
      })()
    )

    // Pages — title search, scoped to active district
    queries.push(
      (async () => {
        let q = supabase
          .from('pages')
          .select('id, title, slug')
          .ilike('title', like)
          .limit(LIMIT)
        if (districtId) q = q.eq('district_id', districtId)
        const { data } = await q
        return (data ?? []).map((r) => ({
          id: r.id,
          type: 'page' as const,
          title: r.title,
          href: `/dashboard/pages`,
        }))
      })()
    )

    // Songs — title + author, global
    queries.push(
      (async () => {
        const { data } = await supabase
          .from('songs')
          .select('id, title, author')
          .or(`title.ilike.${like},author.ilike.${like}`)
          .limit(LIMIT)
        return (data ?? []).map((r) => ({
          id: r.id,
          type: 'song' as const,
          title: r.title,
          subtitle: r.author ?? undefined,
          href: `/dashboard/songs`,
        }))
      })()
    )

    const groups = await Promise.all(queries)
    setResults(groups.flat())
    setOpen(true)
    setLoading(false)
    setActiveIndex(-1)
  }, [districtId]) // eslint-disable-line

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(query), 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, search])

  // Close on outside click
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [])

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, -1))
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault()
      navigate(results[activeIndex])
    } else if (e.key === 'Escape') {
      setOpen(false)
      inputRef.current?.blur()
    }
  }

  const navigate = (result: SearchResult) => {
    router.push(result.href)
    setOpen(false)
    setQuery('')
  }

  const clear = () => {
    setQuery('')
    setResults([])
    setOpen(false)
    inputRef.current?.focus()
  }

  // Group results by type
  const grouped = (['person', 'region', 'page', 'song'] as ResultType[]).reduce<
    { type: ResultType; items: SearchResult[] }[]
  >((acc, type) => {
    const items = results.filter((r) => r.type === type)
    if (items.length) acc.push({ type, items })
    return acc
  }, [])

  return (
    <div ref={containerRef} className={cn("relative w-80", className)}>
      {/* Input */}
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 focus-within:border-cyan-500/50 transition-colors">
        <Search className={cn('h-3.5 w-3.5 shrink-0 transition-colors', loading ? 'text-cyan-400 animate-pulse' : 'text-slate-500')} />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search people, regions, pages, songs…"
          className="flex-1 bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none min-w-0"
        />
        {query && (
          <button type="button" onClick={clear} className="text-slate-500 hover:text-slate-300 transition-colors shrink-0">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {open && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden">
          {grouped.map(({ type, items }) => {
            const meta = TYPE_META[type]
            return (
              <div key={type}>
                <div className={cn('flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium', meta.color)}>
                  {meta.icon}
                  {meta.label}
                </div>
                {items.map((result) => {
                  const flatIndex = results.indexOf(result)
                  return (
                    <button
                      key={result.id}
                      type="button"
                      onClick={() => navigate(result)}
                      className={cn(
                        'flex items-center justify-between w-full px-3 py-2 text-sm transition-colors text-left',
                        flatIndex === activeIndex
                          ? 'bg-slate-700 text-slate-100'
                          : 'text-slate-300 hover:bg-slate-800 hover:text-slate-100'
                      )}
                    >
                      <span className="truncate">{result.title}</span>
                      {result.subtitle && (
                        <span className="text-xs text-slate-500 ml-2 shrink-0">{result.subtitle}</span>
                      )}
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}

      {open && query.length >= 2 && !loading && results.length === 0 && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 px-3 py-4 text-center text-sm text-slate-500">
          No results for &ldquo;{query}&rdquo;
        </div>
      )}
    </div>
  )
}
