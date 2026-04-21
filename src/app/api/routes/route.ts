import { NextResponse } from 'next/server'

const endpoints = [
  { method: 'POST', path: '/api/auth/register' },
  { method: 'GET', path: '/api/public/districts' },
  { method: 'POST', path: '/api/import/districts' },
  { method: 'GET', path: '/api/transfers?district_id={districtId}' },
  { method: 'POST', path: '/api/transfers' },
  { method: 'GET', path: '/api/transfers/{id}' },
  { method: 'PATCH', path: '/api/transfers/{id}' },
  { method: 'POST', path: '/api/transfers/{id}/post' },
  { method: 'POST', path: '/api/transfers/{id}/reverse' },
  { method: 'POST', path: '/api/transfers/{id}/void' },
  { method: 'GET', path: '/api/routes' },
]

export async function GET() {
  return NextResponse.json(endpoints)
}
