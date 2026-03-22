'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Search, X } from 'lucide-react'
import { Person } from '@/types'

interface Props {
  label: string
  value: string
  onChange: (value: string) => void
  people: Person[]
  required?: boolean
  /** 'name' (default): value is person name string. 'id': value is person UUID. */
  valueMode?: 'name' | 'id'
}

export function PersonPicker({ label, value, onChange, people, required, valueMode = 'name' }: Props) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = people.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  )

  const displayValue =
    valueMode === 'id'
      ? (people.find((p) => p.id === value)?.name ?? '')
      : value

  const isActive = (p: Person) =>
    valueMode === 'id' ? p.id === value : p.name === value

  const handleSelect = (person: Person) => {
    onChange(valueMode === 'id' ? person.id : person.name)
    setOpen(false)
    setSearch('')
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange('')
  }

  return (
    <div className="flex flex-col gap-1" ref={containerRef}>
      <label className="text-sm font-medium text-slate-300">
        {label}{required && ' *'}
      </label>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="w-full flex items-center justify-between rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-left transition focus:outline-none focus:ring-2 focus:ring-cyan-500"
        >
          <span className={displayValue ? 'text-slate-100' : 'text-slate-500'}>
            {displayValue || 'Select person…'}
          </span>
          <div className="flex items-center gap-1 shrink-0">
            {value && (
              <span
                role="button"
                onClick={handleClear}
                className="text-slate-400 hover:text-slate-200 p-0.5 rounded"
              >
                <X className="h-3.5 w-3.5" />
              </span>
            )}
            <ChevronDown className="h-4 w-4 text-slate-400" />
          </div>
        </button>

        {open && (
          <div className="absolute z-50 w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl overflow-hidden">
            <div className="p-2 border-b border-slate-700">
              <div className="flex items-center gap-2 px-2 py-1.5 bg-slate-700/50 rounded-md">
                <Search className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <input
                  autoFocus
                  type="text"
                  placeholder="Search people…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none flex-1 min-w-0"
                />
              </div>
            </div>
            <div className="max-h-48 overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-4">No match</p>
              ) : (
                filtered.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSelect(p)}
                    className={`w-full text-left px-3 py-2 text-sm transition-colors hover:bg-slate-700 ${
                      isActive(p) ? 'text-cyan-400 bg-cyan-500/10' : 'text-slate-200'
                    }`}
                  >
                    {p.name}
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
