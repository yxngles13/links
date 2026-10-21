// lib/agent/dates.ts — Pacific calendar-day helpers for the agent. Days are
// 'YYYY-MM-DD' strings; no `@/` imports so this runs under `npm test`.

const TZ = 'America/Los_Angeles'

// The Pacific calendar day for an instant (a 11:30pm dump is still "today").
export function pacificToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

// Calendar arithmetic on a day string (done in UTC, so DST never shifts it).
export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}

// `n` consecutive days starting at `today`.
export function windowDays(today: string, n = 14): string[] {
  return Array.from({ length: n }, (_, i) => addDays(today, i))
}

// Pacific offset from UTC in minutes (e.g. -420 for PDT) at a given instant.
function pacificOffsetMinutes(at: Date): number {
  const part = new Intl.DateTimeFormat('en-US', { timeZone: TZ, timeZoneName: 'shortOffset' })
    .formatToParts(at)
    .find((p) => p.type === 'timeZoneName')?.value ?? 'GMT'
  const m = part.match(/GMT([+-])(\d+)(?::(\d+))?/)
  if (!m) return 0
  const sign = m[1] === '-' ? -1 : 1
  return sign * (Number(m[2]) * 60 + Number(m[3] ?? 0))
}

// The UTC instant of a Pacific wall-clock time (DST-correct).
export function pacificInstant(day: string, hhmm: string): Date {
  const [y, mo, d] = day.split('-').map(Number)
  const [h, mi] = hhmm.split(':').map(Number)
  const wall = Date.UTC(y, mo - 1, d, h, mi)
  // Guess with the offset at the naive instant, then re-check at the result
  // so times next to a clock change land on the right side of it.
  const first = wall - pacificOffsetMinutes(new Date(wall)) * 60000
  return new Date(wall - pacificOffsetMinutes(new Date(first)) * 60000)
}
