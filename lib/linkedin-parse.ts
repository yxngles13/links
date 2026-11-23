// lib/linkedin-parse.ts
//
// Pure pieces of the extension's AI prefill: which URLs count as a LinkedIn
// profile, the per-profile cache key, and turning the model's JSON into the
// contact form's fields (with the extra details folded into labeled notes).
// No `@/` imports so `npm test` can run this file directly under node.

export type ParsedProfile = { full_name: string; role: string; company: string; notes: string; tags: string[] }

const MAX_TAGS = 3
const MAX_PAST_ROLES = 3
const PLACEHOLDER = /^(n\/?a|unknown|none|-+)$/i

export function isLinkedInProfileUrl(url: string): boolean {
  try {
    const u = new URL(url)
    return u.protocol === 'https:' && /^([a-z]+\.)?linkedin\.com$/i.test(u.hostname) && /^\/in\/[^/]+\/?$/.test(u.pathname)
  } catch {
    return false
  }
}

// "/in/priya/overlay/contact-info/" and other sub-pages still show the
// profile, so they count too: this returns origin + /in/<slug>, or null.
// The extension's popup.js copies this rule; keep them alike.
export function canonicalProfileUrl(url: string): string | null {
  try {
    const u = new URL(url)
    if (u.protocol !== 'https:' || !/^([a-z]+\.)?linkedin\.com$/i.test(u.hostname)) return null
    const slug = u.pathname.match(/^\/in\/([^/]+)/)?.[1]
    return slug ? `${u.origin}/in/${slug}` : null
  } catch {
    return null
  }
}

// Cache key per profile (see canonicalProfileUrl).
export function profileKey(url: string): string {
  const u = new URL(url)
  return `${u.origin}${u.pathname}`.toLowerCase().replace(/\/+$/, '')
}

// Strings and numbers become trimmed, clamped strings; placeholders the
// model uses for "don't know" become empty.
function clean(v: unknown, max: number): string {
  if (typeof v !== 'string' && typeof v !== 'number') return ''
  const s = String(v).trim()
  return PLACEHOLDER.test(s) ? '' : s.slice(0, max)
}

function list(v: unknown, max: number, each: number): string[] {
  if (!Array.isArray(v)) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of v) {
    const s = clean(item, each)
    if (!s || seen.has(s.toLowerCase())) continue
    seen.add(s.toLowerCase())
    out.push(s)
    if (out.length === max) break
  }
  return out
}

// "School: Cal Poly Pomona, Computer Science '24", then location, past
// roles and the About summary — only the lines that have something.
function buildNotes(o: Record<string, unknown>): string {
  const school = clean(o.school, 120)
  const major = clean(o.major, 120)
  const year = clean(o.grad_year, 4).match(/\d{4}$/)?.[0]
  const schoolLine = school ? [school, major && year ? `${major} '${year.slice(2)}` : major || (year ? `'${year.slice(2)}` : '')].filter(Boolean).join(', ') : ''
  const location = clean(o.location, 120)
  const before = list(o.past_roles, MAX_PAST_ROLES, 120)
  const about = clean(o.about_summary, 300)
  return [
    schoolLine && `School: ${schoolLine}`,
    location && `Location: ${location}`,
    before.length ? `Before: ${before.join('; ')}` : '',
    about && `About: ${about}`,
  ]
    .filter(Boolean)
    .join('\n')
}

export function parseModelOutput(raw: string): ParsedProfile | null {
  let o: unknown
  try {
    // Models sometimes wrap JSON in ```json fences despite instructions.
    o = JSON.parse(raw.replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, '').trim())
  } catch {
    return null
  }
  if (!o || typeof o !== 'object' || Array.isArray(o)) return null
  const r = o as Record<string, unknown>
  return {
    full_name: clean(r.full_name, 200),
    role: clean(r.role, 200),
    company: clean(r.company, 200),
    notes: buildNotes(r),
    tags: list(r.tags, MAX_TAGS, 30),
  }
}
