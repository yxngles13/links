// app/matches/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireUser, displayName } from '@/lib/auth'
import { findOrCreateContact, recordInteraction } from '@/lib/network'

async function loadMatch(matchId: string) {
  const { supabase, user } = await requireUser()
  // RLS limits match_recommendations to the signed-in student's own rows.
  // `*` rather than a column list so this keeps working before the
  // saved_at migration has been run.
  const { data: match } = await supabase
    .from('match_recommendations')
    .select('*, opportunities ( professor_name, department, lab_name, research_areas )')
    .eq('id', matchId)
    .maybeSingle()
  if (!match) redirect('/matches')
  return { supabase, user, match }
}

// "Log this interaction" on a professor: records it for the research side
// (the "contacted" count) and adds the professor to the network tracker,
// so outreach to professors gets the same timeline and follow-up drafts.
export async function logMatchInteraction(formData: FormData) {
  const matchId = String(formData.get('match_id') ?? '')
  const notes = String(formData.get('notes') ?? '').trim()
  if (!notes) redirect(`/matches/${matchId}?error=${encodeURIComponent('Write a note about what happened first')}`)

  const { supabase, user, match } = await loadMatch(matchId)
  const opp = match.opportunities as unknown as {
    professor_name: string
    department: string | null
    lab_name: string | null
    research_areas: string[] | null
  }

  let contactId: string
  try {
    const { error } = await supabase
      .from('interactions')
      .insert({ student_profile_id: match.student_profile_id, opportunity_id: match.opportunity_id, notes })
    if (error) throw new Error(error.message)

    contactId = await findOrCreateContact(supabase, user.id, {
      full_name: opp.professor_name,
      role: 'Professor',
      company: [opp.department, opp.lab_name].filter(Boolean).join(' · ') || 'Cal Poly Pomona',
      met_context: 'Research outreach',
      tags: (opp.research_areas ?? []).slice(0, 2),
    })
    await recordInteraction(
      supabase,
      contactId,
      { interaction_type: String(formData.get('interaction_type') ?? '') || 'Email', notes },
      displayName(user)
    )
  } catch (err) {
    redirect(`/matches/${matchId}?error=${encodeURIComponent((err as Error).message)}`)
  }

  revalidatePath('/matches')
  revalidatePath('/network')
  redirect(`/network/${contactId}`)
}

export async function toggleSaved(formData: FormData) {
  const matchId = String(formData.get('match_id') ?? '')
  const { supabase, match } = await loadMatch(matchId)

  const { error } = await supabase
    .from('match_recommendations')
    .update({ saved_at: match.saved_at ? null : new Date().toISOString() })
    .eq('id', matchId)
  if (error) redirect(`/matches/${matchId}?error=${encodeURIComponent(error.message)}`)

  revalidatePath('/matches')
  revalidatePath(`/matches/${matchId}`)
}
