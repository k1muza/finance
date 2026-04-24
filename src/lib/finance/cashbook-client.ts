import { createClient } from '@/lib/supabase/client'
import type { CashbookBulkAction } from '@/lib/finance/cashbook-bulk-actions'

interface SubmitCashbookTransactionsResponse {
  count: number
  data: Array<Record<string, unknown>>
}

async function getCashbookAccessToken() {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')

  return session.access_token
}

async function callCashbookAction(
  accessToken: string,
  path: string,
  body?: Record<string, unknown>,
) {
  const res = await fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error ?? 'Failed to complete transaction action')
  return json.data
}

export async function performCashbookBulkAction(
  ids: string[],
  action: CashbookBulkAction,
) {
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)))

  if (uniqueIds.length === 0) {
    return {
      count: 0,
      data: [],
    } satisfies SubmitCashbookTransactionsResponse
  }

  if (action === 'submit') {
    const accessToken = await getCashbookAccessToken()
    const res = await fetch('/api/cashbook/transactions/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ ids: uniqueIds }),
    })

    const json = await res.json()
    if (!res.ok) throw new Error(json.error ?? 'Failed to submit transactions')

    return json as SubmitCashbookTransactionsResponse
  }

  const accessToken = await getCashbookAccessToken()
  const data: Array<Record<string, unknown>> = []

  for (const id of uniqueIds) {
    const routeAction = action === 'void' ? 'void' : action
    const actionResult = await callCashbookAction(
      accessToken,
      `/api/cashbook/transactions/${id}/${routeAction}`,
    )
    data.push((actionResult ?? {}) as Record<string, unknown>)
  }

  return {
    count: data.length,
    data,
  } satisfies SubmitCashbookTransactionsResponse
}

export async function submitCashbookTransactions(ids: string[]) {
  return performCashbookBulkAction(ids, 'submit')
}
