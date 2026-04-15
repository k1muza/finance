import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { parseCsv } from '@/lib/csv'
import type { Currency, PaymentMethod } from '@/types'

const VALID_CURRENCIES: Currency[] = ['USD', 'ZAR', 'ZWG']
const VALID_PAYMENT_METHODS: PaymentMethod[] = ['cash', 'bank', 'ecocash']

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    const districtIdParam = (formData.get('district_id') as string | null)?.trim()

    const text = await file.text()
    const rows = parseCsv(text)
    if (rows.length === 0) return NextResponse.json({ imported: 0, errors: [] })

    const supabase = createServerClient()
    const [{ data: districts }, { data: funds }, { data: accounts }] = await Promise.all([
      supabase.from('districts').select('id, name'),
      supabase.from('funds').select('id, district_id, name'),
      supabase.from('accounts').select('id, district_id, name, status'),
    ])

    const districtByName: Record<string, string> = {}
    const fundByDistrictAndName: Record<string, string> = {}
    const generalFundByDistrict: Record<string, string> = {}
    const activeAccountByDistrictAndName: Record<string, string> = {}
    const defaultActiveAccountByDistrict: Record<string, string> = {}
    const activeAccountCountByDistrict: Record<string, number> = {}

    for (const district of districts ?? []) {
      districtByName[district.name.toLowerCase()] = district.id
    }
    for (const fund of funds ?? []) {
      fundByDistrictAndName[`${fund.district_id}:${fund.name.toLowerCase()}`] = fund.id
      if (fund.name.toLowerCase() === 'general fund') {
        generalFundByDistrict[fund.district_id] = fund.id
      }
    }
    for (const account of accounts ?? []) {
      if (account.status !== 'active') continue
      activeAccountByDistrictAndName[`${account.district_id}:${account.name.toLowerCase()}`] = account.id
      activeAccountCountByDistrict[account.district_id] = (activeAccountCountByDistrict[account.district_id] ?? 0) + 1
      if (!defaultActiveAccountByDistrict[account.district_id]) {
        defaultActiveAccountByDistrict[account.district_id] = account.id
      }
    }

    let imported = 0
    const errors: string[] = []

    for (const row of rows) {
      const description = row['description']?.trim()
      if (!description) {
        errors.push('Skipped row: missing description')
        continue
      }

      const amountRaw = row['amount']?.trim()
      const amount = parseFloat(amountRaw ?? '')
      if (!amountRaw || isNaN(amount) || amount <= 0) {
        errors.push(`"${description}": invalid or missing amount`)
        continue
      }

      const date = row['date']?.trim()
      if (!date) {
        errors.push(`"${description}": missing date`)
        continue
      }

      let district_id: string | null = null
      const districtName = row['district']?.trim()
      if (districtName) {
        district_id = districtByName[districtName.toLowerCase()] ?? null
        if (!district_id) {
          errors.push(`"${description}": district "${districtName}" not found - skipping`)
          continue
        }
      } else if (districtIdParam) {
        district_id = districtIdParam
      }

      if (!district_id) {
        errors.push(`"${description}": no district specified`)
        continue
      }

      const accountName = row['account']?.trim()
      let account_id: string | null = null
      if (accountName) {
        account_id = activeAccountByDistrictAndName[`${district_id}:${accountName.toLowerCase()}`] ?? null
        if (!account_id) {
          errors.push(`"${description}": account "${accountName}" not found or inactive in the selected district`)
          continue
        }
      } else if ((activeAccountCountByDistrict[district_id] ?? 0) === 1) {
        account_id = defaultActiveAccountByDistrict[district_id] ?? null
      } else if ((activeAccountCountByDistrict[district_id] ?? 0) === 0) {
        errors.push(`"${description}": no active account found in the selected district`)
        continue
      } else {
        errors.push(`"${description}": account is required because the selected district has multiple active accounts`)
        continue
      }

      const fundName = row['fund']?.trim()
      let fund_id: string | null = generalFundByDistrict[district_id] ?? null
      if (fundName) {
        fund_id = fundByDistrictAndName[`${district_id}:${fundName.toLowerCase()}`] ?? null
        if (!fund_id) {
          errors.push(`"${description}": fund "${fundName}" not found in the selected district`)
          continue
        }
      }

      const rawCurrency = row['currency']?.trim()?.toUpperCase()
      const currency: Currency = VALID_CURRENCIES.includes(rawCurrency as Currency)
        ? (rawCurrency as Currency)
        : 'USD'

      const rawPaymentMethod = row['payment_method']?.trim()?.toLowerCase()
      const payment_method: PaymentMethod = VALID_PAYMENT_METHODS.includes(rawPaymentMethod as PaymentMethod)
        ? (rawPaymentMethod as PaymentMethod)
        : 'cash'

      const { error } = await supabase
        .from('income')
        .insert({
          district_id,
          account_id,
          fund_id,
          description,
          amount,
          date,
          category: row['category']?.trim() || null,
          currency,
          payment_method,
        })

      if (error) {
        errors.push(`"${description}": ${error.message}`)
        continue
      }
      imported++
    }

    return NextResponse.json({ imported, errors })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
