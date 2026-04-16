import { NextResponse } from 'next/server'

export class ApiRouteError extends Error {
  code: string
  status: number

  constructor(code: string, message: string, status = 422) {
    super(message)
    this.name = 'ApiRouteError'
    this.code = code
    this.status = status
  }
}

export function toErrorResponse(
  error: unknown,
  fallbackMessage = 'Unexpected server error',
) {
  if (error instanceof ApiRouteError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status },
    )
  }

  const message = error instanceof Error ? error.message : fallbackMessage

  return NextResponse.json(
    { error: message, code: 'INTERNAL_ERROR' },
    { status: 500 },
  )
}
