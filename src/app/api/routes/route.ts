import { NextResponse } from 'next/server'

const endpoints = [
  { method: 'POST', path: '/api/auth/register' },
  { method: 'GET', path: '/api/public/districts' },
  { method: 'POST', path: '/api/import/districts' },
  { method: 'POST', path: '/api/import/income' },
  { method: 'POST', path: '/api/import/expenses' },
  { method: 'GET', path: '/api/reports/ie-docx', params: { district_id: 'uuid (optional)' } },
  { method: 'GET', path: '/api/reports/ie-pdf', params: { district_id: 'uuid (optional)' } },
  { method: 'GET', path: '/api/routes' },
]

export async function GET() {
  return NextResponse.json(endpoints)
}
