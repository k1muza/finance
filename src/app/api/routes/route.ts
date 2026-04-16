import { NextResponse } from 'next/server'

const endpoints = [
  { method: 'POST', path: '/api/auth/register' },
  { method: 'GET', path: '/api/public/districts' },
  { method: 'POST', path: '/api/import/districts' },
  { method: 'GET', path: '/api/routes' },
]

export async function GET() {
  return NextResponse.json(endpoints)
}
