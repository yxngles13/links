// app/matches/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireUser, displayName } from '@/lib/auth'
import { OUT_OF_CREDITS, spendCredit } from '@/lib/credits'
import { findOrCreateContact, recordInteraction } from '@/lib/network'
import { rewriteDraft } from '@/lib/rewrite-draft'
import { MAX_DRAFT_LENGTH } from '@/lib/rewrite-prompt'

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

function matchFail(matchId: string, message: string): never {
  redirect(`/matches/${matchId}?error=${encodeURIComponent(message)}`)
}

// Hand edits to the outreach draft. Free: no AI involved.
export async function saveOutreachDraft(formData: FormData) {
  const matchId = String(formData.get('match_id') ?? '')
  const { supabase } = await loadMatch(matchId)
  const draft = String(formData.get('draft') ?? '').slice(0, MAX_DRAFT_LENGTH)
  const { error } = await supabase.from('match_recommendations').update({ outreach_draft: draft }).eq('id', matchId)
  if (error) matchFail(matchId, error.message)
  revalidatePath(`/matches/${matchId}`)
}

// Rewrites the draft (as currently typed) from the student's instruction.
// Costs an AI credit.
export async function rewriteOutreachDraft(formData: FormData) {
  const matchId = String(formData.get('match_id') ?? '')
  const { supabase, match } = await loadMatch(matchId)
  const opp = match.opportunities as unknown as { professor_name: string; department: string | null; lab_name: string | null }

  if (!(await spendCredit(supabase))) matchFail(matchId, OUT_OF_CREDITS)
  const rewritten = await rewriteDraft({
    draft: String(formData.get('draft') ?? ''),
    instruction: String(formData.get('instruction') ?? ''),
    context: `A first email from the student to ${opp.professor_name}${opp.lab_name ? ` (${opp.lab_name})` : ''}${opp.department ? `, ${opp.department}` : ''}, asking about research opportunities.`,
  })
  if (!rewritten) matchFail(matchId, "Couldn't rewrite it right now. Your draft wasn't changed.")

  const { error } = await supabase.from('match_recommendations').update({ outreach_draft: rewritten }).eq('id', matchId)
  if (error) matchFail(matchId, error.message)
  revalidatePath(`/matches/${matchId}`)
}
