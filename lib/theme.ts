// lib/theme.ts
// The Pastel Pop palette as data, for the things CSS can't do on its own:
// giving each professor or contact a stable pastel tint, picking a score
// badge tier, and proving every text/fill pair in app/globals.css is
// readable (lib/theme.test.ts). Keep the hex values here in step with the
// tokens on :root in app/globals.css. No `@/` imports, so `node --test` runs it.

export type Pastel = 'lilac' | 'mint' | 'peach' | 'butter'

const PASTELS: Pastel[] = ['lilac', 'mint', 'peach', 'butter']

// Same key, same pastel, on every visit and on both list and detail pages.
// FNV-1a: cheap, stable across runtimes, and spreads short names well.
export function pastelFor(key: string): Pastel {
  let hash = 0x811c9dc5
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return PASTELS[(hash >>> 0) % PASTELS.length]
}

// Same cutoffs as toCompatibilityLabel in lib/matching.ts.
export function scoreTier(similarity: number): 'strong' | 'good' | 'possible' {
  if (similarity >= 0.6) return 'strong'
  if (similarity >= 0.4) return 'good'
  return 'possible'
}

function luminance(hex: string) {
  const n = parseInt(hex.replace('#', ''), 16)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

// WCAG 2 contrast ratio between two #RRGGBB colors (1 to 21).
export function contrastRatio(fg: string, bg: string): number {
  const [a, b] = [luminance(fg), luminance(bg)].sort((x, y) => y - x)
  return (a + 0.05) / (b + 0.05)
}

// Mirrors :root in app/globals.css.
export const COLORS = {
  bg: '#FFF6F0',
  surface: '#FFFFFF',
  ink: '#2D2140',
  muted: '#6B5F7A',
  // The mockup's #7C5CFF gives white text only 4.35:1, so the accent is
  // nudged darker to the nearest shade of the same purple that passes.
  accent: '#7858FA',
  accentInk: '#5B3FE0',
  lilac: '#F0EAFF',
  lilacInk: '#5B3FE0',
  mint: '#DFF6EC',
  mintInk: '#1E7A55',
  peach: '#FFE9DB',
  peachInk: '#A8461A',
  butter: '#FFF4C7',
  butterInk: '#6E5A12',
  danger: '#C0392B',
  white: '#FFFFFF',
} as const

// Hover shades used in globals.css (not tokens of their own).
const HOVER = {
  ink: '#45365C', // .btn
  accent: '#6A4AE6', // .btn-accent
  danger: '#A93226', // .btn-danger
  soft: '#E4DAFF', // .btn-soft
  link: '#3F26B8', // .link
} as const

// Every text-on-fill pair the theme uses, as [text, fill].
export const THEME_PAIRS: [fg: string, bg: string][] = [
  [COLORS.ink, COLORS.bg],
  [COLORS.ink, COLORS.surface],
  [COLORS.muted, COLORS.bg],
  [COLORS.muted, COLORS.surface],
  [COLORS.white, COLORS.accent],
  [COLORS.white, COLORS.ink],
  [COLORS.lilacInk, COLORS.lilac],
  [COLORS.mintInk, COLORS.mint],
  [COLORS.peachInk, COLORS.peach],
  [COLORS.butterInk, COLORS.butter],
  [COLORS.accentInk, COLORS.surface],
  [COLORS.accentInk, COLORS.bg],
  [COLORS.danger, COLORS.surface],
  // Ink on each pastel: chips, tags and pastel cards use plain ink text.
  [COLORS.ink, COLORS.lilac],
  [COLORS.ink, COLORS.mint],
  [COLORS.ink, COLORS.peach],
  [COLORS.ink, COLORS.butter],
  // Muted metadata and accent-ink links inside pastel cards and tiles.
  [COLORS.muted, COLORS.lilac],
  [COLORS.muted, COLORS.mint],
  [COLORS.muted, COLORS.peach],
  [COLORS.muted, COLORS.butter],
  [COLORS.accentInk, COLORS.mint],
  [COLORS.accentInk, COLORS.peach],
  [COLORS.accentInk, COLORS.butter],
  // White on danger: .btn-danger and the .count badge.
  [COLORS.white, COLORS.danger],
  // Danger on the page: .alert sits on the bg.
  [COLORS.danger, COLORS.bg],
  // Hover fills and hover link color in globals.css.
  [COLORS.white, HOVER.ink],
  [COLORS.white, HOVER.accent],
  [COLORS.white, HOVER.danger],
  [COLORS.ink, HOVER.soft],
  [HOVER.link, COLORS.surface],
  [HOVER.link, COLORS.bg],
]
