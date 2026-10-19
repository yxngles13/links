// lib/profile.ts
//
// Pure helpers for the student profile: the personality prompt list, form
// parsing, link checks and upload checks. No `@/` imports so `npm test` can
// run this file directly under node.

// Edit freely: answers are stored by key, so renaming a prompt's text keeps
// existing answers, and removing a key just hides answers to it.
export const PROFILE_PROMPTS = [
  { key: 'problem', text: "A problem I can't stop thinking about…" },
  { key: 'rabbit_hole', text: 'The rabbit hole I went down most recently…' },
  { key: 'ask_me', text: "I'm the person you'd ask about…" },
  { key: 'summer_project', text: "A project I'd build if I had a free summer…" },
  { key: 'lab_vibe', text: 'My ideal lab vibe is…' },
  { key: 'working_on', text: "Something I'm bad at but working on…" },
  { key: 'learning', text: 'Currently learning…' },
  { key: 'best_class', text: "Best class I've taken and why…" },
  { key: 'outside_school', text: "Outside of school you'll find me…" },
  { key: 'lets_talk', text: "Let's talk about…" },
] as const

export const MAX_PROMPTS = 3
export const MAX_ANSWER_LENGTH = 150
export const MAX_HEADLINE_LENGTH = 120

export type PromptAnswer = { key: string; answer: string }

export function promptText(key: string): string | null {
  return PROFILE_PROMPTS.find((p) => p.key === key)?.text ?? null
}

// The form sends parallel prompt_key / prompt_answer lists. Anything a
// hand-crafted POST could slip in (extra prompts, unknown keys, essays) is
// dropped here rather than trusted.
export function parsePromptAnswers(keys: string[], answers: string[]): PromptAnswer[] {
  const out: PromptAnswer[] = []
  keys.forEach((key, i) => {
    const answer = (answers[i] ?? '').trim().slice(0, MAX_ANSWER_LENGTH)
    if (!answer || !promptText(key) || out.some((p) => p.key === key)) return
    out.push({ key, answer })
  })
  return out.slice(0, MAX_PROMPTS)
}

// Same rule as httpUrl in lib/format.ts (only http(s) ever reaches an
// <a href>), plus the host has to be the site the field is for.
function siteUrl(value: unknown, host: RegExp): string | null {
  const v = typeof value === 'string' ? value.trim() : ''
  if (!/^https?:\/\/\S+$/i.test(v)) return null
  try {
    return host.test(new URL(v).hostname) ? v.slice(0, 500) : null
  } catch {
    return null
  }
}

export const githubUrl = (v: unknown) => siteUrl(v, /^(www\.)?github\.com$/i)
export const linkedinUrl = (v: unknown) => siteUrl(v, /^([a-z]+\.)?linkedin\.com$/i)

// After matching re-runs, rows for professors that fell out of the new top
// results are removed, unless the student saved them. Contacted ones are
// passed in as part of keepOpportunityIds.
export function staleMatchIds(
  rows: { id: string; opportunity_id: string; saved_at: string | null }[],
  keepOpportunityIds: Set<string>
): string[] {
  return rows.filter((r) => !r.saved_at && !keepOpportunityIds.has(r.opportunity_id)).map((r) => r.id)
}

const MB = 1024 * 1024
const UPLOADS = {
  photo: { maxBytes: 1.5 * MB, types: { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }, label: 'Photo should be a JPEG, PNG or WebP under 1.5 MB.' },
  resume: { maxBytes: 2.5 * MB, types: { 'application/pdf': 'pdf' }, label: 'Resume should be a PDF under 2.5 MB.' },
} as const

// Photo and resume can arrive in the same save, so together (4 MB) they
// stay under serverActions.bodySizeLimit in next.config.ts.

// The browser-reported type is just a claim; check the file's first bytes.
const MAGIC: Record<string, number[][]> = {
  'application/pdf': [[0x25, 0x50, 0x44, 0x46]], // %PDF
  'image/png': [[0x89, 0x50, 0x4e, 0x47]],
  'image/jpeg': [[0xff, 0xd8, 0xff]],
  'image/webp': [[0x52, 0x49, 0x46, 0x46]], // RIFF
}

export function matchesFileType(head: Uint8Array, type: string): boolean {
  return (MAGIC[type] ?? []).some((sig) => sig.every((b, i) => head[i] === b))
}

// null = nothing chosen (browsers send an empty file for an untouched input).
export function validateUpload(
  file: File | null,
  kind: keyof typeof UPLOADS
): { ok: true; ext: string; type: string } | { ok: false; error: string } | null {
  if (!file || file.size === 0) return null
  const rule = UPLOADS[kind]
  const ext = (rule.types as Record<string, string>)[file.type]
  if (!ext || file.size > rule.maxBytes) return { ok: false, error: rule.label }
  return { ok: true, ext, type: file.type }
}
