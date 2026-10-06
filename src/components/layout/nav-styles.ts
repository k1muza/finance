// Shared active-link styling for the app sidebar and the Settings menu.
// Active is deliberately quiet: a faint tint of the text colour (works on every
// theme surface), brighter text, and a short accent bar on the leading edge.

const ACTIVE_TINT = 'bg-[color-mix(in_srgb,var(--text-primary)_7%,transparent)] text-[var(--text-primary)]'

const ACTIVE_BAR =
  'relative before:absolute before:left-0 before:top-1/2 before:h-4 before:w-0.5 before:-translate-y-1/2 before:rounded-full before:bg-[var(--accent-solid)]'

/** Vertical menu item. */
export function navItemClass(active: boolean) {
  return active
    ? `${ACTIVE_TINT} ${ACTIVE_BAR}`
    : 'text-slate-400 hover:bg-[color-mix(in_srgb,var(--text-primary)_5%,transparent)] hover:text-slate-100'
}

/** Horizontal tab (phones), where a leading bar would look out of place. */
export function navTabClass(active: boolean) {
  return active
    ? ACTIVE_TINT
    : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'
}
