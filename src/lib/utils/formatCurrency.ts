import type { Currency } from '@/types'

export function formatCurrency(amount: number, currency: Currency = 'USD'): string {
  if (currency === 'ZWG') {
    return 'ZWG ' + new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)
  }
  return new Intl.NumberFormat(currency === 'ZAR' ? 'en-ZA' : 'en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount)
}
