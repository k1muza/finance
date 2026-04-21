import { afterEach, describe, expect, it, vi } from 'vitest'
import { exportToCsv, parseCsv } from '@/lib/csv'

describe('parseCsv', () => {
  it('parses quoted fields, embedded commas, and skips empty rows', () => {
    const rows = parseCsv([
      'Name,Note,Amount',
      '"General Fund","Line with, comma",100',
      '',
      '"Tithes","Multi',
      'line",250',
    ].join('\r\n'))

    expect(rows).toEqual([
      { Name: 'General Fund', Note: 'Line with, comma', Amount: '100' },
      { Name: 'Tithes', Note: 'Multi\r\nline', Amount: '250' },
    ])
  })
})

describe('exportToCsv', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('creates a downloadable CSV blob for report exports', () => {
    const click = vi.fn()
    const anchor = {
      href: '',
      download: '',
      click,
    }
    const createElement = vi.fn(() => anchor)
    const createObjectURL = vi.fn(() => 'blob:report')
    const revokeObjectURL = vi.fn()

    vi.stubGlobal('document', {
      createElement,
    })
    vi.stubGlobal('URL', {
      createObjectURL,
      revokeObjectURL,
    })

    exportToCsv('cashbook-report.csv', [
      { Section: 'Receipts', Amount: 100 },
    ])

    expect(createElement).toHaveBeenCalledWith('a')
    expect(anchor.download).toBe('cashbook-report.csv')
    expect(anchor.href).toBe('blob:report')
    expect(click).toHaveBeenCalledTimes(1)
    expect(createObjectURL).toHaveBeenCalledTimes(1)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:report')
  })
})
