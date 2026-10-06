'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'

interface SidebarState {
  collapsed: boolean
  toggle: () => void
}

const SidebarStateContext = createContext<SidebarState>({ collapsed: true, toggle: () => {} })

export function SidebarStateProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(true)

  useEffect(() => {
    const update = () => setCollapsed(window.innerWidth < 1024)
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  return (
    <SidebarStateContext.Provider value={{ collapsed, toggle: () => setCollapsed((c) => !c) }}>
      {children}
    </SidebarStateContext.Provider>
  )
}

export function useSidebarState() {
  return useContext(SidebarStateContext)
}

export function SidebarToggleButton() {
  const { collapsed, toggle } = useSidebarState()
  const label = collapsed ? 'Expand sidebar' : 'Collapse sidebar'
  return (
    <button
      type="button"
      onClick={toggle}
      title={label}
      aria-label={label}
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border bg-[var(--surface-panel)] text-[var(--text-tertiary)] shadow-[var(--shadow-soft)] transition-[background-color,border-color,color,box-shadow] [border-color:var(--border-strong)] hover:bg-[var(--button-secondary-hover)] hover:text-[var(--text-primary)]"
    >
      {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
    </button>
  )
}
