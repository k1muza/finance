'use client'

import { useState, useRef, useEffect, useId } from 'react'
import { cn } from '@/lib/utils/cn'
import { ChevronDown, Search, X } from 'lucide-react'

interface SearchableSelectProps {
  label?: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
  placeholder?: string
  disabled?: boolean
}

export function SearchableSelect({
  label,
  value,
  onChange,
  options,
  placeholder = 'Select…',
  disabled,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const id = useId()

  const selected = options.find((o) => o.value === value)

  const filtered = query.trim()
    ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
    : options

  useEffect(() => {
    if (open) {
      setQuery('')
      // Focus the search input after the dropdown renders
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [])

  const select = (val: string) => {
    onChange(val)
    setOpen(false)
  }

  return (
    <div className="relative flex flex-col gap-1" ref={containerRef}>
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-[var(--text-secondary)]">
          {label}
        </label>
      )}
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex w-full items-center justify-between gap-2 rounded-[var(--radius-sm)] border bg-[var(--field-bg)] px-3 py-2 text-left text-sm shadow-[var(--field-shadow)] transition-[background-color,border-color,box-shadow] outline-none [border-color:var(--field-border)] hover:[border-color:var(--field-border-hover)]',
          open && 'ring-2 ring-[var(--accent-ring)] [border-color:var(--accent-border)]',
          disabled && 'cursor-not-allowed opacity-50',
        )}
      >
        <span className={cn('truncate', !selected && 'text-[var(--text-muted)]')}>
          {selected ? selected.label : placeholder}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          {value && (
            <span
              role="button"
              tabIndex={0}
              aria-label="Clear selection"
              className="rounded p-0.5 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              onClick={(e) => { e.stopPropagation(); select('') }}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); select('') } }}
            >
              <X className="h-3 w-3" />
            </span>
          )}
          <ChevronDown className={cn('h-4 w-4 text-[var(--text-muted)] transition-transform duration-150', open && 'rotate-180')} />
        </span>
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-[var(--radius-sm)] border [border-color:var(--field-border)] bg-[var(--field-bg)] shadow-xl">
          <div className="flex items-center gap-2 border-b px-3 py-2 [border-color:var(--field-border)]">
            <Search className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
            <input
              ref={inputRef}
              className="w-full bg-transparent text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
              placeholder="Search…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false) }}
            />
          </div>
          <ul className="max-h-56 overflow-y-auto py-1">
            {placeholder && !query && (
              <li>
                <button
                  type="button"
                  onClick={() => select('')}
                  className={cn(
                    'w-full px-3 py-2 text-left text-sm text-[var(--text-muted)] hover:bg-[var(--surface-hover)]',
                    !value && 'bg-[var(--accent-soft)] text-[var(--text-primary)]',
                  )}
                >
                  {placeholder}
                </button>
              </li>
            )}
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-[var(--text-muted)]">No results</li>
            ) : (
              filtered.map((opt) => (
                <li key={opt.value}>
                  <button
                    type="button"
                    onClick={() => select(opt.value)}
                    className={cn(
                      'w-full px-3 py-2 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--surface-hover)]',
                      value === opt.value && 'bg-[var(--accent-soft)] font-medium',
                    )}
                  >
                    {opt.label}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
