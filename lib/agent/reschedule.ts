// lib/agent/reschedule.ts — re-places every step on a day after anything
// changes: loads the student's capacity (calendar first, then daily minutes),
// plans and steps, runs `schedule`, and writes back only the days that moved.
import type { SupabaseClient } from '@supabase/supabase-js'
import { addDays, pacificInstant, pacificToday } from '@/lib/agent/dates'
import { capacityFor } from '@/lib/agent/capacity'
import { isPlanActive, schedule, type SchedStep } from '@/lib/agent/schedule'
import { getBusy } from '@/lib/agent/google'

export type RescheduleResult = {
  needsHours: boolean // no settings and no calendar: ask the hours question
  reconnect: boolean // Google rejected the connection; show "Reconnect Google Calendar"
  unavailable: boolean // a transient calendar (or load) failure; days only stay put if there was no daily_minutes fallback
  overloaded: string[] // days whose pinned steps exceed the capacity
  later: number // not-done steps of active plans with no day
}

// `now` sizes today: only the waking time left counts.
export async function rescheduleUser(
  supabase: SupabaseClient,
  userId: string,
  now: Date = new Date(),
): Promise<RescheduleResult> {
  const today = pacificToday(now)
  const [settingsRes, plansRes, stepsRes] = await Promise.all([
    supabase.from('agent_settings').select('daily_minutes').eq('user_id', userId).maybeSingle(),
    supabase.from('agent_plans').select('id, position, paused, paused_until').eq('user_id', userId),
    supabase.from('agent_steps').select('id, plan_id, position, minutes, day, pinned, done_at').eq('user_id', userId),
  ])
  if (plansRes.error || stepsRes.error) {
    console.error('Reschedule could not load plans:', (plansRes.error ?? stepsRes.error)?.message)
    return { needsHours: false, reconnect: false, unavailable: true, overloaded: [], later: 0 }
  }

  const busy = await getBusy(userId, pacificInstant(today, '00:00'), pacificInstant(addDays(today, 14), '00:00'))
  const { capacity, reconnect, unavailable } = capacityFor(settingsRes.data ?? null, busy, today, now)

  const plans = new Map((plansRes.data ?? []).map((p) => [p.id as string, p]))
  const steps: SchedStep[] = (stepsRes.data ?? []).map((s) => {
    const plan = plans.get(s.plan_id)
    return {
      id: s.id,
      planId: s.plan_id,
      planOrder: plan?.position ?? 0,
      order: s.position,
      minutes: s.minutes,
      day: s.day,
      pinned: s.pinned,
      done: s.done_at != null,
      planActive: plan ? isPlanActive(plan, today) : false,
    }
  })
  const countLater = (days: Record<string, string | null>) =>
    steps.filter((s) => !s.done && s.planActive && days[s.id] == null).length

  // No capacity: leave every day where it is. Only ask for hours when the
  // student never gave any, not when the calendar had a blip.
  if (!capacity) {
    const current = Object.fromEntries(steps.map((s) => [s.id, s.day]))
    return { needsHours: !unavailable, reconnect, unavailable, overloaded: [], later: countLater(current) }
  }

  const { days, overloaded } = schedule(steps, capacity, today)

  // Group the moved steps by their new day so each day is one update.
  const moves = new Map<string | null, string[]>()
  for (const s of steps) {
    if (!(s.id in days) || days[s.id] === s.day) continue
    const day = days[s.id]
    moves.set(day, [...(moves.get(day) ?? []), s.id])
  }
  for (const [day, ids] of moves) {
    const { error } = await supabase.from('agent_steps').update({ day }).eq('user_id', userId).in('id', ids)
    if (error) console.error('Reschedule could not move steps:', error.message)
  }

  return { needsHours: false, reconnect, unavailable, overloaded, later: countLater(days) }
}
