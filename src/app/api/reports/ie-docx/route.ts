import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  AlignmentType,
  VerticalAlign,
  WidthType,
  ShadingType,
  BorderStyle,
  TableLayoutType,
} from 'docx'

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

// ---- layout constants ----

// A4 at 0.7-inch margins each side → usable width ≈ 10486 DXA
const W = 10486

const COL = {
  // Income Summary: label / amount / pct / notes
  iLabel: Math.round(W * 0.44),
  iAmt:   Math.round(W * 0.20),
  iPct:   Math.round(W * 0.18),
  iNotes: Math.round(W * 0.18),

  // Other Income Detail: date / desc / type / amount
  oDate: Math.round(W * 0.18),
  oDesc: Math.round(W * 0.42),
  oType: Math.round(W * 0.22),
  oAmt:  Math.round(W * 0.18),

  // Expenditure summary: category / amount / pct / rank
  eLabel: Math.round(W * 0.44),
  eAmt:   Math.round(W * 0.20),
  ePct:   Math.round(W * 0.22),
  eRank:  Math.round(W * 0.14),

  // Detail schedule: date / desc / amount
  dDate: Math.round(W * 0.20),
  dDesc: Math.round(W * 0.62),
  dAmt:  Math.round(W * 0.18),

  // Summary card grid: 3 equal columns
  card: Math.round(W / 3),

  // Sign-off: 3 equal columns
  sign: Math.round(W / 3),
}

// ---- colour tokens ----

const CLR = {
  navy:      '1e3a5f',
  blue:      '2e5fa3',
  summaryBg: 'dce8f8',
  catBg:     'e8f0fb',
  rowAlt:    'f3f7ff',
  white:     'ffffff',
  dark:      '1a1a1a',
  muted:     '777777',
}

// ---- border presets ----

// Used on Table-level (not cell-level) — cells inherit these
const DATA_BORDERS = {
  top:              { style: BorderStyle.SINGLE, size: 8,  color: CLR.blue },
  bottom:           { style: BorderStyle.SINGLE, size: 8,  color: CLR.blue },
  left:             { style: BorderStyle.SINGLE, size: 8,  color: CLR.blue },
  right:            { style: BorderStyle.SINGLE, size: 8,  color: CLR.blue },
  insideHorizontal: { style: BorderStyle.SINGLE, size: 4,  color: 'ccd8ef' },
  insideVertical:   { style: BorderStyle.SINGLE, size: 4,  color: 'ccd8ef' },
}

const CARD_BORDERS = {
  top:              { style: BorderStyle.SINGLE, size: 10, color: CLR.blue },
  bottom:           { style: BorderStyle.SINGLE, size: 10, color: CLR.blue },
  left:             { style: BorderStyle.SINGLE, size: 10, color: CLR.blue },
  right:            { style: BorderStyle.SINGLE, size: 10, color: CLR.blue },
  insideHorizontal: { style: BorderStyle.SINGLE, size: 8,  color: '8daed4' },
  insideVertical:   { style: BorderStyle.SINGLE, size: 8,  color: '8daed4' },
}

const NO_BORDERS = {
  top:              { style: BorderStyle.NONE, size: 0, color: CLR.white },
  bottom:           { style: BorderStyle.NONE, size: 0, color: CLR.white },
  left:             { style: BorderStyle.NONE, size: 0, color: CLR.white },
  right:            { style: BorderStyle.NONE, size: 0, color: CLR.white },
  insideHorizontal: { style: BorderStyle.NONE, size: 0, color: CLR.white },
  insideVertical:   { style: BorderStyle.NONE, size: 0, color: CLR.white },
}

// Cell-level border override: removes all so table borders show through
const CELL_NO_BORDER = {
  top:    { style: BorderStyle.NIL, size: 0, color: CLR.white },
  bottom: { style: BorderStyle.NIL, size: 0, color: CLR.white },
  left:   { style: BorderStyle.NIL, size: 0, color: CLR.white },
  right:  { style: BorderStyle.NIL, size: 0, color: CLR.white },
}

