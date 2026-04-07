import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { renderToBuffer, Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import React from 'react'

// ---- helpers ----

function fmt(amount: number) {
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function pct(part: number, total: number) {
  if (total === 0) return '0.0%'
  return `${((part / total) * 100).toFixed(1)}%`
}

function fmtDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function isUnassignedContributionIncome(entry: { description: string; category: string | null }) {
  const category = entry.category?.trim().toLowerCase() ?? ''
  const description = entry.description.trim().toLowerCase()
  return (
    category === 'unassigned contributions' ||
    category === 'unassigned contribution' ||
    description === 'unassigned contributions' ||
    description === 'unassigned contribution'
  )
}

// ---- colours ----

const C = {
  navy: '#1e3a5f',
  blue: '#2e5fa3',
  summaryBg: '#edf2fb',
  summaryBorder: '#b0bbd0',
  white: '#ffffff',
  dark: '#1a1a1a',
  muted: '#666666',
  border: '#d0d7e6',
  rowAlt: '#f5f8ff',
}

// ---- styles ----

const s = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: C.dark,
    paddingTop: 36,
    paddingBottom: 48,
    paddingHorizontal: 40,
    backgroundColor: C.white,
  },

  // title block
  orgName: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
    textAlign: 'center',
    marginBottom: 6,
  },
  titleMain: {
    fontSize: 22,
    fontFamily: 'Helvetica-Bold',
    color: C.navy,
    textAlign: 'center',
    marginBottom: 2,
  },
  titleSub: {
    fontSize: 15,
    fontFamily: 'Helvetica-Bold',
    color: C.navy,
    textAlign: 'center',
    marginBottom: 5,
  },
  titleMeta: {
    fontSize: 8,
    color: C.muted,
    textAlign: 'center',
    marginBottom: 2,
  },
  titleDivider: {
    borderBottomWidth: 1.5,
    borderBottomColor: C.navy,
    marginTop: 10,
    marginBottom: 14,
  },

  // section headings
  sectionHeading: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: C.dark,
    marginTop: 14,
    marginBottom: 6,
  },
  sectionSubheading: {
    fontSize: 8,
    color: C.muted,
    marginBottom: 8,
  },

  // financial summary cards
  summaryBox: {
    backgroundColor: C.summaryBg,
    borderWidth: 0.5,
    borderColor: C.summaryBorder,
    marginBottom: 12,
  },
  summaryRow: { flexDirection: 'row' },
  summaryDivider: { borderTopWidth: 0.5, borderTopColor: C.summaryBorder },
  summaryCell: {
    flex: 1,
    padding: 10,
    borderRightWidth: 0.5,
    borderRightColor: C.summaryBorder,
  },
  summaryCellLast: { flex: 1, padding: 10 },
  summaryLabel: {
    fontSize: 7.5,
    color: C.blue,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 3,
  },
  summaryValueLg: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: C.dark },
  summaryValueSm: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: C.dark },

  // bullet insights
  bullet: { flexDirection: 'row', marginBottom: 4 },
  bulletDot: { width: 12, fontSize: 9 },
  bulletText: { flex: 1, fontSize: 8.5 },

  // tables
  tableHeaderRow: { flexDirection: 'row', backgroundColor: C.navy },
  tableHeaderCell: {
    color: C.white,
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    paddingHorizontal: 6,
    paddingVertical: 5,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: C.border,
  },
  tableRowAlt: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: C.border,
    backgroundColor: C.rowAlt,
  },
  tableCell: { paddingHorizontal: 6, paddingVertical: 3.5, fontSize: 8.5 },
  tableCellBold: {
    paddingHorizontal: 6,
    paddingVertical: 3.5,
    fontSize: 8.5,
    fontFamily: 'Helvetica-Bold',
  },
  totalRow: { flexDirection: 'row', backgroundColor: C.navy },
  totalCell: {
    color: C.white,
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
    paddingHorizontal: 6,
    paddingVertical: 5,
  },

  // category heading in detailed schedule
  catHeadingRow: {
    borderBottomWidth: 1,
    borderBottomColor: C.blue,
    marginTop: 12,
    marginBottom: 0,
  },
  catHeadingText: {
    fontSize: 9.5,
    fontFamily: 'Helvetica-Bold',
    color: C.blue,
    paddingBottom: 3,
  },
  subtotalText: {
    fontSize: 8.5,
    color: C.muted,
    fontFamily: 'Helvetica-BoldOblique',
    textAlign: 'right',
    paddingVertical: 3,
    paddingRight: 6,
  },

  // sign-off
  signOffHeading: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 16,
    marginTop: 28,
  },
  signOffRow: { flexDirection: 'row' },
  signOffCol: { flex: 1, marginRight: 24 },
  signOffColLast: { flex: 1 },
  signOffLabel: { fontSize: 9, fontFamily: 'Helvetica-Bold', marginBottom: 22 },
  signOffLine: { borderBottomWidth: 1, borderBottomColor: C.dark, marginBottom: 6 },
  signOffSub: { fontSize: 7.5, color: C.muted, fontStyle: 'italic' },

  // footer
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 0.75,
    borderTopColor: '#cccccc',
    paddingTop: 4,
  },
  footerText: { fontSize: 7, color: C.muted },
})

