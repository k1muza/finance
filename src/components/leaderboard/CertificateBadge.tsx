interface Props {
  name: string
}

const STYLES: Record<string, string> = {
  'Bronze':        'bg-amber-900/30 text-amber-400 border border-amber-700/50',
  'Silver':        'bg-slate-700/50 text-slate-300 border border-slate-500/50',
  'Gold':          'bg-yellow-900/30 text-yellow-400 border border-yellow-600/50',
  'Platinum':      'bg-cyan-900/30 text-cyan-300 border border-cyan-600/50',
  'Diamond':       'bg-blue-900/30 text-blue-300 border border-blue-500/50',
  'Grand Diamond': 'bg-purple-900/30 text-purple-300 border border-purple-500/50',
}

const DEFAULT = 'bg-slate-700/40 text-slate-400 border border-slate-600/50'

export function CertificateBadge({ name }: Props) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${STYLES[name] ?? DEFAULT}`}>
      {name}
    </span>
  )
}