// ---- padding presets ----

const PAD  = { top: 80, bottom: 80, left: 140, right: 140 }   // data cells
const HPAD = { top: 100, bottom: 100, left: 140, right: 140 } // header cells
const CPAD = { top: 120, bottom: 120, left: 160, right: 160 } // summary cards

// ---- builder helpers ----

function bg(fill: string) {
  return { fill, type: ShadingType.SOLID, color: fill }
}

function bgLight(fill: string) {
  // CLEAR = background is fill, no foreground pattern
  return { fill, type: ShadingType.CLEAR, color: 'auto' }
}

/** Standard data cell — no cell-level border (inherits table borders) */
function cell(
  text: string,
  width: number,
  opts: {
    align?: (typeof AlignmentType)[keyof typeof AlignmentType]
    bold?: boolean
    color?: string
    fill?: string         // background fill
    size?: number
    italic?: boolean
  } = {}
) {
  return new TableCell({
    width:         { size: width, type: WidthType.DXA },
    shading:       opts.fill ? bgLight(opts.fill) : undefined,
    margins:       PAD,
    verticalAlign: VerticalAlign.CENTER,
    borders:       CELL_NO_BORDER,
    children: [
      new Paragraph({
        alignment: opts.align ?? AlignmentType.LEFT,
        children: [
          new TextRun({
            text,
            bold:    opts.bold    ?? false,
            color:   opts.color   ?? CLR.dark,
            size:    opts.size    ?? 18,
            italics: opts.italic  ?? false,
          }),
        ],
      }),
    ],
  })
}

/** Navy header cell */
function headerCell(text: string, width: number, align: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.LEFT) {
  return new TableCell({
    width:         { size: width, type: WidthType.DXA },
    shading:       bg(CLR.navy),
    margins:       HPAD,
    verticalAlign: VerticalAlign.CENTER,
    borders:       CELL_NO_BORDER,
    children: [
      new Paragraph({
        alignment: align,
        children: [new TextRun({ text, bold: true, color: CLR.white, size: 18, allCaps: true })],
      }),
    ],
  })
}

/** Navy total / footer cell */
function totalCell(text: string, width: number, align: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.LEFT) {
  return new TableCell({
    width:         { size: width, type: WidthType.DXA },
    shading:       bg(CLR.navy),
    margins:       HPAD,
    verticalAlign: VerticalAlign.CENTER,
    borders:       CELL_NO_BORDER,
    children: [
      new Paragraph({
        alignment: align,
        children: [new TextRun({ text, bold: true, color: CLR.white, size: 18 })],
      }),
    ],
  })
}

/** Convenience: build a standard data table with consistent borders and fixed layout */
function dataTable(rows: TableRow[]) {
  return new Table({
    width:   { size: W, type: WidthType.DXA },
    layout:  TableLayoutType.FIXED,
    borders: DATA_BORDERS,
    rows,
  })
}

// Spacer paragraph
function spacer(pts = 4) {
  return new Paragraph({ children: [], spacing: { before: pts * 20, after: pts * 20 } })
}

// Section heading — styled directly (no HeadingLevel to avoid Word style bleed)
function sectionHeading(text: string) {
  return new Paragraph({
    spacing: { before: 360, after: 160 },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 12, color: CLR.navy },
    },
    children: [
      new TextRun({ text: text.toUpperCase(), bold: true, color: CLR.navy, size: 22, characterSpacing: 20 }),
    ],
  })
}

