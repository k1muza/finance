import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { renderToBuffer, Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import React from 'react'

type TransactionRow = {
  id: string
  district_id: string
  fund_id: string | null
  description: string
  amount: number
  category: string | null
  date: string
  fund?: { name?: string } | { name?: string }[] | null
  district?: { name?: string } | { name?: string }[] | null
}

function fmtCurrency(amount: number) {
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtDate(date: string) {
  return new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function districtNameOf(row: TransactionRow) {
  if (Array.isArray(row.district)) return row.district[0]?.name ?? 'Unknown district'
  return row.district?.name ?? 'Unknown district'
}

function fundNameOf(row: TransactionRow) {
  if (Array.isArray(row.fund)) return row.fund[0]?.name ?? 'Unassigned'
  return row.fund?.name ?? 'Unassigned'
}

const styles = StyleSheet.create({
  page: {
    padding: 32,
    backgroundColor: '#ffffff',
    color: '#0f172a',
    fontSize: 10,
    fontFamily: 'Helvetica',
  },
  title: {
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    marginBottom: 12,
  },
  meta: {
    fontSize: 10,
    color: '#475569',
    marginBottom: 12,
  },
  summaryBox: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
    padding: 10,
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 8,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#0f172a',
    color: '#ffffff',
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginBottom: 2,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  dateCol: { width: '14%' },
  districtCol: { width: '16%' },
  descriptionCol: { width: '24%' },
  fundCol: { width: '18%' },
  categoryCol: { width: '16%' },
  amountCol: { width: '12%', textAlign: 'right' },
  spacer: {
    height: 16,
  },
})

function FinancePdf({
  districtName,
  preparedDate,
  income,
  expenses,
  totalIncome,
  totalExpenses,
  netBalance,
  showDistrict,
}: {
  districtName: string
  preparedDate: string
  income: TransactionRow[]
  expenses: TransactionRow[]
  totalIncome: number
  totalExpenses: number
  netBalance: number
  showDistrict: boolean
}) {
  return (
    <Document title={`Income & Expenditure Statement - ${districtName}`} author="District Finance Dashboard">
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>District Finance Dashboard</Text>
        <Text style={styles.subtitle}>Income & Expenditure Statement</Text>
        <Text style={styles.meta}>Scope: {districtName} | Prepared: {preparedDate}</Text>

        <View style={styles.summaryBox}>
          <View style={styles.summaryRow}>
            <Text>Total Income</Text>
            <Text>{fmtCurrency(totalIncome)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text>Total Expenditure</Text>
            <Text>{fmtCurrency(totalExpenses)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text>{netBalance >= 0 ? 'Surplus' : 'Deficit'}</Text>
            <Text>{fmtCurrency(Math.abs(netBalance))}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Income</Text>
        <TransactionSection rows={income} showDistrict={showDistrict} />

        <View style={styles.spacer} />

        <Text style={styles.sectionTitle}>Expenditure</Text>
        <TransactionSection rows={expenses} showDistrict={showDistrict} />
      </Page>
    </Document>
  )
}

function TransactionSection({ rows, showDistrict }: { rows: TransactionRow[]; showDistrict: boolean }) {
  return (
    <View>
      <View style={styles.tableHeader}>
        <Text style={styles.dateCol}>Date</Text>
        {showDistrict && <Text style={styles.districtCol}>District</Text>}
        <Text style={styles.descriptionCol}>Description</Text>
        <Text style={styles.fundCol}>Fund</Text>
        <Text style={styles.categoryCol}>Category</Text>
        <Text style={styles.amountCol}>Amount</Text>
      </View>
      {rows.length === 0 ? (
        <View style={styles.tableRow}>
          <Text>No entries recorded.</Text>
        </View>
      ) : rows.map((row) => (
        <View key={row.id} style={styles.tableRow}>
          <Text style={styles.dateCol}>{fmtDate(row.date)}</Text>
          {showDistrict && <Text style={styles.districtCol}>{districtNameOf(row)}</Text>}
          <Text style={styles.descriptionCol}>{row.description}</Text>
          <Text style={styles.fundCol}>{fundNameOf(row)}</Text>
          <Text style={styles.categoryCol}>{row.category ?? 'Uncategorised'}</Text>
          <Text style={styles.amountCol}>{fmtCurrency(row.amount)}</Text>
        </View>
      ))}
    </View>
  )
}

export async function GET(request: NextRequest) {
  const districtId = request.nextUrl.searchParams.get('district_id')
  const supabase = createServerClient()

  let incomeQuery = supabase
    .from('income')
    .select('id, district_id, fund_id, description, amount, category, date, fund:funds(name), district:districts(name)')
    .order('date', { ascending: false })

  let expensesQuery = supabase
    .from('expenses')
    .select('id, district_id, fund_id, description, amount, category, date, fund:funds(name), district:districts(name)')
    .order('date', { ascending: false })

  if (districtId) {
    incomeQuery = incomeQuery.eq('district_id', districtId)
    expensesQuery = expensesQuery.eq('district_id', districtId)
  }

  const [{ data: income }, { data: expenses }, { data: districts }] = await Promise.all([
    incomeQuery,
    expensesQuery,
    supabase.from('districts').select('id, name').order('name'),
  ])

  const districtName = districtId
    ? (districts?.find((district) => district.id === districtId)?.name ?? 'District')
    : 'All Districts'
  const totalIncome = (income ?? []).reduce((sum, row) => sum + (row.amount ?? 0), 0)
  const totalExpenses = (expenses ?? []).reduce((sum, row) => sum + (row.amount ?? 0), 0)
  const netBalance = totalIncome - totalExpenses
  const preparedDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })

  const buffer = await renderToBuffer(
    <FinancePdf
      districtName={districtName}
      preparedDate={preparedDate}
      income={(income ?? []) as TransactionRow[]}
      expenses={(expenses ?? []) as TransactionRow[]}
      totalIncome={totalIncome}
      totalExpenses={totalExpenses}
      netBalance={netBalance}
      showDistrict={!districtId}
    />
  )

  const filename = `income-expenditure-${districtName.replace(/\s+/g, '-').toLowerCase()}.pdf`

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
