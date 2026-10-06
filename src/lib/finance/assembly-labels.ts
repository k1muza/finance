const ASSEMBLY_LABELS: Record<string, string> = {
  'southgate christian center international': 'SCCI',
  'ezekiel christian center international': 'ECCI',
  'sunningdale': 'SD',
  'sunningdale district': 'SD',
  'southlea park d1': 'SPD1',
}

export function getAssemblyLabel(name: string | null | undefined) {
  const normalized = name?.trim().replace(/\s+/g, ' ') ?? ''
  if (!normalized) return 'Unassigned'

  return ASSEMBLY_LABELS[normalized.toLowerCase()]
    ?? normalized
      .split(' ')
      .map((part) => (/\d/.test(part) ? part.toUpperCase() : part[0]?.toUpperCase() ?? ''))
      .join('')
}
