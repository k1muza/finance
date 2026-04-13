import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx'

type TransactionRow = {
  id: string
  district_id: string
  description: string
  amount: number
  category: string | null
  date: string
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

function baseCell(text: string, opts?: { bold?: boolean; align?: typeof AlignmentType[keyof typeof AlignmentType]; fill?: string }) {
  return new TableCell({
    children: [
      new Paragraph({
        alignment: opts?.align,
        children: [
          new TextRun({
            text,
            bold: opts?.bold,
            color: opts?.fill ? 'FFFFFF' : 'E2E8F0',
          }),
        ],
      }),
    ],
    shading: opts?.fill ? { fill: opts.fill } : undefined,
    borders: {
      top: { style: BorderStyle.SINGLE, color: '334155', size: 2 },
      bottom: { style: BorderStyle.SINGLE, color: '334155', size: 2 },
      left: { style: BorderStyle.SINGLE, color: '334155', size: 2 },
      right: { style: BorderStyle.SINGLE, color: '334155', size: 2 },
    },
  })
}

function summaryTable(totalIncome: number, totalExpenses: number, netBalance: number) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          baseCell('Metric', { bold: true, fill: '0F172A' }),
          baseCell('Amount', { bold: true, align: AlignmentType.RIGHT, fill: '0F172A' }),
        ],
      }),
      new TableRow({
        children: [
          baseCell('Total Income'),
          baseCell(fmtCurrency(totalIncome), { align: AlignmentType.RIGHT }),
        ],
      }),
      new TableRow({
        children: [
          baseCell('Total Expenditure'),
          baseCell(fmtCurrency(totalExpenses), { align: AlignmentType.RIGHT }),
        ],
      }),
      new TableRow({
        children: [
          baseCell(netBalance >= 0 ? 'Surplus' : 'Deficit', { bold: true }),
          baseCell(fmtCurrency(Math.abs(netBalance)), { bold: true, align: AlignmentType.RIGHT }),
        ],
      }),
    ],
  })
}

function transactionTable(title: string, rows: TransactionRow[], showDistrict: boolean) {
  const headerCells = [
    baseCell('Date', { bold: true, fill: '0F172A' }),
    ...(showDistrict ? [baseCell('District', { bold: true, fill: '0F172A' })] : []),
    baseCell('Description', { bold: true, fill: '0F172A' }),
    baseCell('Category', { bold: true, fill: '0F172A' }),
    baseCell('Amount', { bold: true, align: AlignmentType.RIGHT, fill: '0F172A' }),
  ]

  const tableRows = rows.length > 0
    ? rows.map((row) => new TableRow({
      children: [
        baseCell(fmtDate(row.date)),
        ...(showDistrict ? [baseCell(districtNameOf(row))] : []),
        baseCell(row.description),
        baseCell(row.category ?? 'Uncategorised'),
        baseCell(fmtCurrency(row.amount), { align: AlignmentType.RIGHT }),
      ],
    }))
    : [
      new TableRow({
        children: [
          baseCell(`No ${title.toLowerCase()} entries recorded.`),
          ...(showDistrict ? [baseCell('')] : []),
          baseCell(''),
          baseCell(''),
          baseCell('', { align: AlignmentType.RIGHT }),
        ],
      }),
    ]

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ children: headerCells }),
      ...tableRows,
    ],
  })
}

export async function GET(request: NextRequest) {
  const districtId = request.nextUrl.searchParams.get('district_id')
  const supabase = createServerClient()

  let incomeQuery = supabase
    .from('income')
    .select('id, district_id, description, amount, category, date, district:districts(name)')
    .order('date', { ascending: false })

  let expensesQuery = supabase
    .from('expenses')
    .select('id, district_id, description, amount, category, date, district:districts(name)')
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
  const showDistrict = !districtId

  const doc = new Document({
    sections: [{
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: 'District Finance Dashboard', bold: true, size: 32 })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 120 },
          children: [new TextRun({ text: 'Income & Expenditure Statement', bold: true, size: 28 })],
        }),
        new Paragraph({
          spacing: { after: 80 },
          children: [new TextRun({ text: `Scope: ${districtName}   Prepared: ${preparedDate}`, size: 22 })],
        }),
        summaryTable(totalIncome, totalExpenses, netBalance),
        new Paragraph({ text: '', spacing: { after: 160 } }),
        new Paragraph({
          spacing: { after: 80 },
          children: [new TextRun({ text: 'Income', bold: true, size: 26 })],
        }),
        transactionTable('Income', (income ?? []) as TransactionRow[], showDistrict),
        new Paragraph({ text: '', spacing: { after: 160 } }),
        new Paragraph({
          spacing: { after: 80 },
          children: [new TextRun({ text: 'Expenditure', bold: true, size: 26 })],
        }),
        transactionTable('Expenditure', (expenses ?? []) as TransactionRow[], showDistrict),
      ],
    }],
  })

  const buffer = await Packer.toBuffer(doc)
  const filename = `income-expenditure-${districtName.replace(/\s+/g, '-').toLowerCase()}.docx`

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