// Category heading row in detail schedule — full-width shaded cell
function catHeadingRow(text: string) {
  return new Table({
    width:   { size: W, type: WidthType.DXA },
    layout:  TableLayoutType.FIXED,
    borders: {
      top:              { style: BorderStyle.SINGLE, size: 6, color: CLR.blue },
      bottom:           { style: BorderStyle.SINGLE, size: 6, color: CLR.blue },
      left:             { style: BorderStyle.SINGLE, size: 6, color: CLR.blue },
      right:            { style: BorderStyle.SINGLE, size: 6, color: CLR.blue },
      insideHorizontal: { style: BorderStyle.NONE,   size: 0, color: CLR.white },
      insideVertical:   { style: BorderStyle.NONE,   size: 0, color: CLR.white },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width:         { size: W, type: WidthType.DXA },
            shading:       bgLight(CLR.catBg),
            margins:       { top: 100, bottom: 100, left: 140, right: 140 },
            verticalAlign: VerticalAlign.CENTER,
            borders:       CELL_NO_BORDER,
            children: [
              new Paragraph({
                children: [new TextRun({ text, bold: true, color: CLR.navy, size: 20 })],
              }),
            ],
          }),
        ],
      }),
    ],
  })
}

// Sub-label paragraph (e.g. "Other Income Detail")
function subLabel(text: string) {
  return new Paragraph({
    spacing: { before: 200, after: 100 },
    children: [new TextRun({ text, bold: true, color: CLR.blue, size: 19 })],
  })
}

// Bullet insight paragraph
function bulletPara(text: string) {
  return new Paragraph({
    bullet:  { level: 0 },
    spacing: { before: 60, after: 60 },
    children: [new TextRun({ text, size: 18 })],
  })
}

// Subtotal right-aligned line after each detail category table
function subtotalPara(text: string) {
  return new Paragraph({
    alignment: AlignmentType.RIGHT,
    spacing:   { before: 60, after: 200 },
    children: [
      new TextRun({ text, bold: true, italics: true, color: CLR.muted, size: 17 }),
    ],
  })
}

// ---- document builder ----

