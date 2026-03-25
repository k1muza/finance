import { NextResponse } from 'next/server'

const endpoints = [
  // Admin
  { method: 'DELETE', path: '/api/admin/delete-people' },

  // Auth
  { method: 'POST', path: '/api/auth/register' },

  // Data — district-scoped (accept ?district_id=)
  { method: 'GET', path: '/api/data/days', params: { district_id: 'uuid (required)' } },
  { method: 'GET', path: '/api/data/events', params: { district_id: 'uuid (required)' } },
  { method: 'GET', path: '/api/data/meals', params: { district_id: 'uuid (required)' } },
  { method: 'GET', path: '/api/data/pages', params: { district_id: 'uuid (required)' } },
  { method: 'GET', path: '/api/data/people', params: { district_id: 'uuid (required)' } },
  { method: 'GET', path: '/api/data/regions', params: { district_id: 'uuid (required)' } },
  { method: 'GET', path: '/api/data/sessions', params: { district_id: 'uuid (required)' } },

  // Data — not district-scoped
  { method: 'GET', path: '/api/data/districts' },
  { method: 'GET', path: '/api/data/certificates' },
  { method: 'PATCH', path: '/api/data/certificates/[id]' },
  { method: 'GET', path: '/api/data/departments' },
  { method: 'GET', path: '/api/data/songs' },

  // Import
  { method: 'POST', path: '/api/import/departments' },
  { method: 'POST', path: '/api/import/districts' },
  { method: 'POST', path: '/api/import/expenses' },
  { method: 'POST', path: '/api/import/people' },
  { method: 'POST', path: '/api/import/regions' },
  { method: 'POST', path: '/api/import/schedule' },

  // Notifications
  { method: 'POST', path: '/api/notifications/register' },
  { method: 'POST', path: '/api/notifications/send' },

  // Meta
  { method: 'GET', path: '/api/routes' },
]

export async function GET() {
  return NextResponse.json(endpoints)
}
