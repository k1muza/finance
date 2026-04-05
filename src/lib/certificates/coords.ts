export interface CertCoords {
  /** Horizontal center of the name text as a fraction of image width (0–1) */
  x: number
  /** Vertical center of the name text as a fraction of image height (0–1) */
  y: number
  /** Font size as a fraction of image height (0–1) */
  fontSize: number
  /** CSS color string for the name text */
  color: string
}

const DEFAULT: CertCoords = {
  x: 0.575,
  y: 0.50,
  fontSize: 0.048,
  color: '#1a3a2a',
}

/**
 * Per-certificate name injection coordinates.
 * Key must match the template filename slug (lowercase).
 * e.g. "bronze" matches "bronze-template.jpeg"
 *
 * Add an entry here whenever you add a new template to public/certificates/.
 * Falls back to DEFAULT if no entry exists for the slug.
 */
const CERT_COORDS: Record<string, CertCoords> = {
  bronze: {
    x: 0.575,
    y: 0.50,
    fontSize: 0.048,
    color: '#1a3a2a',
  },
  silver: { x: 0.55, y: 0.52, fontSize: 0.05, color: '#1e293b' },
  gold:   { x: 0.55, y: 0.49, fontSize: 0.05, color: '#78350f' },
  platinum: { x: 0.55, y: 0.49, fontSize: 0.05, color: '#666666' },
}

export function getCertCoords(slug: string): CertCoords {
  return CERT_COORDS[slug.toLowerCase()] ?? DEFAULT
}
