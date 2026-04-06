import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { renderToBuffer, Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import React from 'react'

// ---- helpers ----

function fmt(amount: number) {
  return `$ ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function pct(part: number, total: number) {
  if (total === 0) return '—'
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

// ---- styles ----

const C = {
  maroon: '#7a1c1c',
  gold: '#856404',
  goldBg: '#fdf8e8',
  goldBorder: '#c9a227',
  dark: '#1a1a1a',
  mid: '#444444',
  light: '#f5f5f5',
  sub: '#fafafa',
  catBg: '#fdf5e8',
  border: '#dddddd',
  green: '#15642a',
  white: '#ffffff',
  text: '#1a1a1a',
  muted: '#666666',
}

const s = StyleSheet.create({
  page: { fontFamily: 'Helvetica', fontSize: 9, color: C.text, paddingTop: 36, paddingBottom: 48, paddingHorizontal: 40, backgroundColor: C.white },

  // header
  docHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1.5, borderBottomColor: C.dark, paddingBottom: 5, marginBottom: 16 },
  docHeaderOrg: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', letterSpacing: 0.5 },
  docHeaderSub: { fontSize: 7.5, color: C.muted },

  titleBlock: { alignItems: 'center', marginBottom: 16 },
  titleMain: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: C.maroon, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 3 },
  titleSub: { fontSize: 12, fontFamily: 'Helvetica-Bold', marginBottom: 3 },
  titleMeta: { fontSize: 8.5, color: C.muted, fontStyle: 'italic' },

  // section heading
  sectionHeading: { fontSize: 9, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', letterSpacing: 0.8, color: C.maroon, borderBottomWidth: 1.2, borderBottomColor: C.maroon, paddingBottom: 2, marginTop: 16, marginBottom: 8 },

  // table
  tableHeaderRow: { flexDirection: 'row', backgroundColor: C.dark },
  tableHeaderCell: { color: C.white, fontFamily: 'Helvetica-Bold', fontSize: 8, paddingHorizontal: 6, paddingVertical: 4 },
  tableRow: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: C.border },
  tableCell: { paddingHorizontal: 6, paddingVertical: 3.5, fontSize: 8.5 },

  subsectionRow: { flexDirection: 'row', backgroundColor: C.catBg },
  subsectionCell: { fontFamily: 'Helvetica-Bold', fontSize: 8, color: C.maroon, paddingHorizontal: 6, paddingVertical: 4, textTransform: 'uppercase', letterSpacing: 0.5 },

  subtotalRow: { flexDirection: 'row', backgroundColor: C.sub, borderTopWidth: 0.75, borderTopColor: '#aaaaaa' },
  subtotalCell: { fontFamily: 'Helvetica-BoldOblique', fontSize: 8.5, color: C.maroon, paddingHorizontal: 6, paddingVertical: 3.5 },

  totalRow: { flexDirection: 'row', backgroundColor: C.dark },
  totalCell: { color: C.white, fontFamily: 'Helvetica-Bold', fontSize: 9.5, paddingHorizontal: 6, paddingVertical: 5 },

  summaryTotalIncomeRow: { flexDirection: 'row', backgroundColor: C.light },
  summaryTotalIncomeCell: { fontFamily: 'Helvetica-Bold', color: C.green, fontSize: 9, paddingHorizontal: 6, paddingVertical: 4 },

  summaryTotalExpRow: { flexDirection: 'row', backgroundColor: C.light },
  summaryTotalExpCell: { fontFamily: 'Helvetica-Bold', color: C.maroon, fontSize: 9, paddingHorizontal: 6, paddingVertical: 4 },

  netRow: { flexDirection: 'row', backgroundColor: C.goldBg, borderWidth: 1.2, borderColor: C.goldBorder, marginTop: 4 },
  netCell: { fontFamily: 'Helvetica-Bold', color: C.gold, fontSize: 10, paddingHorizontal: 6, paddingVertical: 5 },

  spacer: { height: 6 },

  footer: { position: 'absolute', bottom: 24, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 0.75, borderTopColor: '#cccccc', paddingTop: 4 },
  footerText: { fontSize: 7, color: C.muted },
})

// ---- column widths ----
const COL = {
  date: '14%',
  cat: '22%',
  desc: '50%',
  amt: '14%',
  // summary
  sLabel: '46%',
  sAmt: '22%',
  sPct: '16%',
  sCount: '16%',
}

// ---- components ----

function TableHeader({ cols }: { cols: { label: string; width: string; align?: 'right' | 'center' }[] }) {
  return (
    <View style={[s.tableHeaderRow, { backgroundColor: C.mid }]}>
      {cols.map((c, i) => (
        <Text key={i} style={[s.tableHeaderCell, { width: c.width, textAlign: c.align ?? 'left' }]}>{c.label}</Text>
      ))}
    </View>
  )
}

function SubsectionHeading({ label }: { label: string }) {
  return (
    <View style={s.subsectionRow}>
      <Text style={[s.subsectionCell, { flex: 1 }]}>{label}</Text>
    </View>
  )
}

// ---- main PDF document ----

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
  const contribTotal = contributions.reduce((s, c) => s + c.amount, 0)
  const manualTotal = manualIncome.reduce((s, i) => s + i.amount, 0)
  const totalIncome = contribTotal + manualTotal
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0)
  const net = totalIncome - totalExpenses
  const netPositive = net >= 0

  // Group expenses by category
  const expByCategory: Record<string, { amount: number; items: typeof expenses }> = {}
  for (const e of expenses) {
    const key = e.category ?? 'Uncategorised'
    if (!expByCategory[key]) expByCategory[key] = { amount: 0, items: [] }
    expByCategory[key].amount += e.amount
    expByCategory[key].items.push(e)
  }
  const sortedCats = Object.entries(expByCategory).sort(([, a], [, b]) => b.amount - a.amount)

  // Group manual income by category
  const incByCategory: Record<string, { amount: number; items: typeof manualIncome }> = {}
  for (const i of manualIncome) {
    const key = i.category ?? 'Uncategorised'
    if (!incByCategory[key]) incByCategory[key] = { amount: 0, items: [] }
    incByCategory[key].amount += i.amount
    incByCategory[key].items.push(i)
  }

  return (
    <Document title={`I&E Report — ${districtName}`} author="Conference App">
      <Page size="A4" style={s.page}>
        {/* Doc header */}
        <View style={s.docHeaderRow} fixed>
          <Text style={s.docHeaderOrg}>Southgate Christian Centre International</Text>
          <Text style={s.docHeaderSub}>Easter Conference 2026 — Income &amp; Expenditure Report</Text>
        </View>

        {/* Title */}
        <View style={s.titleBlock}>
          <Text style={s.titleMain}>Easter Conference 2026</Text>
          <Text style={s.titleSub}>Income &amp; Expenditure Report</Text>
          <Text style={s.titleMeta}>{districtName} · Prepared: {preparedDate}</Text>
        </View>

        {/* Financial Summary */}
        <Text style={s.sectionHeading}>Financial Summary</Text>
        <View style={s.tableHeaderRow}>
          <Text style={[s.tableHeaderCell, { width: COL.sLabel }]}>Summary</Text>
          <Text style={[s.tableHeaderCell, { width: COL.sAmt, textAlign: 'right' }]}>Amount ($)</Text>
          <Text style={[s.tableHeaderCell, { width: COL.sPct, textAlign: 'center' }]}>% of Income</Text>
          <Text style={[s.tableHeaderCell, { width: COL.sCount, textAlign: 'center' }]}>Count</Text>
        </View>
        <View style={s.tableRow}>
          <Text style={[s.tableCell, { width: COL.sLabel }]}>{"People's Contributions"}</Text>
          <Text style={[s.tableCell, { width: COL.sAmt, textAlign: 'right' }]}>{fmt(contribTotal)}</Text>
          <Text style={[s.tableCell, { width: COL.sPct, textAlign: 'center' }]}>{pct(contribTotal, totalIncome)}</Text>
          <Text style={[s.tableCell, { width: COL.sCount, textAlign: 'center' }]}>{contributions.length} {contributions.length === 1 ? 'entry' : 'entries'}</Text>
        </View>
        {manualTotal > 0 && (
          <View style={s.tableRow}>
            <Text style={[s.tableCell, { width: COL.sLabel }]}>Other Income</Text>
            <Text style={[s.tableCell, { width: COL.sAmt, textAlign: 'right' }]}>{fmt(manualTotal)}</Text>
            <Text style={[s.tableCell, { width: COL.sPct, textAlign: 'center' }]}>{pct(manualTotal, totalIncome)}</Text>
            <Text style={[s.tableCell, { width: COL.sCount, textAlign: 'center' }]}>{manualIncome.length} {manualIncome.length === 1 ? 'entry' : 'entries'}</Text>
          </View>
        )}
        <View style={s.summaryTotalIncomeRow}>
          <Text style={[s.summaryTotalIncomeCell, { width: COL.sLabel }]}>Total Income</Text>
          <Text style={[s.summaryTotalIncomeCell, { width: COL.sAmt, textAlign: 'right' }]}>{fmt(totalIncome)}</Text>
          <Text style={[s.summaryTotalIncomeCell, { width: COL.sPct, textAlign: 'center' }]}>100%</Text>
          <Text style={[s.summaryTotalIncomeCell, { width: COL.sCount }]} />
        </View>
        <View style={s.summaryTotalExpRow}>
          <Text style={[s.summaryTotalExpCell, { width: COL.sLabel }]}>Total Expenditure</Text>
          <Text style={[s.summaryTotalExpCell, { width: COL.sAmt, textAlign: 'right' }]}>{fmt(totalExpenses)}</Text>
          <Text style={[s.summaryTotalExpCell, { width: COL.sPct, textAlign: 'center' }]}>{pct(totalExpenses, totalIncome)}</Text>
          <Text style={[s.summaryTotalExpCell, { width: COL.sCount, textAlign: 'center' }]}>{expenses.length} items</Text>
        </View>
        <View style={s.netRow}>
          <Text style={[s.netCell, { width: COL.sLabel }]}>{netPositive ? 'Net Surplus' : 'Net Deficit'}</Text>
          <Text style={[s.netCell, { width: COL.sAmt, textAlign: 'right' }]}>{fmt(Math.abs(net))}</Text>
          <Text style={[s.netCell, { width: COL.sPct, textAlign: 'center' }]}>{pct(Math.abs(net), totalIncome)}</Text>
          <Text style={[s.netCell, { width: COL.sCount }]} />
        </View>

        {/* INCOME */}
        <Text style={s.sectionHeading}>Income</Text>

        <SubsectionHeading label="People's Contributions" />
        <View style={[s.tableHeaderRow, { backgroundColor: C.mid }]}>
          <Text style={[s.tableHeaderCell, { width: '20%' }]}>Date</Text>
          <Text style={[s.tableHeaderCell, { flex: 1 }]}>Contributor</Text>
          <Text style={[s.tableHeaderCell, { width: '18%', textAlign: 'right' }]}>Amount</Text>
        </View>
        <View style={s.subtotalRow}>
          <Text style={[s.subtotalCell, { flex: 1 }]}>{"People's Contributions Subtotal"}</Text>
          <Text style={[s.subtotalCell, { width: '18%', textAlign: 'right' }]}>{fmt(contribTotal)}</Text>
        </View>

        {manualIncome.length > 0 && (
          <>
            <View style={s.spacer} />
            <SubsectionHeading label="Other Income" />
            <View style={[s.tableHeaderRow, { backgroundColor: C.mid }]}>
              <Text style={[s.tableHeaderCell, { width: '20%' }]}>Date</Text>
              <Text style={[s.tableHeaderCell, { flex: 1 }]}>Description</Text>
              <Text style={[s.tableHeaderCell, { width: '18%', textAlign: 'right' }]}>Amount</Text>
            </View>
            {Object.entries(incByCategory).sort(([, a], [, b]) => b.amount - a.amount).map(([cat, { items, amount }]) => (
              <React.Fragment key={cat}>
                {items.map((item) => (
                  <View key={item.id} style={s.tableRow}>
                    <Text style={[s.tableCell, { width: '20%' }]}>{fmtDate(item.date)}</Text>
                    <Text style={[s.tableCell, { flex: 1 }]}>{item.description}</Text>
                    <Text style={[s.tableCell, { width: '18%', textAlign: 'right' }]}>{fmt(item.amount)}</Text>
                  </View>
                ))}
                <View style={s.subtotalRow}>
                  <Text style={[s.subtotalCell, { flex: 1 }]}>{cat} Subtotal</Text>
                  <Text style={[s.subtotalCell, { width: '18%', textAlign: 'right' }]}>{fmt(amount)}</Text>
                </View>
              </React.Fragment>
            ))}
          </>
        )}

        <View style={s.spacer} />
        <View style={s.totalRow}>
          <Text style={[s.totalCell, { flex: 1 }]}>Total Income</Text>
          <Text style={[s.totalCell, { width: '18%', textAlign: 'right' }]}>{fmt(totalIncome)}</Text>
        </View>

        {/* EXPENDITURE */}
        <Text style={s.sectionHeading}>Expenditure</Text>

        <SubsectionHeading label="Expenditure Details" />
        <TableHeader cols={[
          { label: 'Date', width: COL.date },
          { label: 'Category', width: COL.cat },
          { label: 'Description', width: COL.desc },
          { label: 'Amount', width: COL.amt, align: 'right' },
        ]} />

        {sortedCats.map(([cat, { items, amount }]) => (
          <React.Fragment key={cat}>
            {items.map((item, i) => (
              <View key={item.id} style={s.tableRow} wrap={false}>
                <Text style={[s.tableCell, { width: COL.date }]}>{fmtDate(item.date)}</Text>
                <Text style={[s.tableCell, { width: COL.cat, fontFamily: i === 0 ? 'Helvetica-Bold' : 'Helvetica' }]}>{i === 0 ? cat : ''}</Text>
                <Text style={[s.tableCell, { width: COL.desc }]}>{item.description}</Text>
                <Text style={[s.tableCell, { width: COL.amt, textAlign: 'right' }]}>{fmt(item.amount)}</Text>
              </View>
            ))}
            <View style={s.subtotalRow} wrap={false}>
              <Text style={[s.subtotalCell, { width: COL.date }]} />
              <Text style={[s.subtotalCell, { width: COL.cat }]} />
              <Text style={[s.subtotalCell, { width: COL.desc }]}>{cat} Subtotal</Text>
              <Text style={[s.subtotalCell, { width: COL.amt, textAlign: 'right' }]}>{fmt(amount)}</Text>
            </View>
            <View style={s.spacer} />
          </React.Fragment>
        ))}

        <View style={s.totalRow} wrap={false}>
          <Text style={[s.totalCell, { flex: 1 }]}>Total Expenditure</Text>
          <Text style={[s.totalCell, { width: COL.amt, textAlign: 'right' }]}>{fmt(totalExpenses)}</Text>
        </View>
        <View style={s.spacer} />
        <View style={s.netRow} wrap={false}>
          <Text style={[s.netCell, { flex: 1 }]}>{netPositive ? 'Net Surplus' : 'Net Deficit'}</Text>
          <Text style={[s.netCell, { width: COL.amt, textAlign: 'right' }]}>{fmt(Math.abs(net))}</Text>
        </View>

        {/* Footer */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>Prepared by the Finance Committee · {districtName}</Text>
          <Text style={s.footerText} render={({ pageNumber, totalPages }) => `Prepared: ${preparedDate} | Page ${pageNumber} of ${totalPages}`} />
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

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
