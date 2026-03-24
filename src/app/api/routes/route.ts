import { NextResponse } from 'next/server'

const endpoints = [
  // Admin
  { method: 'DELETE', path: '/api/admin/delete-people' },

  // Auth
  { method: 'POST', path: '/api/auth/register' },

  // Data
  { method: 'GET', path: '/api/data/certificates' },
  { method: 'PATCH', path: '/api/data/certificates/[id]' },
  { method: 'GET', path: '/api/data/days' },
  { method: 'GET', path: '/api/data/departments' },
  { method: 'GET', path: '/api/data/events' },
  { method: 'GET', path: '/api/data/meals' },
  { method: 'GET', path: '/api/data/pages' },
  { method: 'GET', path: '/api/data/people' },
  { method: 'GET', path: '/api/data/regions' },
  { method: 'GET', path: '/api/data/sessions' },
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
