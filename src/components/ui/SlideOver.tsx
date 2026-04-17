'use client'

import { useEffect, ReactNode } from 'react'
import { X } from 'lucide-react'

interface SlideOverProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}

export function SlideOver({ open, onClose, title, children }: SlideOverProps) {
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div
        className="absolute inset-0 bg-[var(--surface-overlay)] backdrop-blur-[var(--overlay-blur)]"
        onClick={onClose}
      />
      <div className="relative flex h-full w-full max-w-md flex-col rounded-l-[var(--radius-xl)] border-l bg-[var(--surface-elevated)] shadow-[var(--shadow-popover)] backdrop-blur-[var(--panel-blur)] [border-color:var(--border-strong)]">
        <div className="flex shrink-0 items-center justify-between border-b px-6 py-4 [border-color:var(--border-subtle)]">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">{title}</h2>
          <button onClick={onClose} className="text-[var(--text-tertiary)] transition hover:text-[var(--text-primary)]">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4 text-[var(--text-secondary)]">{children}</div>
      </div>
    </div>
  )
}