function buildDoc(opts: {
  districtName: string
  preparedDate: string
  contributions: { id: string; date: string; person_name: string; note: string | null; amount: number }[]
  manualIncome: { id: string; date: string; description: string; category: string | null; amount: number }[]
  expenses: { id: string; date: string; description: string; category: string | null; amount: number }[]
}) {
  const { districtName, preparedDate, contributions, manualIncome, expenses } = opts

  const contribTotal  = contributions.reduce((s, c) => s + c.amount, 0)
  const manualTotal   = manualIncome.reduce((s, i) => s + i.amount, 0)
  const totalIncome   = contribTotal + manualTotal
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0)
  const net           = totalIncome - totalExpenses
  const netPositive   = net >= 0

  // Group expenses by category, sorted desc
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

  // ----------------------------------------------------------------
  // Title block
  // ----------------------------------------------------------------
  const titleBlock = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 60 },
      children: [new TextRun({ text: 'SOUTHGATE CHRISTIAN CENTRE INTERNATIONAL', bold: true, size: 18, allCaps: true })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 40 },
      children: [new TextRun({ text: 'Easter Conference 2026', bold: true, size: 44, color: CLR.navy })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 80 },
      children: [new TextRun({ text: 'Income & Expenditure Report', bold: true, size: 32, color: CLR.navy })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 160 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: CLR.navy } },
      children: [new TextRun({ text: `Prepared: ${preparedDate} | Youth Secretary`, size: 17, color: CLR.muted })],
    }),
  ]

  // ----------------------------------------------------------------
  // Financial Summary — card grid (2 rows × 3 cols table)
  // ----------------------------------------------------------------
  function summaryCard(label: string, value: string, valueSm = false) {
    return new TableCell({
      width:   { size: COL.card, type: WidthType.DXA },
      shading: bgLight(CLR.summaryBg),
      margins: CPAD,
      borders: CELL_NO_BORDER,
      children: [
        new Paragraph({
          spacing: { after: 60 },
          children: [new TextRun({ text: label.toUpperCase(), bold: true, color: CLR.blue, size: 16, characterSpacing: 10 })],
        }),
        new Paragraph({
          children: [new TextRun({ text: value, bold: true, color: CLR.dark, size: valueSm ? 22 : 32 })],
        }),
      ],
    })
  }

  const summaryTable = new Table({
    width:   { size: W, type: WidthType.DXA },
    layout:  TableLayoutType.FIXED,
    borders: CARD_BORDERS,
    rows: [
      new TableRow({
        children: [
          summaryCard('Total Income',     fmt(totalIncome)),
          summaryCard('Total Expenditure', fmt(totalExpenses)),
          summaryCard(netPositive ? 'Net Surplus' : 'Net Deficit', fmt(Math.abs(net))),
        ],
      }),
      new TableRow({
        children: [
          summaryCard("People's Contributions", `${fmt(contribTotal)}  (${pct(contribTotal, totalIncome)})`, true),
          summaryCard('Other Income',           `${fmt(manualTotal)}  (${pct(manualTotal, totalIncome)})`, true),
          summaryCard('Activity Count',         `${contributions.length} contributions | ${expenses.length} expense items`, true),
        ],
      }),
    ],
  })

  // ----------------------------------------------------------------
  // Income Summary table
  // ----------------------------------------------------------------
  const incomeTable = dataTable([
    new TableRow({
      tableHeader: true,
      children: [
        headerCell('Income Source', COL.iLabel),
        headerCell('Amount ($)',    COL.iAmt,   AlignmentType.RIGHT),
        headerCell('% of Income',  COL.iPct,   AlignmentType.CENTER),
        headerCell('Notes',        COL.iNotes),
      ],
    }),
    new TableRow({
      children: [
        cell("People's Contributions", COL.iLabel),
        cell(fmt(contribTotal),        COL.iAmt,   { align: AlignmentType.RIGHT }),
        cell(pct(contribTotal, totalIncome), COL.iPct, { align: AlignmentType.CENTER }),
        cell(`${contributions.length} entries`, COL.iNotes),
      ],
    }),
    ...(manualTotal > 0 ? [
      new TableRow({
        children: [
          cell('Other Income',    COL.iLabel, { fill: CLR.rowAlt }),
          cell(fmt(manualTotal),  COL.iAmt,   { align: AlignmentType.RIGHT, fill: CLR.rowAlt }),
          cell(pct(manualTotal, totalIncome), COL.iPct, { align: AlignmentType.CENTER, fill: CLR.rowAlt }),
          cell(`${manualIncome.length} entries`, COL.iNotes, { fill: CLR.rowAlt }),
        ],
      }),
    ] : []),
    new TableRow({
      children: [
        totalCell('Total Income', COL.iLabel),
        totalCell(fmt(totalIncome), COL.iAmt, AlignmentType.RIGHT),
        totalCell('100.0%', COL.iPct, AlignmentType.CENTER),
        totalCell('', COL.iNotes),
      ],
    }),
  ])

  // ----------------------------------------------------------------
  // Other Income Detail table
  // ----------------------------------------------------------------
  const otherIncomeTable = dataTable([
    new TableRow({
      tableHeader: true,
      children: [
        headerCell('Date',        COL.oDate),
        headerCell('Description', COL.oDesc),
        headerCell('Type',        COL.oType),
        headerCell('Amount ($)',  COL.oAmt, AlignmentType.RIGHT),
      ],
    }),
    ...manualIncome.map((item, i) =>
      new TableRow({
        children: [
          cell(fmtDate(item.date),       COL.oDate, { fill: i % 2 === 1 ? CLR.rowAlt : undefined }),
          cell(item.description,          COL.oDesc, { fill: i % 2 === 1 ? CLR.rowAlt : undefined }),
          cell(item.category ?? 'Other', COL.oType, { fill: i % 2 === 1 ? CLR.rowAlt : undefined }),
          cell(fmt(item.amount),          COL.oAmt,  { align: AlignmentType.RIGHT, fill: i % 2 === 1 ? CLR.rowAlt : undefined }),
        ],
      })
    ),
  ])

  // ----------------------------------------------------------------
  // Expenditure Summary by Category table
  // ----------------------------------------------------------------
  const expSummaryTable = dataTable([
    new TableRow({
      tableHeader: true,
      children: [
        headerCell('Category',         COL.eLabel),
        headerCell('Amount ($)',       COL.eAmt,  AlignmentType.RIGHT),
        headerCell('% of Expenditure', COL.ePct,  AlignmentType.CENTER),
        headerCell('Rank',             COL.eRank, AlignmentType.CENTER),
      ],
    }),
    ...sortedCats.map(([cat, { amount }], i) =>
      new TableRow({
        children: [
          cell(cat,            COL.eLabel, { fill: i % 2 === 1 ? CLR.rowAlt : undefined }),
          cell(fmt(amount),    COL.eAmt,   { align: AlignmentType.RIGHT, fill: i % 2 === 1 ? CLR.rowAlt : undefined }),
          cell(pct(amount, totalExpenses), COL.ePct, { align: AlignmentType.CENTER, fill: i % 2 === 1 ? CLR.rowAlt : undefined }),
          cell(`${i + 1}`,     COL.eRank,  { align: AlignmentType.CENTER, fill: i % 2 === 1 ? CLR.rowAlt : undefined }),
        ],
      })
    ),
  ])

  // ----------------------------------------------------------------
  // Detailed Expenditure Schedule — one table per category
  // ----------------------------------------------------------------
  const detailBlocks: (Paragraph | Table)[] = []
  for (const [cat, { items, amount }] of sortedCats) {
    detailBlocks.push(catHeadingRow(`${cat}  —  ${fmt(amount)}`))
    detailBlocks.push(
      dataTable([
        new TableRow({
          tableHeader: true,
          children: [
            headerCell('Date',        COL.dDate),
            headerCell('Description', COL.dDesc),
            headerCell('Amount ($)',  COL.dAmt, AlignmentType.RIGHT),
          ],
        }),
        ...items.map((item, i) =>
          new TableRow({
            children: [
              cell(fmtDate(item.date), COL.dDate, { fill: i % 2 === 1 ? CLR.rowAlt : undefined }),
              cell(item.description,   COL.dDesc, { fill: i % 2 === 1 ? CLR.rowAlt : undefined }),
              cell(fmt(item.amount),   COL.dAmt,  { align: AlignmentType.RIGHT, fill: i % 2 === 1 ? CLR.rowAlt : undefined }),
            ],
          })
        ),
      ])
    )
    detailBlocks.push(subtotalPara(`Subtotal: ${fmt(amount)}`))
  }

  // ----------------------------------------------------------------
  // Sign-off table (no outer borders — clean look)
  // ----------------------------------------------------------------
  const signOffTable = new Table({
    width:   { size: W, type: WidthType.DXA },
    layout:  TableLayoutType.FIXED,
    borders: NO_BORDERS,
    rows: [
      new TableRow({
        children: ['Prepared by', 'Reviewed by', 'Approved by'].map((label) =>
          new TableCell({
            width:   { size: COL.sign, type: WidthType.DXA },
            margins: { top: 80, bottom: 80, left: 80, right: 80 },
            borders: CELL_NO_BORDER,
            children: [
              new Paragraph({
                spacing: { after: 0 },
                children: [new TextRun({ text: label, bold: true, size: 20, color: CLR.dark })],
              }),
              new Paragraph({
                spacing: { before: 360, after: 60 },
                border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: CLR.dark } },
                children: [],
              }),
              new Paragraph({
                spacing: { before: 60 },
                children: [new TextRun({ text: 'Name / Signature / Date', italics: true, color: CLR.muted, size: 16 })],
              }),
            ],
          })
        ),
      }),
    ],
  })

  // ----------------------------------------------------------------
  // Assemble document
  // ----------------------------------------------------------------
  return new Document({
    styles: {
      default: {
        document: {
          run: { font: 'Calibri', size: 18 },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 720, bottom: 720, left: 864, right: 864 },
          },
        },
        children: [
          ...titleBlock,

          sectionHeading('Financial Summary'),
          summaryTable,
          spacer(6),

          sectionHeading('Key Financial Insights'),
          bulletPara(insight1),
          bulletPara(insight2),
          bulletPara(insight3),

          sectionHeading('Income Summary'),
          incomeTable,
          ...(manualIncome.length > 0 ? [
            subLabel('Other Income Detail'),
            otherIncomeTable,
          ] : []),

          sectionHeading('Expenditure Summary by Category'),
          expSummaryTable,

          sectionHeading('Detailed Expenditure Schedule'),
          new Paragraph({
            spacing: { before: 0, after: 100 },
            children: [new TextRun({ text: 'Grouped by category for easier review and sign-off.', italics: true, color: CLR.muted, size: 17 })],
          }),
          ...detailBlocks,

          sectionHeading('Sign-off'),
          signOffTable,
        ],
      },
    ],
  })
}

