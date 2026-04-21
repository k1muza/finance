import { Flame, Leaf, Moon, Sun, Waves, type LucideIcon } from 'lucide-react'

export const APP_THEMES = ['dark', 'light', 'ocean', 'forest', 'ember'] as const

export type ThemeOption = (typeof APP_THEMES)[number]

export interface ThemeMeta {
  value: ThemeOption
  label: string
  description: string
  icon: LucideIcon
  preview: {
    canvas: string
    shell: string
    panel: string
    accent: string
  }
}

export const THEME_OPTIONS: ThemeMeta[] = [
  {
    value: 'dark',
    label: 'Dark',
    description: 'A shadcn-style dark workspace with zinc surfaces and monochrome actions.',
    icon: Moon,
    preview: {
      canvas: '#09090b',
      shell: '#111113',
      panel: '#18181b',
      accent: '#fafafa',
    },
  },
  {
    value: 'light',
    label: 'Light',
    description: 'A shadcn-style light workspace with soft neutrals and restrained contrast.',
    icon: Sun,
    preview: {
      canvas: '#fafafa',
      shell: '#f4f4f5',
      panel: '#ffffff',
      accent: '#18181b',
    },
  },
  {
    value: 'ocean',
    label: 'Ocean',
    description: 'Deep blue surfaces with clearer sky-toned accents.',
    icon: Waves,
    preview: {
      canvas: '#06141f',
      shell: '#0b1f2d',
      panel: '#10293b',
      accent: '#0ea5e9',
    },
  },
  {
    value: 'forest',
    label: 'Forest',
    description: 'Muted evergreen panels with fresh mint accents.',
    icon: Leaf,
    preview: {
      canvas: '#0d1713',
      shell: '#16211c',
      panel: '#1e2d27',
      accent: '#22c55e',
    },
  },
  {
    value: 'ember',
    label: 'Ember',
    description: 'Warm charcoal tones with amber action highlights.',
    icon: Flame,
    preview: {
      canvas: '#1a120d',
      shell: '#241913',
      panel: '#32231b',
      accent: '#f59e0b',
    },
  },
]
