// lib/agent/apply.ts — writes a validated brain-dump result: new plans and
// steps, updates, and at most one pause suggestion. Every change gets an
// agent_activity row whose `before` holds exactly the fields it overwrote,
// so Undo can put them back. Never deletes anything.
import type { SupabaseClient } from '@supabase/supabase-js'
import type { PlanChanges } from '@/lib/agent/plan-prompt'
import { rescheduleUser } from '@/lib/agent/reschedule'
import { previous } from '@/lib/agent/undo'

// A loaded agent_plans or agent_steps row (only the columns the apply reads).
export type Row = {
  id: string
  title: string
  position: number
  plan_id?: string // steps only
  [field: string]: unknown
}

type Action = 'created_plan' | 'added_step' | 'updated_plan' | 'updated_step' | 'marked_done' | 'suggested_pause'

// "2026-11-15" -> "Nov 15"
function shortDate(day: string): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

// Throws on any DB error; the caller marks the capture failed. Writes made
// before the error stay, each with its activity row, so they can be undone.
export async function applyChanges(
  supabase: SupabaseClient,
  userId: string,
  captureId: string,
  changes: PlanChanges,
  before: { plans: Map<string, Row>; steps: Map<string, Row> },
): Promise<void> {
  const check = (error: { message: string } | null, what: string) => {
    if (error) throw new Error(`Could not ${what}: ${error.message}`)
  }
  const log = async (
    action: Action,
    summary: string,
    ids: { plan_id: string | null; step_id?: string | null },
    prev: Record<string, unknown> | null,
  ) => {
    const { error } = await supabase.from('agent_activity').insert({
      user_id: userId,
      capture_id: captureId,
      action,
      plan_id: ids.plan_id,
      step_id: ids.step_id ?? null,
      summary,
      before: prev,
    })
    check(error, 'log activity')
  }

  const now = new Date().toISOString()
  const planIds = new Map<string, string>() // new-plan ref -> inserted id
  const planTitles = new Map<string, string>()
  for (const [id, p] of before.plans) planTitles.set(id, p.title)
  const resolve = (plan: string) => planIds.get(plan) ?? (before.plans.has(plan) ? plan : null)

  // New plans go after the existing ones.
  let nextPlanPos = Math.max(-1, ...[...before.plans.values()].map((p) => p.position)) + 1
  for (const p of changes.newPlans) {
    const { data, error } = await supabase
      .from('agent_plans')
      .insert({
        user_id: userId,
        kind: p.kind,
        title: p.title,
        done_looks_like: p.done_looks_like,
        deadline: p.deadline,
        deadline_suggested: p.deadline_suggested,
        position: nextPlanPos++,
        created_by: 'links',
      })
      .select('id')
      .single()
    check(error, 'create plan')
    planIds.set(p.ref, data!.id)
    planTitles.set(data!.id, p.title)
    await log('created_plan', `Created plan: ${p.title}`, { plan_id: data!.id }, null)
  }

  for (const u of changes.planUpdates) {
    const row = before.plans.get(u.planId)
    if (!row) continue
    const { planId, ...fields } = u
    const { error } = await supabase
      .from('agent_plans')
      .update({ ...fields, updated_at: now })
      .eq('id', planId)
      .eq('user_id', userId)
    check(error, 'update plan')
    if (fields.title) planTitles.set(planId, fields.title)
    await log('updated_plan', `Updated plan: ${fields.title ?? row.title}`, { plan_id: planId }, previous(row, Object.keys(fields)))
  }

  // New steps go after the plan's existing steps, unscheduled; the
  // reschedule below places them.
  const nextStepPos = new Map<string, number>()
  for (const s of before.steps.values()) {
    if (s.plan_id) nextStepPos.set(s.plan_id, Math.max(nextStepPos.get(s.plan_id) ?? 0, s.position + 1))
  }
  for (const s of changes.newSteps) {
    const planId = resolve(s.plan)
    if (!planId) continue
    const position = nextStepPos.get(planId) ?? 0
    nextStepPos.set(planId, position + 1)
    const { data, error } = await supabase
      .from('agent_steps')
      .insert({
        user_id: userId,
        plan_id: planId,
        title: s.title,
        minutes: s.minutes,
        day: null,
        pinned: false,
        contact_id: s.contactId,
        needs_person: s.needsPerson,
        position,
        created_by: 'links',
      })
      .select('id')
      .single()
    check(error, 'add step')
    await log('added_step', `Added step: ${s.title}`, { plan_id: planId, step_id: data!.id }, null)
  }

  for (const u of changes.stepUpdates) {
    const row = before.steps.get(u.stepId)
    if (!row) continue
    const fields: Record<string, unknown> = {}
    if (u.title !== undefined) fields.title = u.title
    if (u.minutes !== undefined) fields.minutes = u.minutes
    // Marking an already-done step done again changes nothing.
    const markDone = u.done === true && row.done_at == null
    if (markDone) fields.done_at = now
    if (!Object.keys(fields).length) continue

    const { error } = await supabase
      .from('agent_steps')
      .update({ ...fields, updated_at: now })
      .eq('id', u.stepId)
      .eq('user_id', userId)
    check(error, 'update step')
    const name = u.title ?? row.title
    await log(
      markDone ? 'marked_done' : 'updated_step',
      markDone ? `Marked done: ${name}` : `Updated step: ${name}`,
      { plan_id: row.plan_id ?? null, step_id: u.stepId },
      previous(row, Object.keys(fields)),
    )
  }

  // A pause is only worth suggesting when the plans don't all fit: keep it
  // only if, after placing everything, some active step is still Later.
  const pause = changes.pauses[0]
  const pausePlan = pause ? resolve(pause.plan) : null
  if (pause && pausePlan && before.plans.get(pausePlan)?.paused !== true) {
    // With no capacity nothing gets placed, so every step reads as Later;
    // that says nothing about overload, so drop the pause then.
    const { later, needsHours, unavailable } = await rescheduleUser(supabase, userId)
    if (later > 0 && !needsHours && !unavailable) {
      const title = planTitles.get(pausePlan) ?? ''
      const summary = `Suggested a pause: ${title} until ${shortDate(pause.until)}`
      const { error } = await supabase.from('agent_tradeoffs').insert({
        user_id: userId,
        plan_id: pausePlan,
        suggestion: pause.reason || summary,
        pause_until: pause.until,
        status: 'open',
      })
      check(error, 'suggest a pause')
      await log('suggested_pause', summary, { plan_id: pausePlan }, null)
    }
  }
}
