'use client'

import { useEffect } from 'react'
import { useDistrictContributions } from '@/hooks/useDistrictContributions'
import { useIncome } from '@/hooks/useIncome'
import { useExpenses } from '@/hooks/useExpenses'
import { useDistricts } from '@/hooks/useDistricts'
import { useAuth } from '@/contexts/AuthContext'

function fmt(amount: number) {
  return `$ ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function pct(part: number, total: number) {
  if (total === 0) return '—'
  return `${((part / total) * 100).toFixed(1)}%`
}

export default function PrintReportPage() {
  const { districtId } = useAuth()
  const { data: districts } = useDistricts()

  const { data: contributions, loading: l1, total: contribTotal } = useDistrictContributions({
    district_id: districtId ?? undefined,
  })
  const { data: manualIncome, loading: l2, total: manualTotal } = useIncome({
    district_id: districtId ?? undefined,
  })
  const { data: expenses, loading: l3, total: totalExpenses } = useExpenses({
    district_id: districtId ?? undefined,
  })

  const loading = l1 || l2 || l3
  const districtName = districtId
    ? (districts.find((d) => d.id === districtId)?.name ?? 'District')
    : 'All Districts'
  const totalIncome = contribTotal + manualTotal
  const net = totalIncome - totalExpenses
  const netPositive = net >= 0
  const preparedDate = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

  // Group expenses by category
  const expensesByCategory = expenses.reduce<Record<string, { amount: number; items: typeof expenses }>>((acc, e) => {
    const key = e.category ?? 'Uncategorised'
    if (!acc[key]) acc[key] = { amount: 0, items: [] }
    acc[key].amount += e.amount
    acc[key].items.push(e)
    return acc
  }, {})

  // Auto-print once data is loaded
  useEffect(() => {
    if (!loading && districts.length > 0) {
      const timer = setTimeout(() => window.print(), 400)
      return () => clearTimeout(timer)
    }
  }, [loading, districts.length])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'sans-serif', color: '#666' }}>
        Preparing report…
      </div>
    )
  }

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: white; color: #1a1a1a; font-family: 'Georgia', serif; font-size: 10pt; }

        .page { max-width: 210mm; margin: 0 auto; padding: 18mm 18mm 14mm; }

        /* Print button — hidden when printing */
        .print-btn {
          position: fixed; top: 16px; right: 16px;
          background: #7a1c1c; color: white; border: none;
          padding: 8px 20px; border-radius: 6px; cursor: pointer;
          font-family: sans-serif; font-size: 13px; font-weight: 600;
          box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        }
        @media print { .print-btn { display: none !important; } }

        /* Header */
        .doc-header {
          border-bottom: 2px solid #1a1a1a;
          padding-bottom: 6pt;
          margin-bottom: 18pt;
          display: flex;
          justify-content: space-between;
          align-items: baseline;
        }
        .doc-header-org { font-family: sans-serif; font-size: 8pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; }
        .doc-header-title { font-family: sans-serif; font-size: 8pt; color: #555; }

        .report-title { text-align: center; margin-bottom: 16pt; }
        .report-title h1 { font-size: 22pt; font-weight: 900; color: #7a1c1c; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 4pt; }
        .report-title h2 { font-size: 14pt; font-weight: 700; color: #1a1a1a; margin-bottom: 4pt; }
        .report-title p { font-size: 9.5pt; color: #444; font-style: italic; }

        /* Section heading */
        .section-heading {
          font-family: sans-serif; font-size: 10pt; font-weight: 800;
          text-transform: uppercase; letter-spacing: 0.06em;
          color: #7a1c1c;
          border-bottom: 1.5px solid #7a1c1c;
          padding-bottom: 3pt;
          margin: 18pt 0 10pt;
        }

        /* Tables */
        table { width: 100%; border-collapse: collapse; margin-bottom: 10pt; }
        th {
          background: #1a1a1a; color: white;
          font-family: sans-serif; font-size: 9pt; font-weight: 700;
          padding: 5pt 8pt; text-align: left;
        }
        th.right, td.right { text-align: right; }
        th.center, td.center { text-align: center; }
        td { padding: 4pt 8pt; border-bottom: 0.5pt solid #ddd; font-size: 9.5pt; }

        /* Summary table */
        .summary-table td.label { font-weight: 400; }
        .summary-table tr.total-income td,
        .summary-table tr.total-exp td { font-weight: 700; font-family: sans-serif; background: #f5f5f5; }
        .summary-table tr.total-income td { color: #15642a; }
        .summary-table tr.total-exp td { color: #7a1c1c; }
        .summary-table tr.net td { font-weight: 800; font-family: sans-serif; background: #fdf8e8; color: #856404; }

        /* Sub-section heading inside income/expenditure */
        .subsection-heading td {
          background: #fdf5e8;
          font-family: sans-serif; font-size: 8.5pt; font-weight: 700;
          text-transform: uppercase; letter-spacing: 0.05em;
          color: #7a1c1c;
          border: none;
          padding: 5pt 8pt 4pt;
        }

        /* Subtotal row */
        .subtotal td { font-style: italic; font-weight: 700; background: #fafafa; border-top: 0.75pt solid #aaa; color: #7a1c1c; }

        /* Total rows */
        .row-total td { font-weight: 800; font-family: sans-serif; font-size: 10pt; background: #1a1a1a; color: white; border: none; }
        .row-net td { font-weight: 800; font-family: sans-serif; font-size: 11pt; background: #fdf8e8; color: #856404; border: 1.5pt solid #c9a227; }

        /* Page break */
        .avoid-break { break-inside: avoid; }

        /* Footer */
        .doc-footer {
          border-top: 1pt solid #ccc; margin-top: 24pt; padding-top: 6pt;
          font-family: sans-serif; font-size: 7.5pt; color: #888;
          display: flex; justify-content: space-between;
        }
        @media print {
          .page { padding: 12mm 14mm 10mm; }
          .doc-footer { position: running(footer); }
        }
      `}</style>

      <button className="print-btn" onClick={() => window.print()}>Print / Save as PDF</button>

      <div className="page">
        {/* Doc header */}
        <div className="doc-header">
          <span className="doc-header-org">Southgate Christian Centre International</span>
          <span className="doc-header-title">Easter Conference 2026 — Income &amp; Expenditure Report</span>
        </div>

        {/* Report title */}
        <div className="report-title">
          <h1>Easter Conference 2026</h1>
          <h2>Income &amp; Expenditure Report</h2>
          <p>{districtName} &middot; Prepared: {preparedDate}</p>
        </div>

        {/* Financial Summary */}
        <div className="section-heading">Financial Summary</div>
        <table className="summary-table">
          <thead>
            <tr>
              <th>Summary</th>
              <th className="right">Amount ($)</th>
              <th className="center">% of Income</th>
              <th className="center">Count</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="label">People&apos;s Contributions</td>
              <td className="right">{fmt(contribTotal)}</td>
              <td className="center">{pct(contribTotal, totalIncome)}</td>
              <td className="center">{contributions.length} {contributions.length === 1 ? 'entry' : 'entries'}</td>
            </tr>
            {manualTotal > 0 && (
              <tr>
                <td className="label">Other Income</td>
                <td className="right">{fmt(manualTotal)}</td>
                <td className="center">{pct(manualTotal, totalIncome)}</td>
                <td className="center">{manualIncome.length} {manualIncome.length === 1 ? 'entry' : 'entries'}</td>
              </tr>
            )}
            <tr className="total-income">
              <td>Total Income</td>
              <td className="right">{fmt(totalIncome)}</td>
              <td className="center">100%</td>
              <td />
            </tr>
            <tr className="total-exp">
              <td>Total Expenditure</td>
              <td className="right">{fmt(totalExpenses)}</td>
              <td className="center">{pct(totalExpenses, totalIncome)}</td>
              <td className="center">{expenses.length} items</td>
            </tr>
            <tr className="net">
              <td>{netPositive ? 'Net Surplus' : 'Net Deficit'}</td>
              <td className="right">{fmt(Math.abs(net))}</td>
              <td className="center">{pct(Math.abs(net), totalIncome)}</td>
              <td />
            </tr>
          </tbody>
        </table>

        {/* INCOME */}
        <div className="section-heading">Income</div>

        <table>
          <tbody>
            {/* People's Contributions */}
            <tr className="subsection-heading"><td colSpan={3}>People&apos;s Contributions</td></tr>
            <tr>
              <th style={{ background: '#444' }}>Date</th>
              <th style={{ background: '#444' }}>Contributor</th>
              <th className="right" style={{ background: '#444' }}>Amount</th>
            </tr>
            <tr className="subtotal">
              <td colSpan={2}>Assigned Contributions Subtotal</td>
              <td className="right">{fmt(contribTotal)}</td>
            </tr>

            {/* Other Income */}
            {manualIncome.length > 0 && (
              <>
                <tr style={{ height: '8pt' }}><td colSpan={3} style={{ border: 'none', background: 'white' }} /></tr>
                <tr className="subsection-heading"><td colSpan={3}>Other Income</td></tr>
                <tr>
                  <th style={{ background: '#444' }}>Date</th>
                  <th style={{ background: '#444' }}>Description</th>
                  <th className="right" style={{ background: '#444' }}>Amount</th>
                </tr>
                {manualIncome.map((item) => (
                  <tr key={item.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{new Date(item.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                    <td>{item.description}{item.category ? ` (${item.category})` : ''}</td>
                    <td className="right">{fmt(item.amount)}</td>
                  </tr>
                ))}
                <tr className="subtotal">
                  <td colSpan={2}>Other Income Subtotal</td>
                  <td className="right">{fmt(manualTotal)}</td>
                </tr>
              </>
            )}
          </tbody>
        </table>

        <table>
          <tbody>
            <tr className="row-total">
              <td colSpan={2}>Total Income</td>
              <td className="right">{fmt(totalIncome)}</td>
            </tr>
          </tbody>
        </table>

        {/* EXPENDITURE */}
        <div className="section-heading" style={{ pageBreakBefore: 'auto' }}>Expenditure</div>

        <table>
          <tbody>
            <tr className="subsection-heading"><td colSpan={4}>Expenditure Details</td></tr>
            <tr>
              <th style={{ background: '#444', width: '13%' }}>Date</th>
              <th style={{ background: '#444', width: '22%' }}>Category</th>
              <th style={{ background: '#444' }}>Description</th>
              <th className="right" style={{ background: '#444', width: '14%' }}>Amount</th>
            </tr>
            {Object.entries(expensesByCategory)
              .sort(([, a], [, b]) => b.amount - a.amount)
              .map(([cat, { items, amount }]) => (
                <React.Fragment key={cat}>
                  {items.map((item, i) => (
                    <tr key={item.id} className="avoid-break">
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {new Date(item.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td>{i === 0 ? <strong>{cat}</strong> : ''}</td>
                      <td>{item.description}</td>
                      <td className="right">{fmt(item.amount)}</td>
                    </tr>
                  ))}
                  <tr className="subtotal avoid-break">
                    <td colSpan={3}>{cat} Subtotal</td>
                    <td className="right">{fmt(amount)}</td>
                  </tr>
                  <tr style={{ height: '6pt' }}><td colSpan={4} style={{ border: 'none', background: 'white' }} /></tr>
                </React.Fragment>
              ))}
          </tbody>
        </table>

        <table>
          <tbody>
            <tr className="row-total">
              <td colSpan={3}>Total Expenditure</td>
              <td className="right">{fmt(totalExpenses)}</td>
            </tr>
            <tr style={{ height: '6pt' }}><td colSpan={4} style={{ border: 'none', background: 'white' }} /></tr>
            <tr className="row-net">
              <td colSpan={3}>{netPositive ? 'Net Surplus' : 'Net Deficit'}</td>
              <td className="right">{fmt(Math.abs(net))}</td>
            </tr>
          </tbody>
        </table>

        {/* Footer */}
        <div className="doc-footer">
          <span>Prepared by the Finance Committee &middot; {districtName}</span>
          <span>Prepared: {preparedDate}</span>
        </div>
      </div>
    </>
  )
}

// Need React in scope for React.Fragment
import React from 'react'
