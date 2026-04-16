import type { Currency } from '@/types'

export function formatCurrency(amount: number, currency: Currency = 'USD'): string {
  // ZWG is not a recognised ISO 4217 code in most runtimes; format manually.
  if (currency === 'ZWG') {
    return 'ZWG ' + new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)
  }

  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
    }).format(amount)
  } catch {
    // Unknown / non-standard currency code — fall back to plain number + code
    return `${currency} ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)}`
  }
}
