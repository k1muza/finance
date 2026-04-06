import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Conference',
    short_name: 'Conference',
    description: 'Conference schedules, people, and leaderboard',
    start_url: '/dashboard/overview',
    display: 'standalone',
    background_color: '#020617', // slate-950 to match app bg
    theme_color: '#020617',
    icons: [
      {
        src: '/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}
