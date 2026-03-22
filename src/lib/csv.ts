/**
 * Parse a CSV string into an array of row objects.
 * Row 1 is treated as headers. Empty rows are skipped.
 * Handles quoted fields (including commas and newlines inside quotes).
 */
export function parseCsv(text: string): Record<string, string>[] {
  const lines = splitCsvLines(text)
  if (lines.length < 2) return []

  const headers = parseCsvLine(lines[0]).map((h) => h.trim())

  return lines.slice(1).flatMap((line) => {
    const values = parseCsvLine(line)
    const obj: Record<string, string> = {}
    headers.forEach((h, i) => {
      obj[h] = (values[i] ?? '').trim()
    })
    const hasValue = Object.values(obj).some((v) => v !== '')
    return hasValue ? [obj] : []
  })
}

/** Split CSV text into lines, respecting quoted fields that may contain newlines. */
function splitCsvLines(text: string): string[] {
  const lines: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') {
        // Escaped quote inside a quoted field
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
        current += ch
      }
    } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
      // Skip \r in \r\n sequences
      if (ch === '\r' && text[i + 1] === '\n') i++
      lines.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  if (current) lines.push(current)

  return lines.filter((l) => l.trim() !== '')
}

/** Parse a single CSV line into an array of field strings. */
function parseCsvLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  fields.push(current)
  return fields
}
