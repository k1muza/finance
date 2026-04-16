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
          'inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 bg-slate-800 text-slate-400 transition-colors hover:border-slate-600 hover:text-slate-100',
          className,
        )}
      >
        <Settings2 className="h-4 w-4" />
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="UI Settings" size="lg">
        <div className="space-y-6">
          <section className="rounded-2xl border border-slate-700 bg-slate-800/70 p-4">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-cyan-500/10 p-2 text-cyan-400">
                <Palette className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-slate-100">Appearance</h3>
                <p className="text-sm text-slate-400">
                  Choose how the finance workspace should look in this browser. Changes apply immediately.
                </p>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <div>
              <p className="text-sm font-medium text-slate-200">Theme</p>
              <p className="text-sm text-slate-500">Choose from several workspace themes. Changes apply immediately.</p>
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
                      'rounded-2xl border p-4 text-left transition-colors',
                      isActive
                        ? 'border-cyan-500 bg-cyan-500/10 shadow-[0_0_0_1px_rgba(6,182,212,0.15)]'
                        : 'border-slate-700 bg-slate-900/70 hover:border-slate-600 hover:bg-slate-800/80',
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            'rounded-xl p-2',
                            isActive ? 'bg-cyan-500/15 text-cyan-400' : 'bg-slate-800 text-slate-400',
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-100">{label}</p>
                          <p className="mt-1 text-xs text-slate-500">{description}</p>
                        </div>
                      </div>
                      <span
                        className={cn(
                          'shrink-0 rounded-full border px-2 py-1 text-[11px] font-medium uppercase tracking-wide',
                          isActive
                            ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-400'
                            : 'border-slate-700 text-slate-500',
                        )}
                      >
                        {isActive ? 'Active' : 'Select'}
                      </span>
                    </div>

                    <div
                      className="mt-4 overflow-hidden rounded-xl border border-slate-700/70"
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
                          className="rounded-lg border border-black/10"
                          style={{ backgroundColor: preview.panel, height: 44 }}
                        />
                        <div className="flex flex-col gap-2">
                          <div
                            className="rounded-lg"
                            style={{ backgroundColor: preview.accent, height: 18 }}
                          />
                          <div
                            className="rounded-lg border border-black/10"
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
