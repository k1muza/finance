'use client'

import { useState } from 'react'
import { useTheme } from 'next-themes'
import { Palette, Settings2 } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { cn } from '@/lib/utils/cn'
import { THEME_OPTIONS, type ThemeOption } from '@/components/layout/themeCatalog'

interface UiSettingsButtonProps {
  className?: string
}

export function UiSettingsButton({ className }: UiSettingsButtonProps) {
  const [open, setOpen] = useState(false)
  const { theme, setTheme } = useTheme()

  const activeTheme: ThemeOption =
    THEME_OPTIONS.find((option) => option.value === theme)?.value ?? 'dark'

  return (
    <>
      <button
        type="button"
        aria-label="Open UI settings"
        title="UI settings"
        onClick={() => setOpen(true)}
        className={cn(
          'inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] border bg-[var(--surface-panel)] text-[var(--text-tertiary)] shadow-[var(--shadow-soft)] transition-[background-color,border-color,color,box-shadow] [border-color:var(--border-strong)] hover:bg-[var(--button-secondary-hover)] hover:text-[var(--text-primary)]',
          className,
        )}
      >
        <Settings2 className="h-4 w-4" />
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="UI Settings" size="lg">
        <div className="space-y-6">
          <section className="rounded-[var(--radius-xl)] border bg-[var(--surface-panel-muted)] p-4 shadow-[var(--shadow-soft)] [border-color:var(--border-subtle)]">
            <div className="flex items-start gap-3">
              <div className="rounded-[var(--radius-md)] bg-[var(--accent-soft)] p-2 text-[var(--accent-solid-hover)]">
                <Palette className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">Appearance</h3>
                <p className="text-sm text-[var(--text-tertiary)]">
                  Choose how the finance workspace should look in this browser. Changes apply immediately.
                </p>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <div>
              <p className="text-sm font-medium text-[var(--text-secondary)]">Theme</p>
              <p className="text-sm text-[var(--text-muted)]">Choose from several workspace themes. Changes apply immediately.</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {THEME_OPTIONS.map(({ value, label, description, icon: Icon, preview }) => {
                const isActive = activeTheme === value

                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setTheme(value)}
                    className={cn(
                      'rounded-[var(--radius-xl)] border p-4 text-left transition-[background-color,border-color,box-shadow,transform] hover:-translate-y-0.5',
                      isActive
                        ? 'bg-[var(--accent-soft)] shadow-[var(--shadow-card)] [border-color:var(--accent-border)]'
                        : 'bg-[var(--surface-panel)] shadow-[var(--shadow-soft)] [border-color:var(--border-strong)] hover:bg-[var(--surface-panel-muted)]',
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            'rounded-[var(--radius-md)] p-2',
                            isActive
                              ? 'bg-[var(--accent-soft-strong)] text-[var(--accent-solid-hover)]'
                              : 'bg-[var(--surface-panel-muted)] text-[var(--text-tertiary)]',
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-[var(--text-primary)]">{label}</p>
                          <p className="mt-1 text-xs text-[var(--text-muted)]">{description}</p>
                        </div>
                      </div>
                      <span
                        className={cn(
                          'shrink-0 rounded-full border px-2 py-1 text-[11px] font-medium uppercase tracking-wide',
                          isActive
                            ? 'bg-[var(--accent-soft)] text-[var(--accent-solid-hover)] [border-color:var(--accent-border)]'
                            : 'text-[var(--text-muted)] [border-color:var(--border-subtle)]',
                        )}
                      >
                        {isActive ? 'Active' : 'Select'}
                      </span>
                    </div>

                    <div
                      className="mt-4 overflow-hidden rounded-[var(--radius-lg)] border [border-color:var(--border-subtle)]"
                      aria-hidden="true"
                    >
                      <div
                        className="h-7 border-b border-black/10"
                        style={{ backgroundColor: preview.canvas }}
                      />
                      <div
                        className="grid grid-cols-[1.2fr_0.8fr] gap-2 p-2"
                        style={{ backgroundColor: preview.shell }}
                      >
                        <div
                          className="rounded-[calc(var(--radius-md)-2px)] border border-black/10"
                          style={{ backgroundColor: preview.panel, height: 44 }}
                        />
                        <div className="flex flex-col gap-2">
                          <div
                            className="rounded-[calc(var(--radius-md)-2px)]"
                            style={{ backgroundColor: preview.accent, height: 18 }}
                          />
                          <div
                            className="rounded-[calc(var(--radius-md)-2px)] border border-black/10"
                            style={{ backgroundColor: preview.panel, height: 18 }}
                          />
                        </div>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </section>
        </div>
      </Modal>
    </>
  )
}