// ---- PDF document ----

function IEReport({
  districtName,
  preparedDate,
  contributions,
  manualIncome,
  expenses,
}: {
  districtName: string
  preparedDate: string
  contributions: { id: string; date: string; person_name: string; note: string | null; amount: number }[]
  manualIncome: { id: string; date: string; description: string; category: string | null; amount: number }[]
  expenses: { id: string; date: string; description: string; category: string | null; amount: number }[]
}) {
  const contribTotal = contributions.reduce((sum, c) => sum + c.amount, 0)
  const manualTotal = manualIncome.reduce((sum, i) => sum + i.amount, 0)
  const totalIncome = contribTotal + manualTotal
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0)
  const net = totalIncome - totalExpenses
  const netPositive = net >= 0

  // Group expenses by category, sorted by total desc
  const expByCategory: Record<string, { amount: number; items: typeof expenses }> = {}
  for (const e of expenses) {
    const key = e.category ?? 'Uncategorised'
    if (!expByCategory[key]) expByCategory[key] = { amount: 0, items: [] }
    expByCategory[key].amount += e.amount
    expByCategory[key].items.push(e)
  }
  const sortedCats = Object.entries(expByCategory).sort(([, a], [, b]) => b.amount - a.amount)

  // Key financial insights
  const insight1 =
    net === 0
      ? 'The conference closed at break-even, with total income exactly matching total expenditure.'
      : netPositive
        ? `The conference generated a surplus of ${fmt(net)}, with total income exceeding total expenditure.`
        : `The conference ran a deficit of ${fmt(Math.abs(net))}, with total expenditure exceeding total income.`

  const insight2 = `People's contributions were the primary source of funding, contributing ${pct(contribTotal, totalIncome)} of all income.`

  const topCats = sortedCats.slice(0, 3).map(([cat]) => cat)
  const insight3 =
    topCats.length > 0
      ? `The largest expenditure category was ${topCats[0]}${topCats[1] ? `, followed by ${topCats[1]}` : ''}${topCats[2] ? ` and ${topCats[2]}` : ''}.`
      : 'No expenditure categories recorded.'

  return (
    <Document title={`I&E Report — ${districtName}`} author="Conference App">
      <Page size="A4" style={s.page}>

        {/* ── Title block ── */}
        <View style={{ alignItems: 'center', marginBottom: 4 }}>
          <Text style={s.orgName}>Southgate Christian Centre International</Text>
          <Text style={s.titleMain}>Easter Conference 2026</Text>
          <Text style={s.titleSub}>Income &amp; Expenditure Report</Text>
          <Text style={s.titleMeta}>Prepared: {preparedDate} | Youth Secretary</Text>
        </View>
        <View style={s.titleDivider} />

        {/* ── Financial Summary ── */}
        <Text style={s.sectionHeading}>Financial Summary</Text>
        <View style={s.summaryBox}>
          {/* Row 1: headline totals */}
          <View style={s.summaryRow}>
            <View style={s.summaryCell}>
              <Text style={s.summaryLabel}>Total Income</Text>
              <Text style={s.summaryValueLg}>{fmt(totalIncome)}</Text>
            </View>
            <View style={s.summaryCell}>
              <Text style={s.summaryLabel}>Total Expenditure</Text>
              <Text style={s.summaryValueLg}>{fmt(totalExpenses)}</Text>
            </View>
            <View style={s.summaryCellLast}>
              <Text style={s.summaryLabel}>{netPositive ? 'Net Surplus' : 'Net Deficit'}</Text>
              <Text style={s.summaryValueLg}>{fmt(Math.abs(net))}</Text>
            </View>
          </View>
          {/* Row 2: breakdown */}
          <View style={[s.summaryRow, s.summaryDivider]}>
            <View style={s.summaryCell}>
              <Text style={s.summaryLabel}>{"People's Contributions"}</Text>
              <Text style={s.summaryValueSm}>{fmt(contribTotal)} ({pct(contribTotal, totalIncome)})</Text>
            </View>
            <View style={s.summaryCell}>
              <Text style={s.summaryLabel}>Other Income</Text>
              <Text style={s.summaryValueSm}>{fmt(manualTotal)} ({pct(manualTotal, totalIncome)})</Text>
            </View>
            <View style={s.summaryCellLast}>
              <Text style={s.summaryLabel}>Activity Count</Text>
              <Text style={s.summaryValueSm}>
                {contributions.length} contributions | {expenses.length} expense items
              </Text>
            </View>
          </View>
        </View>

        {/* ── Key Financial Insights ── */}
        <Text style={s.sectionHeading}>Key Financial Insights</Text>
        {[insight1, insight2, insight3].map((text, i) => (
          <View key={i} style={s.bullet}>
            <Text style={s.bulletDot}>•</Text>
            <Text style={s.bulletText}>{text}</Text>
          </View>
        ))}

        {/* ── Income Summary ── */}
        <Text style={s.sectionHeading}>Income Summary</Text>
        <View style={s.tableHeaderRow}>
          <Text style={[s.tableHeaderCell, { flex: 1 }]}>Income Source</Text>
          <Text style={[s.tableHeaderCell, { width: '20%', textAlign: 'right' }]}>Amount ($)</Text>
          <Text style={[s.tableHeaderCell, { width: '16%', textAlign: 'center' }]}>% of Income</Text>
          <Text style={[s.tableHeaderCell, { width: '18%' }]}>Notes</Text>
        </View>
        <View style={s.tableRow}>
          <Text style={[s.tableCell, { flex: 1 }]}>{"People's Contributions"}</Text>
          <Text style={[s.tableCell, { width: '20%', textAlign: 'right' }]}>{fmt(contribTotal)}</Text>
          <Text style={[s.tableCell, { width: '16%', textAlign: 'center' }]}>{pct(contribTotal, totalIncome)}</Text>
          <Text style={[s.tableCell, { width: '18%' }]}>{contributions.length} entries</Text>
        </View>
        {manualTotal > 0 && (
          <View style={s.tableRowAlt}>
            <Text style={[s.tableCell, { flex: 1 }]}>Other Income</Text>
            <Text style={[s.tableCell, { width: '20%', textAlign: 'right' }]}>{fmt(manualTotal)}</Text>
            <Text style={[s.tableCell, { width: '16%', textAlign: 'center' }]}>{pct(manualTotal, totalIncome)}</Text>
            <Text style={[s.tableCell, { width: '18%' }]}>{manualIncome.length} entries</Text>
          </View>
        )}
        <View style={s.totalRow}>
          <Text style={[s.totalCell, { flex: 1 }]}>Total Income</Text>
          <Text style={[s.totalCell, { width: '20%', textAlign: 'right' }]}>{fmt(totalIncome)}</Text>
          <Text style={[s.totalCell, { width: '16%', textAlign: 'center' }]}>100.0%</Text>
          <Text style={[s.totalCell, { width: '18%' }]} />
        </View>

        {/* Other Income Detail */}
        {manualIncome.length > 0 && (
          <>
            <View style={{ marginTop: 10, marginBottom: 5 }}>
              <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: C.blue }}>Other Income Detail</Text>
            </View>
            <View style={s.tableHeaderRow}>
              <Text style={[s.tableHeaderCell, { width: '22%' }]}>Date</Text>
              <Text style={[s.tableHeaderCell, { flex: 1 }]}>Description</Text>
              <Text style={[s.tableHeaderCell, { width: '20%' }]}>Type</Text>
              <Text style={[s.tableHeaderCell, { width: '18%', textAlign: 'right' }]}>Amount ($)</Text>
            </View>
            {manualIncome.map((item, i) => (
              <View key={item.id} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
                <Text style={[s.tableCell, { width: '22%' }]}>{fmtDate(item.date)}</Text>
                <Text style={[s.tableCell, { flex: 1 }]}>{item.description}</Text>
                <Text style={[s.tableCell, { width: '20%' }]}>{item.category ?? 'Other'}</Text>
                <Text style={[s.tableCell, { width: '18%', textAlign: 'right' }]}>{fmt(item.amount)}</Text>
              </View>
            ))}
          </>
        )}

        {/* ── Expenditure Summary by Category ── */}
        <Text style={s.sectionHeading}>Expenditure Summary by Category</Text>
        <View style={s.tableHeaderRow}>
          <Text style={[s.tableHeaderCell, { flex: 1 }]}>Category</Text>
          <Text style={[s.tableHeaderCell, { width: '20%', textAlign: 'right' }]}>Amount ($)</Text>
          <Text style={[s.tableHeaderCell, { width: '20%', textAlign: 'center' }]}>% of Expenditure</Text>
          <Text style={[s.tableHeaderCell, { width: '12%', textAlign: 'center' }]}>Rank</Text>
        </View>
        {sortedCats.map(([cat, { amount }], i) => (
          <View key={cat} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
            <Text style={[s.tableCell, { flex: 1 }]}>{cat}</Text>
            <Text style={[s.tableCell, { width: '20%', textAlign: 'right' }]}>{fmt(amount)}</Text>
            <Text style={[s.tableCell, { width: '20%', textAlign: 'center' }]}>{pct(amount, totalExpenses)}</Text>
            <Text style={[s.tableCell, { width: '12%', textAlign: 'center' }]}>{i + 1}</Text>
          </View>
        ))}

        {/* ── Detailed Expenditure Schedule ── */}
        <Text style={[s.sectionHeading, { marginTop: 20 }]}>Detailed Expenditure Schedule</Text>
        <Text style={s.sectionSubheading}>Grouped by category for easier review and sign-off.</Text>

        {sortedCats.map(([cat, { items, amount }]) => (
          <React.Fragment key={cat}>
            <View style={s.catHeadingRow} wrap={false}>
              <Text style={s.catHeadingText}>{cat} - {fmt(amount)}</Text>
            </View>
            <View style={s.tableHeaderRow}>
              <Text style={[s.tableHeaderCell, { width: '25%' }]}>Date</Text>
              <Text style={[s.tableHeaderCell, { flex: 1 }]}>Description</Text>
              <Text style={[s.tableHeaderCell, { width: '20%', textAlign: 'right' }]}>Amount ($)</Text>
            </View>
            {items.map((item, i) => (
              <View key={item.id} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt} wrap={false}>
                <Text style={[s.tableCell, { width: '25%' }]}>{fmtDate(item.date)}</Text>
                <Text style={[s.tableCell, { flex: 1 }]}>{item.description}</Text>
                <Text style={[s.tableCell, { width: '20%', textAlign: 'right' }]}>{fmt(item.amount)}</Text>
              </View>
            ))}
            <Text style={s.subtotalText}>Subtotal: {fmt(amount)}</Text>
          </React.Fragment>
        ))}

        {/* ── Sign-off ── */}
        <View wrap={false}>
          <Text style={s.signOffHeading}>Sign-off</Text>
          <View style={s.signOffRow}>
            {(['Prepared by', 'Reviewed by', 'Approved by'] as const).map((label, i, arr) => (
              <View key={label} style={i === arr.length - 1 ? s.signOffColLast : s.signOffCol}>
                <Text style={s.signOffLabel}>{label}</Text>
                <View style={s.signOffLine} />
                <Text style={s.signOffSub}>Name / Signature / Date</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Footer */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>Prepared by the Youth Secretary · {districtName}</Text>
          <Text
            style={s.footerText}
            render={({ pageNumber, totalPages }) =>
              `Prepared: ${preparedDate} | Page ${pageNumber} of ${totalPages}`
            }
          />
        </View>

      </Page>
    </Document>
  )
}

// ---- API route ----

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const districtId = searchParams.get('district_id')

  const supabase = createServerClient()

  type ContributionSelectRow = {
    id: string
    amount: number
    note: string | null
    date: string
    person: { name?: string } | null
  }
  type IncomeSelectRow = {
    id: string
    amount: number
    description: string
    category: string | null
    date: string
  }
  type ExpenseSelectRow = {
    id: string
    amount: number
    description: string
    category: string | null
    date: string
  }

  // Fetch district name
  let districtName = 'All Districts'
  if (districtId) {
    const { data: d } = await supabase.from('districts').select('name').eq('id', districtId).single()
    if (d) districtName = d.name
  }

  // Fetch contributions via regions → people
  let contributions: { id: string; date: string; person_name: string; note: string | null; amount: number }[] = []
  if (districtId) {
    const { data: regions } = await supabase.from('regions').select('id').eq('district_id', districtId)
    const regionIds = regions?.map((r: { id: string }) => r.id) ?? []
    if (regionIds.length > 0) {
      const { data: people } = await supabase.from('people').select('id, name').in('region_id', regionIds)
      const personIds = people?.map((p: { id: string }) => p.id) ?? []
      if (personIds.length > 0) {
        const { data: contribs } = await supabase
          .from('contributions')
          .select('id, amount, note, date, person:people(name)')
          .in('person_id', personIds)
          .order('date', { ascending: false })
        contributions = ((contribs ?? []) as ContributionSelectRow[]).map((c) => ({
          id: c.id,
          date: c.date,
          person_name: c.person?.name ?? 'Unknown',
          note: c.note,
          amount: c.amount,
        }))
      }
    }
  } else {
    const { data: contribs } = await supabase
      .from('contributions')
      .select('id, amount, note, date, person:people(name)')
      .order('date', { ascending: false })
    contributions = ((contribs ?? []) as ContributionSelectRow[]).map((c) => ({
      id: c.id,
      date: c.date,
      person_name: c.person?.name ?? 'Unknown',
      note: c.note,
      amount: c.amount,
    }))
  }

  // Fetch manual income
  let incomeQuery = supabase.from('income').select('id, amount, description, category, date').order('date', { ascending: false })
  if (districtId) incomeQuery = incomeQuery.eq('district_id', districtId)
  const { data: incomeRows } = await incomeQuery
  const manualIncome = ((incomeRows ?? []) as IncomeSelectRow[]).map((i) => ({
    id: i.id,
    date: i.date,
    description: i.description,
    category: i.category,
    amount: i.amount,
  }))

  const unassignedContributionIncome = manualIncome.filter(isUnassignedContributionIncome)
  const otherIncome = manualIncome.filter((entry) => !isUnassignedContributionIncome(entry))

  const promotedContributions = unassignedContributionIncome.map((entry) => ({
    id: `income-${entry.id}`,
    date: entry.date,
    person_name: 'Unassigned',
    note: entry.description,
    amount: entry.amount,
  }))

  const allContributions = [...contributions, ...promotedContributions].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  )

  // Fetch expenses
  let expQuery = supabase.from('expenses').select('id, amount, description, category, date').order('date', { ascending: false })
  if (districtId) expQuery = expQuery.eq('district_id', districtId)
  const { data: expRows } = await expQuery
  const expenses = ((expRows ?? []) as ExpenseSelectRow[]).map((e) => ({
    id: e.id,
    date: e.date,
    description: e.description,
    category: e.category,
    amount: e.amount,
  }))

  const preparedDate = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

  const buffer = await renderToBuffer(
    React.createElement(IEReport, {
      districtName,
      preparedDate,
      contributions: allContributions,
      manualIncome: otherIncome,
      expenses,
    }) as unknown as React.ReactElement<React.ComponentProps<typeof Document>>
  )

  const filename = `IE-Report-${districtName.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
