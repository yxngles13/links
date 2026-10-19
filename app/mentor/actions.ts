// app/mentor/actions.ts
// Mentor-side writes: the mentor's own profile and responses to requests.
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth'
import { embed } from '@/lib/embeddings'
import { toArray } from '@/lib/format'
import { getOwnMentorProfile, mentorEmbeddingText } from '@/lib/mentors'

export async function saveMentorProfile(formData: FormData) {
  const { supabase, user } = await requireUser()

  const fullName = String(formData.get('full_name') ?? '').trim()
  if (!fullName) redirect('/mentor/profile?error=Name is required')

  // Checkbox topics plus anything typed in "Other topics".
  const topics = Array.from(new Set([...formData.getAll('mentor_topics').map(String), ...toArray(formData.get('other_topics'))]))
  const gradYear = parseInt(String(formData.get('grad_year') ?? ''), 10)

  const fields = {
    full_name: fullName,
    grad_year: Number.isFinite(gradYear) ? gradYear : null,
    job_title: String(formData.get('job_title') ?? '').trim() || null,
    company: String(formData.get('company') ?? '').trim() || null,
    mentor_topics: topics,
    bio: String(formData.get('bio') ?? '').trim() || null,
    availability: String(formData.get('availability') ?? '').trim() || null,
    preferred_format: String(formData.get('preferred_format') ?? '').trim() || null,
  }

  const { error } = await supabase.from('mentor_profiles').upsert(
    {
      user_id: user.id,
      ...fields,
      profile_embedding: await embed(mentorEmbeddingText(fields)),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  )
  if (error) redirect(`/mentor/profile?error=${encodeURIComponent(error.message)}`)

  revalidatePath('/mentor', 'layout')
  redirect('/mentor')
}

async function ownRequest(requestId: string) {
  const { supabase, user } = await requireUser()
  const mentor = await getOwnMentorProfile(supabase, user.id)
  if (!mentor) redirect('/mentor/profile')
  // Scope to this mentor's requests explicitly, on top of RLS: a student can
  // also update their own request rows, and this action is mentor-only.
  const { data: request } = await supabase
    .from('mentorship_requests')
    .select('id, status')
    .eq('id', requestId)
    .eq('mentor_profile_id', mentor.id)
    .maybeSingle()
  if (!request) redirect('/mentor')
  return { supabase, request }
}

export async function respondToRequest(formData: FormData) {
  const decision = String(formData.get('decision'))
  const { supabase, request } = await ownRequest(String(formData.get('request_id') ?? ''))
  if (request.status !== 'requested' || !['accepted', 'declined'].includes(decision)) redirect('/mentor')

  await supabase
    .from('mentorship_requests')
    .update({ status: decision, updated_at: new Date().toISOString() })
    .eq('id', request.id)
  revalidatePath('/mentor')
}

export async function completeChatAsMentor(formData: FormData) {
  const { supabase, request } = await ownRequest(String(formData.get('request_id') ?? ''))
  if (request.status !== 'scheduled') redirect('/mentor')

  await supabase
    .from('mentorship_requests')
    .update({ status: 'completed', updated_at: new Date().toISOString() })
    .eq('id', request.id)
  revalidatePath('/mentor')
}

export async function toggleAccepting() {
  const { supabase, user } = await requireUser()
  const mentor = await getOwnMentorProfile(supabase, user.id)
  if (!mentor) redirect('/mentor/profile')

  await supabase.from('mentor_profiles').update({ is_accepting: !mentor.is_accepting }).eq('id', mentor.id)
  revalidatePath('/mentor')
}