// ---- API route ----

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const districtId = searchParams.get('district_id')

  const supabase = createServerClient()

  type ContributionSelectRow = {
    id: string; amount: number; note: string | null; date: string
    person: { name?: string } | null
  }
  type IncomeSelectRow = { id: string; amount: number; description: string; category: string | null; date: string }
  type ExpenseSelectRow = { id: string; amount: number; description: string; category: string | null; date: string }

  // District name
  let districtName = 'All Districts'
  if (districtId) {
    const { data: d } = await supabase.from('districts').select('name').eq('id', districtId).single()
    if (d) districtName = d.name
  }

  // Contributions
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
          id: c.id, date: c.date, person_name: c.person?.name ?? 'Unknown',
          note: c.note, amount: c.amount,
        }))
      }
    }
  } else {
    const { data: contribs } = await supabase
      .from('contributions')
      .select('id, amount, note, date, person:people(name)')
      .order('date', { ascending: false })
    contributions = ((contribs ?? []) as ContributionSelectRow[]).map((c) => ({
      id: c.id, date: c.date, person_name: c.person?.name ?? 'Unknown',
      note: c.note, amount: c.amount,
    }))
  }

  // Manual income
  let incomeQuery = supabase.from('income').select('id, amount, description, category, date').order('date', { ascending: false })
  if (districtId) incomeQuery = incomeQuery.eq('district_id', districtId)
  const { data: incomeRows } = await incomeQuery
  const manualIncome = ((incomeRows ?? []) as IncomeSelectRow[]).map((i) => ({
    id: i.id, date: i.date, description: i.description, category: i.category, amount: i.amount,
  }))

  const unassigned = manualIncome.filter(isUnassignedContributionIncome)
  const otherIncome = manualIncome.filter((e) => !isUnassignedContributionIncome(e))

  const promotedContributions = unassigned.map((e) => ({
    id: `income-${e.id}`, date: e.date, person_name: 'Unassigned', note: e.description, amount: e.amount,
  }))

  const allContributions = [...contributions, ...promotedContributions].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  )

  // Expenses
  let expQuery = supabase.from('expenses').select('id, amount, description, category, date').order('date', { ascending: false })
  if (districtId) expQuery = expQuery.eq('district_id', districtId)
  const { data: expRows } = await expQuery
  const expenses = ((expRows ?? []) as ExpenseSelectRow[]).map((e) => ({
    id: e.id, date: e.date, description: e.description, category: e.category, amount: e.amount,
  }))

  const preparedDate = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

  const doc = buildDoc({ districtName, preparedDate, contributions: allContributions, manualIncome: otherIncome, expenses })
  const buffer = await Packer.toBuffer(doc)

  const filename = `IE-Report-${districtName.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.docx`

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
