// app/plans/actions.ts
// Manual edits on the Plans page. Every action checks the signed-in user,
// filters by user_id as well as the row id, marks what the student changed
// (so Undo won't overwrite it), then re-places every step.
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { SupabaseClient } from '@supabase/supabase-js'
import { requireUser } from '@/lib/auth'
import { rescheduleUser } from '@/lib/agent/reschedule'
import { pinAfterEdit } from '@/lib/agent/schedule'

const MAX_TITLE = 140

function fail(planId: string | null, message: string): never {
  const base = planId ? `/plans?plan=${encodeURIComponent(planId)}&` : '/plans?'
  redirect(`${base}error=${encodeURIComponent(message)}`)
}

// A real calendar day as 'YYYY-MM-DD', or null.
function parseDay(raw: FormDataEntryValue | null): string | null {
  if (typeof raw !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null
  const d = new Date(`${raw}T00:00:00Z`)
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== raw ? null : raw
}

function parseTitle(raw: FormDataEntryValue | null, planId: string | null): string {
  const title = String(raw ?? '').trim()
  if (!title) fail(planId, 'Give it a title')
  if (title.length > MAX_TITLE) fail(planId, `Keep the title under ${MAX_TITLE} characters`)
  return title
}

function parseMinutes(raw: FormDataEntryValue | null, planId: string | null): number {
  const minutes = Number(String(raw ?? '').trim())
  if (!Number.isInteger(minutes) || minutes < 10 || minutes > 240) fail(planId, 'Minutes must be a whole number from 10 to 240')
  return minutes
}

// Reads an optional day field: empty is null, anything else must be a real day.
function optionalDay(raw: FormDataEntryValue | null, planId: string | null): string | null {
  if (typeof raw !== 'string' || !raw.trim()) return null
  const day = parseDay(raw.trim())
  if (!day) fail(planId, 'Use a valid date')
  return day
}

// Re-places the steps and sends the student back to the plan they were on.
async function finish(supabase: SupabaseClient, userId: string, planId: string): Promise<never> {
  await rescheduleUser(supabase, userId)
  revalidatePath('/plans')
  redirect(`/plans?plan=${encodeURIComponent(planId)}`)
}

// The plan a step belongs to, for the redirect. Only the owner's steps count.
async function stepPlan(supabase: SupabaseClient, userId: string, stepId: string) {
  const { data } = await supabase
    .from('agent_steps')
    .select('id, plan_id, done_at, day, pinned')
    .eq('id', stepId)
    .eq('user_id', userId)
    .maybeSingle()
  if (!data) fail(null, "Couldn't find that step")
  return data as { id: string; plan_id: string; done_at: string | null; day: string | null; pinned: boolean }
}

async function ownsPlan(supabase: SupabaseClient, userId: string, planId: string): Promise<boolean> {
  const { data } = await supabase.from('agent_plans').select('id').eq('id', planId).eq('user_id', userId).maybeSingle()
  return data != null
}

function dbFail(planId: string | null, what: string, message: string): never {
  console.error(`Could not ${what}:`, message)
  fail(planId, `Couldn't ${what}. Try again.`)
}

export async function toggleStepDone(stepId: string) {
  const { supabase, user } = await requireUser()
  const step = await stepPlan(supabase, user.id, stepId)
  const now = new Date().toISOString()
  const { error } = await supabase
    .from('agent_steps')
    .update({ done_at: step.done_at ? null : now, student_edited_at: now })
    .eq('id', stepId)
    .eq('user_id', user.id)
  if (error) dbFail(step.plan_id, 'update that step', error.message)
  await finish(supabase, user.id, step.plan_id)
}

export async function updateStep(formData: FormData) {
  const { supabase, user } = await requireUser()
  const step = await stepPlan(supabase, user.id, String(formData.get('step_id') ?? ''))
  const title = parseTitle(formData.get('title'), step.plan_id)
  const minutes = parseMinutes(formData.get('minutes'), step.plan_id)
  const day = optionalDay(formData.get('day'), step.plan_id)
  // The form pre-fills the current day, so only a different day pins it;
  // clearing it hands the step back to the scheduler.
  const { error } = await supabase
    .from('agent_steps')
    .update({ title, minutes, day, pinned: pinAfterEdit(step, day), student_edited_at: new Date().toISOString() })
    .eq('id', step.id)
    .eq('user_id', user.id)
  if (error) dbFail(step.plan_id, 'save that step', error.message)
  await finish(supabase, user.id, step.plan_id)
}

export async function addStep(formData: FormData) {
  const { supabase, user } = await requireUser()
  const planId = String(formData.get('plan_id') ?? '')
  if (!(await ownsPlan(supabase, user.id, planId))) fail(null, "Couldn't find that plan")
  const title = parseTitle(formData.get('title'), planId)
  const minutes = parseMinutes(formData.get('minutes'), planId)
  const day = optionalDay(formData.get('day'), planId)

  // New steps go last in the plan.
  const { data: last } = await supabase
    .from('agent_steps')
    .select('position')
    .eq('plan_id', planId)
    .eq('user_id', user.id)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()
  const now = new Date().toISOString()
  const { error } = await supabase.from('agent_steps').insert({
    user_id: user.id,
    plan_id: planId,
    title,
    minutes,
    day,
    pinned: day != null,
    position: (last?.position ?? -1) + 1,
    created_by: 'student',
    student_edited_at: now,
  })
  if (error) dbFail(planId, 'add that step', error.message)
  await finish(supabase, user.id, planId)
}

export async function deleteStep(stepId: string) {
  const { supabase, user } = await requireUser()
  const step = await stepPlan(supabase, user.id, stepId)
  const { error } = await supabase.from('agent_steps').delete().eq('id', stepId).eq('user_id', user.id)
  if (error) dbFail(step.plan_id, 'delete that step', error.message)
  await finish(supabase, user.id, step.plan_id)
}

export async function updatePlan(formData: FormData) {
  const { supabase, user } = await requireUser()
  const planId = String(formData.get('plan_id') ?? '')
  if (!(await ownsPlan(supabase, user.id, planId))) fail(null, "Couldn't find that plan")
  const title = parseTitle(formData.get('title'), planId)
  const doneLooksLike = String(formData.get('done_looks_like') ?? '').trim().slice(0, 500) || null
  const deadline = optionalDay(formData.get('deadline'), planId)
  const now = new Date().toISOString()
  // Once the student sets the deadline it is theirs, not a suggestion.
  const { error } = await supabase
    .from('agent_plans')
    .update({ title, done_looks_like: doneLooksLike, deadline, deadline_suggested: false, student_edited_at: now, updated_at: now })
    .eq('id', planId)
    .eq('user_id', user.id)
  if (error) dbFail(planId, 'save that plan', error.message)
  await finish(supabase, user.id, planId)
}

export async function pausePlan(formData: FormData) {
  const { supabase, user } = await requireUser()
  const planId = String(formData.get('plan_id') ?? '')
  if (!(await ownsPlan(supabase, user.id, planId))) fail(null, "Couldn't find that plan")
  // No date pauses until the student resumes it.
  const until = optionalDay(formData.get('until'), planId)
  const now = new Date().toISOString()
  const { error } = await supabase
    .from('agent_plans')
    .update({ paused: true, paused_until: until, student_edited_at: now, updated_at: now })
    .eq('id', planId)
    .eq('user_id', user.id)
  if (error) dbFail(planId, 'pause that plan', error.message)
  await finish(supabase, user.id, planId)
}

export async function resumePlan(planId: string) {
  const { supabase, user } = await requireUser()
  if (!(await ownsPlan(supabase, user.id, planId))) fail(null, "Couldn't find that plan")
  const now = new Date().toISOString()
  const { error } = await supabase
    .from('agent_plans')
    .update({ paused: false, paused_until: null, student_edited_at: now, updated_at: now })
    .eq('id', planId)
    .eq('user_id', user.id)
  if (error) dbFail(planId, 'resume that plan', error.message)
  await finish(supabase, user.id, planId)
}

export async function deletePlan(formData: FormData) {
  const { supabase, user } = await requireUser()
  const planId = String(formData.get('plan_id') ?? '')
  if (formData.get('confirm') !== 'delete') fail(planId || null, 'Confirm to delete the plan')
  if (!(await ownsPlan(supabase, user.id, planId))) fail(null, "Couldn't find that plan")
  // Steps and trade-offs go with it (on delete cascade).
  const { error } = await supabase.from('agent_plans').delete().eq('id', planId).eq('user_id', user.id)
  if (error) dbFail(planId, 'delete that plan', error.message)
  await rescheduleUser(supabase, user.id)
  revalidatePath('/plans')
  redirect('/plans')
}

export async function resolveTradeoff(formData: FormData) {
  const { supabase, user } = await requireUser()
  const choice = String(formData.get('choice') ?? '')
  if (choice !== 'pause' && choice !== 'keep') fail(null, 'Pick pause or keep')
  const { data: tradeoff } = await supabase
    .from('agent_tradeoffs')
    .select('id, plan_id, pause_until, status')
    .eq('id', String(formData.get('tradeoff_id') ?? ''))
    .eq('user_id', user.id)
    .maybeSingle()
  if (!tradeoff || !tradeoff.plan_id) fail(null, "Couldn't find that suggestion")
  const planId = tradeoff.plan_id as string
  if (tradeoff.status !== 'open') await finish(supabase, user.id, planId)

  const now = new Date().toISOString()
  if (choice === 'pause') {
    const { error } = await supabase
      .from('agent_plans')
      .update({ paused: true, paused_until: tradeoff.pause_until, student_edited_at: now, updated_at: now })
      .eq('id', planId)
      .eq('user_id', user.id)
    if (error) dbFail(planId, 'pause that plan', error.message)
  }
  const { error } = await supabase
    .from('agent_tradeoffs')
    .update({ status: choice === 'pause' ? 'paused' : 'kept' })
    .eq('id', tradeoff.id)
    .eq('user_id', user.id)
  if (error) dbFail(planId, 'save that choice', error.message)
  await finish(supabase, user.id, planId)
}
