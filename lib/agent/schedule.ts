// lib/agent/schedule.ts — decides which day each plan step lands on. Pure; no I/O.
import { windowDays } from './dates.ts'
import type { Capacity } from './capacity.ts'

export type SchedStep = {
  id: string; planId: string; planOrder: number; order: number; minutes: number
  day: string | null; pinned: boolean; done: boolean; planActive: boolean
}

// A plan is active unless paused; a pause with an end date lifts on that day.
export function isPlanActive(plan: { paused: boolean; paused_until: string | null }, today: string): boolean {
  return !plan.paused || (plan.paused_until != null && plan.paused_until <= today)
}

// A step's pin after the student edits it: picking a different day pins it,
// clearing the day hands it back to the scheduler, and resaving the same day
// (the edit form pre-fills it) keeps whatever it was.
export function pinAfterEdit(stored: { day: string | null; pinned: boolean }, day: string | null): boolean {
  if (day == null) return false
  return day !== stored.day ? true : stored.pinned
}

export function schedule(
  steps: SchedStep[], capacity: Capacity, today: string,
): { days: Record<string, string | null>; overloaded: string[] } {
  const window = windowDays(today)
  const inWindow = new Set(window)
  const live = steps.filter(s => !s.done)
  const days: Record<string, string | null> = {}
  const used: Record<string, number> = {}
  const planDays = new Map<string, Set<string>>() // days each plan already has a step on
  const claim = (s: SchedStep, day: string) => {
    used[day] = (used[day] ?? 0) + s.minutes
    if (!planDays.has(s.planId)) planDays.set(s.planId, new Set())
    planDays.get(s.planId)!.add(day)
  }

  // Work already done today has used up that much of today. Other done
  // steps don't count against anything.
  for (const s of steps) {
    if (s.done && s.day === today) used[today] = (used[today] ?? 0) + s.minutes
  }
  // Pinned steps keep their day (even a past one) and use up its capacity.
  const pinnedUsed: Record<string, number> = {}
  for (const s of live) {
    if (s.pinned && s.day) {
      days[s.id] = s.day; claim(s, s.day)
      pinnedUsed[s.day] = (pinnedUsed[s.day] ?? 0) + s.minutes
    }
  }
  // "Over your time" is about what the student pinned, not work they already
  // finished (today's capacity has already shrunk for the hours gone by).
  // Only window days have a capacity, so past or off-window pinned days are never reported.
  const overloaded = Object.keys(pinnedUsed).filter(d => d in capacity && pinnedUsed[d] > capacity[d]).sort()

  // Everything else, in plan order then step order. `prev` is the plan's previous step's day;
  // once a step is Later, the rest of its plan is Later too.
  const sorted = [...live].sort((a, b) => a.planOrder - b.planOrder || a.order - b.order)
  const prev = new Map<string, string | null | undefined>() // undefined = no previous step yet
  for (const s of sorted) {
    if (s.pinned && s.day) { prev.set(s.planId, s.day); continue }
    if (!s.planActive) { days[s.id] = null; continue }
    const before = prev.get(s.planId)
    let chosen: string | null = null
    if (before !== null) {
      const ok = (d: string) =>
        inWindow.has(d) &&
        (used[d] ?? 0) + s.minutes <= (capacity[d] ?? 0) &&
        !planDays.get(s.planId)?.has(d) &&
        (before === undefined || d > before)
      chosen = s.day && ok(s.day) ? s.day : window.find(ok) ?? null
    }
    days[s.id] = chosen
    if (chosen) claim(s, chosen)
    prev.set(s.planId, chosen)
  }
  return { days, overloaded }
}
