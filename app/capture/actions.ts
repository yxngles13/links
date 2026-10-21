// app/capture/actions.ts
'use server'

import { redirect } from 'next/navigation'
import type { SupabaseClient } from '@supabase/supabase-js'
import { requireUser } from '@/lib/auth'
import { rescheduleUser } from '@/lib/agent/reschedule'
import { runBrainDump } from '@/lib/agent/brain-dump'
import type { Starter } from '@/lib/agent/plan-prompt'
import { WHEN_OPTIONS } from '@/lib/agent/starter-options'

const MAX_DUMP = 5000
// Only these pages may be named as a return path.
const RETURN_PATHS = ['/capture', '/plans', '/activity']

function fail(path: string, message: string, retry?: string): never {
  const sep = path.includes('?') ? '&' : '?'
  redirect(`${path}${sep}error=${encodeURIComponent(message)}${retry ? `&retry=${encodeURIComponent(retry)}` : ''}`)
}

// Hours a day in half-hour steps, 0 to 12. Returns minutes, or null if the
// field is empty or not a valid number.
function parseHours(raw: FormDataEntryValue | null): number | null {
  if (typeof raw !== 'string' || !raw.trim()) return null
  const hours = Number(raw)
  if (!Number.isFinite(hours) || hours < 0 || hours > 12 || !Number.isInteger(hours * 2)) return null
  return Math.min(720, Math.max(0, Math.round(hours * 60)))
}

// Saves daily hours when the form sent a valid number. A bad number is
// ignored on optional fields and fails the request on required ones.
async function saveHours(supabase: SupabaseClient, userId: string, formData: FormData, back: string) {
  const minutes = parseHours(formData.get('daily_hours'))
  if (minutes == null) {
    if (formData.get('hours_required') === '1') fail(back, 'Enter your hours a day as a number from 0 to 12, in half hours.')
    return
  }
  const { error } = await supabase
    .from('agent_settings')
    .upsert({ user_id: userId, daily_minutes: minutes, updated_at: new Date().toISOString() })
  if (error) {
    console.error('Could not save hours:', error.message)
    fail(back, "Couldn't save your hours. Try again.")
  }
}

async function readStarterProfile(supabase: SupabaseClient, userId: string): Promise<Starter['profile']> {
  const { data, error } = await supabase
    .from('student_profiles')
    .select('major, research_interests, technical_skills, career_goals')
    .eq('user_id', userId)
    .maybeSingle()
  if (error || !data) return null
  return data as Starter['profile']
}

// Reverses starterCaptureText so a retry re-runs the same starter.
function parseStarter(text: string): { role: string | null; when: string } | null {
  const m = /^Starter plan · role: ([\s\S]*) · by: ([\s\S]*)$/.exec(text)
  if (!m) return null
  return { role: m[1] === 'No idea yet' ? null : m[1], when: m[2] }
}

async function finish(result: Awaited<ReturnType<typeof runBrainDump>>): Promise<never> {
  if (result.ok) redirect('/plans')
  fail('/capture', result.error, result.captureId || undefined)
}

export async function makePlan(formData: FormData) {
  const { supabase, user } = await requireUser()
  await saveHours(supabase, user.id, formData, '/capture')

  // A retry uses the saved capture, not whatever the form says. Only a
  // failed capture reruns: one that already went through (say, a back-button
  // resubmit) or is still running just goes to the plans.
  const captureId = String(formData.get('capture_id') ?? '')
  if (captureId) {
    const { data } = await supabase
      .from('agent_captures')
      .select('id, text, status')
      .eq('id', captureId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (data && data.status !== 'failed') redirect('/plans')
    if (data) {
      const parsed = parseStarter(data.text as string)
      if (parsed) {
        const profile = await readStarterProfile(supabase, user.id)
        return finish(await runBrainDump(supabase, user.id, '', { captureId: data.id, starter: { ...parsed, profile } }))
      }
      return finish(await runBrainDump(supabase, user.id, data.text as string, { captureId: data.id }))
    }
  }

  const text = String(formData.get('text') ?? '').trim()
  if (!text) fail('/capture', 'Write something first')
  if (text.length > MAX_DUMP) fail('/capture', "That's a lot. Keep it under 5,000 characters")
  return finish(await runBrainDump(supabase, user.id, text))
}

export async function makeStarterPlan(formData: FormData) {
  const { supabase, user } = await requireUser()
  await saveHours(supabase, user.id, formData, '/capture?start=1')

  const noIdea = formData.get('no_idea') === 'on'
  // " · " separates the answers in the saved capture text, so keep it out of the role.
  const role = noIdea ? '' : String(formData.get('role') ?? '').replace(/·/g, '-').trim().slice(0, 200)
  const when = String(formData.get('when') ?? '')
  const starter: Starter = {
    role: role || null,
    when: WHEN_OPTIONS.includes(when) ? when : 'Not sure',
    profile: await readStarterProfile(supabase, user.id),
  }
  return finish(await runBrainDump(supabase, user.id, '', { starter }))
}

// Saves daily hours and re-places every step. Task 8's Plans page reuses this.
export async function setDailyHours(formData: FormData) {
  const { supabase, user } = await requireUser()
  const raw = String(formData.get('return_to') ?? '')
  const back = RETURN_PATHS.includes(raw) ? raw : '/capture'
  if (parseHours(formData.get('daily_hours')) == null) fail(back, 'Enter your hours a day as a number from 0 to 12, in half hours.')
  await saveHours(supabase, user.id, formData, back)
  await rescheduleUser(supabase, user.id)
  redirect(back)
}
