// lib/format.ts
// Small display helpers shared across pages.

export function initials(name: string | null | undefined) {
  return (name ?? '?')
    .replace(/^Dr\.?\s+/i, '')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

const DAY = 24 * 60 * 60 * 1000

export function timeAgo(iso: string | null | undefined, now = Date.now()) {
  if (!iso) return 'Never'
  const days = Math.floor((now - new Date(iso).getTime()) / DAY)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  if (days < 30) return `${Math.floor(days / 7)} week${days < 14 ? '' : 's'} ago`
  if (days < 365) return `${Math.floor(days / 30)} month${days < 60 ? '' : 's'} ago`
  return `${Math.floor(days / 365)} year${days < 730 ? '' : 's'} ago`
}

// A contact "needs follow-up" once two weeks pass without a logged
// interaction. One shared rule so the table, the header count and the
// contact page never disagree.
export const FOLLOW_UP_AFTER_DAYS = 14

export function needsFollowUp(lastInteractionAt: string | null | undefined, now = Date.now()) {
  if (!lastInteractionAt) return true
  return now - new Date(lastInteractionAt).getTime() > FOLLOW_UP_AFTER_DAYS * DAY
}

export function formatChatTime(iso: string) {
  // Fixed to Pacific time: every user is at CPP, and server-rendered pages
  // would otherwise print the server's timezone.
  return new Date(iso).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Los_Angeles',
  })
}

// "How you met" choices, shared by the in-app dialog and the extension.
export const MET_OPTIONS = ['LinkedIn message', 'Career fair', 'Coffee chat', 'Club event', 'Class', 'Other']

export function toArray(value: FormDataEntryValue | null): string[] {
  if (!value || typeof value !== 'string') return []
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

// Only http(s) links are ever stored or rendered: these end up in an
// <a href>, and a "javascript:" URL there would run in the user's session.
export function httpUrl(value: unknown): string | null {
  const v = typeof value === 'string' ? value.trim() : ''
  return /^https?:\/\/\S+$/i.test(v) ? v.slice(0, 500) : null
}
