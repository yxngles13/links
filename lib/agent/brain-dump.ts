// lib/agent/brain-dump.ts — one brain-dump run: save the text, ask Groq for
// plan changes, validate them fully, then apply and reschedule. The capture
// is saved first, so a failure anywhere leaves the text there to retry.
import Groq from 'groq-sdk'
import type { SupabaseClient } from '@supabase/supabase-js'
import { embed } from '@/lib/embeddings'
import { parseVector } from '@/lib/similarity'
import { OUT_OF_CREDITS, spendCredit } from '@/lib/credits'
import { pacificToday } from '@/lib/agent/dates'
import { isPlanActive } from '@/lib/agent/schedule'
import {
  buildPlanPrompt,
  parsePlanResponse,
  pickContacts,
  type PlanChanges,
  type PromptPlan,
  type Starter,
} from '@/lib/agent/plan-prompt'
import { applyChanges, type Row } from '@/lib/agent/apply'
import { rescheduleUser } from '@/lib/agent/reschedule'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export const BRAIN_DUMP_FAILED = "Couldn't make your plan. Your text is saved; try again."

// What a starter run saves as its capture text, so it reads well in Recent
// captures and a retry can parse the answers back out.
export function starterCaptureText(s: Starter): string {
  return `Starter plan · role: ${s.role ?? 'No idea yet'} · by: ${s.when}`
}

const isEmpty = (c: PlanChanges) =>
  !c.newPlans.length && !c.planUpdates.length && !c.newSteps.length && !c.stepUpdates.length && !c.pauses.length

async function askGroq(prompt: string): Promise<string | null> {
  try {
    const completion = await groq.chat.completions.create({
      model: 'openai/gpt-oss-120b',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.4,
    })
    return completion.choices[0]?.message?.content ?? null
  } catch (err) {
    console.error('Brain dump model call failed:', err)
    return null
  }
}

export async function runBrainDump(
  supabase: SupabaseClient,
  userId: string,
  text: string,
  opts: { captureId?: string; starter?: Starter } = {},
): Promise<{ ok: true } | { ok: false; error: string; captureId: string }> {
  const dump = opts.starter ? '' : text.trim()

  // 1. Save the capture (or reuse it on a retry).
  let captureId = ''
  if (opts.captureId) {
    const { data, error } = await supabase
      .from('agent_captures')
      .update({ status: 'pending' })
      .eq('id', opts.captureId)
      .eq('user_id', userId)
      .select('id')
      .maybeSingle()
    // A real DB error keeps the old capture to retry; only a capture that
    // no longer exists falls through to a fresh insert.
    if (error) {
      console.error('Could not reset capture:', error.message)
      return { ok: false, error: BRAIN_DUMP_FAILED, captureId: opts.captureId }
    }
    captureId = data?.id ?? ''
  }
  if (!captureId) {
    const { data, error } = await supabase
      .from('agent_captures')
      .insert({ user_id: userId, text: opts.starter ? starterCaptureText(opts.starter) : dump, status: 'pending' })
      .select('id')
      .single()
    if (error || !data) {
      console.error('Could not save capture:', error?.message)
      return { ok: false, error: BRAIN_DUMP_FAILED, captureId: '' }
    }
    captureId = data.id
  }

  const setStatus = async (status: 'done' | 'failed') => {
    const { error } = await supabase.from('agent_captures').update({ status }).eq('id', captureId).eq('user_id', userId)
    return error
  }
  const fail = async (error = BRAIN_DUMP_FAILED) => {
    const statusError = await setStatus('failed')
    if (statusError) console.error('Could not mark capture failed:', statusError.message)
    return { ok: false as const, error, captureId }
  }

  // 2. One credit per run, before the model.
  if (!(await spendCredit(supabase))) return fail(OUT_OF_CREDITS)

  // 3. What Links already knows.
  const [settingsRes, plansRes, stepsRes, contactsRes] = await Promise.all([
    supabase.from('agent_settings').select('daily_minutes').eq('user_id', userId).maybeSingle(),
    supabase
      .from('agent_plans')
      .select('id, kind, title, done_looks_like, deadline, deadline_suggested, paused, paused_until, position')
      .eq('user_id', userId)
      .order('position'),
    supabase
      .from('agent_steps')
      .select('id, plan_id, title, minutes, done_at, position')
      .eq('user_id', userId)
      .order('position'),
    supabase
      .from('network_contacts')
      .select('id, full_name, role, company, met_context, contact_embedding')
      .eq('user_id', userId),
  ])
  if (plansRes.error || stepsRes.error) {
    console.error('Could not load plans:', (plansRes.error ?? stepsRes.error)?.message)
    return fail()
  }
  const planRows = (plansRes.data ?? []) as Row[]
  const stepRows = (stepsRes.data ?? []) as Row[]
  // Contacts are a nice-to-have: a missing table or an error means none.
  const contacts = contactsRes.error
    ? []
    : (contactsRes.data ?? []).map((c) => ({
        id: c.id as string,
        full_name: (c.full_name as string | null) ?? '',
        role: c.role,
        company: c.company,
        met_context: c.met_context,
        vector: parseVector(c.contact_embedding),
      }))

  // 4. Contacts relevant to the dump. Without an embedding, name matches only.
  const matchText = dump || opts.starter?.role || ''
  let vector: number[] | null = null
  if (matchText && contacts.length) {
    try {
      vector = await embed(matchText)
    } catch (err) {
      console.error('Brain dump embedding failed:', err)
    }
  }
  const picked = pickContacts(matchText, vector, contacts)

  // 5. Ask the model, then validate everything before writing anything.
  const today = pacificToday()
  const plans: PromptPlan[] = planRows.map((p) => ({
    id: p.id,
    kind: p.kind === 'career' ? 'career' : 'idea',
    title: p.title,
    done_looks_like: (p.done_looks_like as string | null) ?? null,
    deadline: (p.deadline as string | null) ?? null,
    // A pause whose end date has passed has lifted.
    paused: !isPlanActive({ paused: p.paused === true, paused_until: (p.paused_until as string | null) ?? null }, today),
    steps: stepRows
      .filter((s) => s.plan_id === p.id)
      .map((s) => ({ id: s.id, title: s.title, minutes: s.minutes as number, done: s.done_at != null })),
  }))
  const raw = await askGroq(
    buildPlanPrompt({
      dump,
      today,
      dailyMinutes: settingsRes.data?.daily_minutes ?? null,
      plans,
      contacts: picked,
      starter: opts.starter,
    }),
  )
  const changes = raw
    ? parsePlanResponse(raw, {
        today,
        planIds: new Set(planRows.map((p) => p.id)),
        stepIds: new Set(stepRows.map((s) => s.id)),
        contactIds: new Set(picked.map((c) => c.id)),
        starter: !!opts.starter,
      })
    : null

  // 6. Junk, a timeout, or an answer with nothing usable in it.
  if (!changes || isEmpty(changes)) return fail()

  // 7. Apply, place the new steps, and close out the capture.
  try {
    await applyChanges(supabase, userId, captureId, changes, {
      plans: new Map(planRows.map((p) => [p.id, p])),
      steps: new Map(stepRows.map((s) => [s.id, s])),
    })
  } catch (err) {
    console.error('Brain dump apply failed:', err)
    return fail()
  }
  await rescheduleUser(supabase, userId)
  // The changes are in either way; retry the status once so the capture
  // doesn't sit at 'pending'.
  const doneError = (await setStatus('done')) && (await setStatus('done'))
  if (doneError) console.error('Could not mark capture done:', doneError.message)
  return { ok: true }
}
