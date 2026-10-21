// lib/agent/capacity.ts — how many minutes of work fit on each day of the
// 14-day window. No `@/` imports so this runs under `npm test`.
import { pacificInstant, windowDays } from './dates.ts'

export type Capacity = Record<string, number>

// Share of free waking time offered to the plan, and the most in a day.
export const FREE_TIME_SHARE = 0.25
export const MAX_DAILY_MINUTES = 180

const WAKING_START = '08:00'
const WAKING_END = '22:00'

const WAKING_MINUTES = 14 * 60

// Today's waking window starts at `now` once 8am has passed (and is empty
// after 10pm), so time already gone is never offered.
function wakingFrom(day: string, today: string, now: Date): number {
  const start = pacificInstant(day, WAKING_START).getTime()
  return day === today ? Math.max(start, now.getTime()) : start
}

// The student said how long they have; every day gets that. Today only gets
// the share of it that fits in the waking time left.
export function capacityFromDailyMinutes(dailyMinutes: number, today: string, now: Date = new Date()): Capacity {
  const end = pacificInstant(today, WAKING_END).getTime()
  const left = Math.max(0, Math.floor((end - wakingFrom(today, today, now)) / 60000))
  return Object.fromEntries(
    windowDays(today).map((day) => [day, day === today ? Math.floor((dailyMinutes * left) / WAKING_MINUTES) : dailyMinutes]),
  )
}

// From calendar busy blocks: a quarter of the free time between 8am and 10pm
// Pacific (from now, for today), capped. Overlapping busy blocks are merged
// before counting.
export function capacityFromBusy(
  busy: { start: string; end: string }[],
  today: string,
  now: Date = new Date(),
): Capacity {
  const blocks = busy
    .map((b) => [new Date(b.start).getTime(), new Date(b.end).getTime()] as const)
    .filter(([s, e]) => e > s)
    .sort((a, b) => a[0] - b[0])

  const capacity: Capacity = {}
  for (const day of windowDays(today)) {
    const to = pacificInstant(day, WAKING_END).getTime()
    const from = Math.min(wakingFrom(day, today, now), to)

    let busyMs = 0
    let cursor = from
    for (const [s, e] of blocks) {
      const start = Math.max(s, cursor)
      const end = Math.min(e, to)
      if (end > start) {
        busyMs += end - start
        cursor = end
      }
    }

    const free = Math.max(0, Math.round((to - from - busyMs) / 60000))
    capacity[day] = Math.min(MAX_DAILY_MINUTES, Math.floor(free * FREE_TIME_SHARE))
  }
  return capacity
}

// Picks the capacity source. Calendar busy blocks win; with no calendar, a
// revoked one, or a transient Google failure, fall back to the student's daily
// minutes. null capacity = nothing to go on. `unavailable` lets the caller
// tell a blip apart from "never told us", so it doesn't ask the hours question.
export function capacityFor(
  settings: { daily_minutes: number | null } | null,
  busy: { start: string; end: string }[] | 'none' | 'reconnect' | 'unavailable',
  today: string,
  now: Date = new Date(),
): { capacity: Capacity | null; reconnect: boolean; unavailable: boolean } {
  if (Array.isArray(busy)) {
    return { capacity: capacityFromBusy(busy, today, now), reconnect: false, unavailable: false }
  }
  const minutes = settings?.daily_minutes
  return {
    capacity: minutes != null ? capacityFromDailyMinutes(minutes, today, now) : null,
    reconnect: busy === 'reconnect',
    unavailable: busy === 'unavailable',
  }
}
