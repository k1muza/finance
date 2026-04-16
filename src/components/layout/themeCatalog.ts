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
    description: 'The original low-glare workspace with cyan highlights.',
    icon: Moon,
    preview: {
      canvas: '#020617',
      shell: '#0f172a',
      panel: '#1e293b',
      accent: '#06b6d4',
    },
  },
  {
    value: 'light',
    label: 'Light',
    description: 'A bright slate-based canvas for daytime work.',
    icon: Sun,
    preview: {
      canvas: '#f8fafc',
      shell: '#f1f5f9',
      panel: '#ffffff',
      accent: '#06b6d4',
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
