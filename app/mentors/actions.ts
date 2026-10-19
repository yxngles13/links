// app/mentors/actions.ts
// Student-side mentor writes: requests, scheduling, goals.
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireUser, displayName } from '@/lib/auth'
import { findOrCreateContact, recordInteraction } from '@/lib/network'
import { mentorFitLabel, pacificLocalToISO, rankMentorsForStudent } from '@/lib/mentors'

function fail(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`)
}

export async function requestChat(formData: FormData) {
  const { supabase, user } = await requireUser()
  const mentorId = String(formData.get('mentor_profile_id') ?? '')

  const ranked = await rankMentorsForStudent(supabase, user.id)
  const match = ranked.find((r) => r.mentor.id === mentorId)
  if (!match) fail('/mentors/find', 'That mentor is not taking new requests right now.')

  const { data: open } = await supabase
    .from('mentorship_requests')
    .select('id')
    .eq('student_user_id', user.id)
    .eq('mentor_profile_id', mentorId)
    .in('status', ['requested', 'accepted', 'scheduled'])
    .limit(1)
  if (open?.length) fail('/mentors', `You already have an open request with ${match.mentor.full_name}.`)

  // Copied onto the request so the mentor can see who is asking without
  // read access to student_profiles.
  const { data: profile } = await supabase
    .from('student_profiles')
    .select('academic_year, major')
    .eq('user_id', user.id)
    .maybeSingle()

  const { error } = await supabase.from('mentorship_requests').insert({
    student_user_id: user.id,
    mentor_profile_id: mentorId,
    student_name: displayName(user),
    student_summary: [profile?.academic_year, profile?.major].filter(Boolean).join(', ') || null,
    topic: String(formData.get('topic') ?? '').trim() || null,
    message: String(formData.get('message') ?? '').trim() || null,
    fit_label: mentorFitLabel(match.similarity),
  })
  if (error) fail('/mentors/find', error.message)

  revalidatePath('/mentors', 'layout')
  redirect('/mentors')
}

async function ownRequest(requestId: string) {
  const { supabase, user } = await requireUser()
  const { data: request } = await supabase
    .from('mentorship_requests')
    .select('id, status, mentor_profiles ( full_name, job_title, company, mentor_topics )')
    .eq('id', requestId)
    .eq('student_user_id', user.id)
    .maybeSingle()
  if (!request) redirect('/mentors')
  return { supabase, user, request }
}

// Pick a time after the mentor accepts, or reschedule an upcoming chat.
export async function scheduleChat(formData: FormData) {
  const { supabase, request } = await ownRequest(String(formData.get('request_id') ?? ''))
  if (!['accepted', 'scheduled'].includes(request.status)) redirect('/mentors')

  const iso = pacificLocalToISO(String(formData.get('scheduled_at') ?? ''))
  if (!iso) fail('/mentors', 'Pick a date and time for the chat.')

  await supabase
    .from('mentorship_requests')
    .update({ status: 'scheduled', scheduled_at: iso, updated_at: new Date().toISOString() })
    .eq('id', request.id)
  revalidatePath('/mentors')
}

// "Log it" after a chat: marks it done and moves the mentor into the network
// tracker, where the notes produce a summary and a thank-you draft.
export async function logMentorChat(formData: FormData) {
  const { supabase, user, request } = await ownRequest(String(formData.get('request_id') ?? ''))
  const notes = String(formData.get('notes') ?? '').trim()
  if (!notes) fail('/mentors', 'Write a line about what you learned first.')
  if (!['scheduled', 'completed'].includes(request.status)) redirect('/mentors')

  const mentor = request.mentor_profiles as unknown as {
    full_name: string
    job_title: string | null
    company: string | null
    mentor_topics: string[]
  }

  let contactId: string
  try {
    await supabase
      .from('mentorship_requests')
      .update({ status: 'completed', updated_at: new Date().toISOString() })
      .eq('id', request.id)

    contactId = await findOrCreateContact(supabase, user.id, {
      full_name: mentor.full_name,
      role: mentor.job_title,
      company: mentor.company,
      met_context: 'Mentor chat',
      tags: ['Mentor', ...mentor.mentor_topics.slice(0, 1)],
    })
    await recordInteraction(supabase, contactId, { interaction_type: 'Mentor chat', notes }, displayName(user))
  } catch (err) {
    fail('/mentors', (err as Error).message)
  }

  revalidatePath('/mentors')
  revalidatePath('/network')
  redirect(`/network/${contactId}`)
}

export async function addGoal(formData: FormData) {
  const { supabase, user } = await requireUser()
  const text = String(formData.get('text') ?? '').trim()
  if (!text) redirect('/mentors')
  await supabase.from('student_goals').insert({ user_id: user.id, text })
  revalidatePath('/mentors')
}

export async function toggleGoal(formData: FormData) {
  const { supabase } = await requireUser()
  const id = String(formData.get('goal_id') ?? '')
  // RLS limits student_goals to the user's own rows.
  const { data: goal } = await supabase.from('student_goals').select('id, done').eq('id', id).maybeSingle()
  if (!goal) redirect('/mentors')
  await supabase.from('student_goals').update({ done: !goal.done }).eq('id', id)
  revalidatePath('/mentors')
}
