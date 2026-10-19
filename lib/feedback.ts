// lib/feedback.ts
//
// Pure pieces of the exit / "Feedback" survey: the choices, when to show it,
// and form parsing. No `@/` imports so `npm test` can run this directly.

export const FEEDBACK_FEATURES = ['Research matches', 'Network', 'Mentors', 'Profile', 'Just looking around'] as const
export const FEEDBACK_REASONS = [
  'Done for now',
  "Couldn't find what I needed",
  'Something was confusing',
  'Something broke',
  'Other',
] as const

export const MAX_FEEDBACK_COMMENT = 1000
export const PROMPT_EVERY_MS = 7 * 24 * 60 * 60 * 1000 // at most once a week
export const MIN_TIME_ON_SITE_MS = 30 * 1000 // don't ask someone who just arrived

// Exit-intent only: the "Feedback" link in the nav opens the survey anytime.
export function shouldPromptOnExit(lastShownAt: number | null, msOnPage: number, now: number): boolean {
  if (msOnPage < MIN_TIME_ON_SITE_MS) return false
  return lastShownAt === null || now - lastShownAt >= PROMPT_EVERY_MS
}

export type Feedback = {
  rating: number | null
  features: string[]
  reason: string | null
  comment: string | null
  page: string | null
}

// Unknown choices are dropped rather than stored: the form is the only
// legitimate source, and free text belongs in the comment.
export function parseFeedback(form: { get(name: string): unknown; getAll(name: string): unknown[] }): Feedback | null {
  const rating = Number(form.get('rating'))
  const features = form.getAll('features').map(String).filter((f) => (FEEDBACK_FEATURES as readonly string[]).includes(f))
  const reasonRaw = String(form.get('reason') ?? '')
  const reason = (FEEDBACK_REASONS as readonly string[]).includes(reasonRaw) ? reasonRaw : null
  const comment = String(form.get('comment') ?? '').trim().slice(0, MAX_FEEDBACK_COMMENT) || null
  const pageRaw = String(form.get('page') ?? '')
  const page = pageRaw.startsWith('/') ? pageRaw.slice(0, 200) : null
  const fb = { rating: Number.isInteger(rating) && rating >= 1 && rating <= 5 ? rating : null, features, reason, comment, page }
  // An empty submission isn't feedback.
  return fb.rating || fb.features.length || fb.reason || fb.comment ? fb : null
}
