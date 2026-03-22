'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { Code2, Calendar, Users, Briefcase, Globe, Utensils, List, FileText, ExternalLink, Play } from 'lucide-react'

const endpoints = [
  {
    key: 'people',
    method: 'GET',
    path: '/api/data/people',
    label: 'People',
    icon: <Users className="h-5 w-5" />,
    description: 'All attendees with name, phone, gender, region, department, and contribution (USD).',
    example: `[
  {
    "id": "uuid",
    "name": "John Doe",
    "phone": "+1 234 567 8900",
    "gender": "male",
    "contribution": 250.00,
    "region": { "id": "uuid", "name": "Northern Region" },
    "department": { "id": "uuid", "name": "Finance" }
  }
]`,
  },
  {
    key: 'days',
    method: 'GET',
    path: '/api/data/days',
    label: 'Conference Days',
    icon: <Calendar className="h-5 w-5" />,
    description: 'All conference days with date and optional label, sorted by date.',
    example: `[
  {
    "id": "uuid",
    "date": "2026-04-10",
    "label": "Day 1 — Opening"
  }
]`,
  },
  {
    key: 'sessions',
    method: 'GET',
    path: '/api/data/sessions',
    label: 'Sessions',
    icon: <List className="h-5 w-5" />,
    description: 'All sessions with start time, duration, and the day they belong to.',
    example: `[
  {
    "id": "uuid",
    "day_id": "uuid",
    "day": { "id": "uuid", "date": "2026-04-10", "label": "Day 1" },
    "name": "Morning Worship",
    "start_time": "09:00:00",
    "allocated_duration": 120
  }
]`,
  },
  {
    key: 'events',
    method: 'GET',
    path: '/api/data/events',
    label: 'Events',
    icon: <FileText className="h-5 w-5" />,
    description: 'All events within sessions, including allocated speaker/person.',
    example: `[
  {
    "id": "uuid",
    "session_id": "uuid",
    "session": { "id": "uuid", "name": "Morning Worship", "day": { ... } },
    "title": "Welcome Address",
    "allocated_person": { "id": "uuid", "name": "Jane Smith" },
    "start_time": "09:00:00",
    "duration": 30
  }
]`,
  },
  {
    key: 'meals',
    method: 'GET',
    path: '/api/data/meals',
    label: 'Meals',
    icon: <Utensils className="h-5 w-5" />,
    description: 'All scheduled meals with time and duration, linked to their conference day.',
    example: `[
  {
    "id": "uuid",
    "day_id": "uuid",
    "day": { "id": "uuid", "date": "2026-04-10", "label": "Day 1" },
    "name": "Lunch",
    "scheduled_time": "12:00:00",
    "duration": 45
  }
]`,
  },
  {
    key: 'departments',
    method: 'GET',
    path: '/api/data/departments',
    label: 'Departments',
    icon: <Briefcase className="h-5 w-5" />,
    description: 'All departments with HOD and a list of members.',
    example: `[
  {
    "id": "uuid",
    "name": "Finance",
    "hod": "Mary Johnson",
    "members": [
      { "id": "uuid", "name": "John Doe" }
    ]
  }
]`,
  },
  {
    key: 'regions',
    method: 'GET',
    path: '/api/data/regions',
    label: 'Regions & Districts',
    icon: <Globe className="h-5 w-5" />,
    description: 'All districts with their regions nested, including leadership roles for each.',
    example: `[
  {
    "id": "uuid",
    "name": "Northern District",
    "chairperson": "Rev. Thomas",
    "vice_chairperson": "Pastor Grace",
    "secretary": "Elder Paul",
    "vice_secretary": null,
    "regions": [
      {
        "id": "uuid",
        "name": "Northern Region",
        "chairperson": "Deacon Mark",
        ...
      }
    ]
  }
]`,
  },
]

export default function ApiReferencePage() {
  const [preview, setPreview] = useState<{ open: boolean; key: string | null; data: unknown; loading: boolean }>({
    open: false, key: null, data: null, loading: false,
  })

  const testEndpoint = async (path: string, key: string) => {
    setPreview({ open: true, key, data: null, loading: true })
    try {
      const res = await fetch(path)
      const data = await res.json()
      setPreview({ open: true, key, data, loading: false })
    } catch (e) {
      setPreview({ open: true, key, data: { error: String(e) }, loading: false })
    }
  }

  const activeEndpoint = endpoints.find((e) => e.key === preview.key)

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Code2 className="h-7 w-7 text-cyan-400" />
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Mobile App API</h1>
          <p className="text-sm text-slate-400 mt-1">
            REST endpoints your mobile app can fetch directly — all served from this dashboard
          </p>
        </div>
      </div>

      {/* Base URL banner */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 px-5 py-4">
        <p className="text-xs text-slate-500 mb-1 uppercase tracking-wider font-medium">Base URL</p>
        <div className="flex items-center gap-3">
          <code className="text-cyan-400 font-mono text-sm flex-1">
            https://your-dashboard-domain.com
          </code>
          <span className="text-xs text-slate-500">All endpoints are GET requests · Returns JSON</span>
        </div>
      </div>

      {/* Endpoint cards */}
      <div className="space-y-3">
        {endpoints.map((ep) => (
          <div key={ep.key} className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
            <div className="flex items-start gap-4 px-5 py-4">
              <div className="bg-slate-700 rounded-lg p-2 text-slate-300 shrink-0 mt-0.5">{ep.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold bg-cyan-500/15 text-cyan-400 px-2 py-0.5 rounded font-mono">
                    GET
                  </span>
                  <code className="text-sm font-mono text-slate-100">{ep.path}</code>
                </div>
                <p className="text-sm text-slate-400 mt-1">{ep.description}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => testEndpoint(ep.path, ep.key)}
                >
                  <Play className="h-3.5 w-3.5" /> Test
                </Button>
                <a
                  href={ep.path}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg text-slate-400 hover:bg-slate-700 hover:text-slate-100 transition"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Open
                </a>
              </div>
            </div>

            {/* Example response */}
            <details className="border-t border-slate-700">
              <summary className="px-5 py-2.5 text-xs text-slate-500 cursor-pointer hover:text-slate-300 transition select-none">
                Example response
              </summary>
              <pre className="px-5 py-3 text-xs text-green-300 font-mono overflow-x-auto bg-slate-950 border-t border-slate-700">
                {ep.example}
              </pre>
            </details>
          </div>
        ))}
      </div>

      {/* Live test modal */}
      <Modal
        open={preview.open}
        onClose={() => setPreview({ open: false, key: null, data: null, loading: false })}
        title={`GET ${activeEndpoint?.path ?? ''}`}
        size="xl"
      >
        {preview.loading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : (
          <pre className="bg-slate-950 rounded-lg p-4 text-xs text-green-300 overflow-auto max-h-[60vh] font-mono">
            {JSON.stringify(preview.data, null, 2)}
          </pre>
        )}
      </Modal>
    </div>
  )
}
