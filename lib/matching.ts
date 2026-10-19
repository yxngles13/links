// lib/matching.ts
//
// The live counterpart to what the seed script does for professors:
// turn a student's onboarding answers into a vector, ask the database
// which opportunities are closest to it, and cache the results —
// including the generated explanation, suggested questions, and outreach
// draft for each match (see lib/generate-match-content.ts).

import type { SupabaseClient } from '@supabase/supabase-js'
import { embed } from '@/lib/embeddings'
import { generateMatchContent } from '@/lib/generate-match-content'
import { staleMatchIds, type PromptAnswer } from '@/lib/profile'

type StudentProfile = {
  id: string
  user_id: string
  major: string | null
  academic_year: string | null
  coursework: string[] | null
  technical_skills: string[] | null
  research_interests: string[] | null
  career_goals: string | null
  headline?: string | null
}

function toEmbeddingText(p: StudentProfile): string {
  // Mirrors the seed script's toEmbeddingText for opportunities — same
  // idea, different fields. Whatever isn't included here is invisible to
  // the matching algorithm, so if you add a new onboarding field later and
  // want it to affect matching, it has to get pulled in here too.
  // The headline is included, the personality prompts deliberately aren't:
  // "my ideal lab vibe is chaotic" shouldn't move anyone up or down the list.
  const lines: string[] = []
  if (p.headline) lines.push(`Headline: ${p.headline}`)
  if (p.major) lines.push(`Major: ${p.major}`)
  if (p.research_interests?.length) lines.push(`Research interests: ${p.research_interests.join(', ')}`)
  if (p.technical_skills?.length) lines.push(`Technical skills: ${p.technical_skills.join(', ')}`)
  if (p.coursework?.length) lines.push(`Relevant coursework: ${p.coursework.join(', ')}`)
  if (p.career_goals) lines.push(`Career goals: ${p.career_goals}`)
  return lines.join('\n')
}

// Thresholds are a starting guess, not a tuned value — once you've seen
// real similarity scores for real student profiles against your 19
// professors, come back and adjust these cutoffs based on what the actual
// score distribution looks like. Cosine similarity ranges differ a lot
// between embedding models.
function toCompatibilityLabel(similarity: number): 'strong' | 'moderate' | 'exploratory' {
  if (similarity >= 0.6) return 'strong'
  if (similarity >= 0.4) return 'moderate'
  return 'exploratory'
}

export async function generateMatchesForStudent(studentProfileId: string, supabase: SupabaseClient) {
  const { data: profile, error: profileError } = await supabase
    .from('student_profiles')
    .select('id, user_id, major, academic_year, coursework, technical_skills, research_interests, career_goals')
    .eq('id', studentProfileId)
    .single()

  if (profileError || !profile) {
    throw new Error(`Could not load student profile ${studentProfileId}: ${profileError?.message}`)
  }

  // Headline and personality prompts live on the public profile. Missing
  // table or row (migration not run, profile never filled in) just means
  // matching runs on the questions alone, as before.
  const { data: about } = await supabase
    .from('student_public_profiles')
    .select('headline, prompts')
    .eq('user_id', profile.user_id)
    .maybeSingle()
  const student = { ...profile, headline: about?.headline ?? null, prompts: (about?.prompts ?? []) as PromptAnswer[] }

  const embedding = await embed(toEmbeddingText(student))

  // Cache the student's own embedding so it doesn't need to be
  // regenerated every time matches are refreshed.
  const { error: updateError } = await supabase
    .from('student_profiles')
    .update({ profile_embedding: embedding, updated_at: new Date().toISOString() })
    .eq('id', studentProfileId)

  if (updateError) {
    throw new Error(`Could not save profile embedding: ${updateError.message}`)
  }

  const { data: matches, error: matchError } = await supabase.rpc('match_opportunities', {
    query_embedding: embedding,
    match_count: 5,
  })

  if (matchError) {
    throw new Error(`Matching query failed: ${matchError.message}`)
  }

  const rows = []
  for (const m of matches as {
    opportunity_id: string
    professor_name: string
    department: string | null
    lab_name: string | null
    project_description: string | null
    similarity: number
  }[]) {
    // Sequential, not Promise.all — deliberately gentle on Groq's free-tier
    // rate limit (30 requests/minute shared across your whole account), and
    // it means one failed generation doesn't take the others down with it.
    const content = await generateMatchContent(student, m)

    rows.push({
      student_profile_id: studentProfileId,
      opportunity_id: m.opportunity_id,
      similarity_score: m.similarity,
      compatibility_label: toCompatibilityLabel(m.similarity),
      explanation: content.explanation,
      suggested_questions: content.suggested_questions,
      outreach_draft: content.outreach_draft,
    })
  }

  const { error: insertError } = await supabase
    .from('match_recommendations')
    .upsert(rows, { onConflict: 'student_profile_id,opportunity_id' })

  if (insertError) {
    throw new Error(`Could not save match recommendations: ${insertError.message}`)
  }

  // Matching now re-runs whenever the questions change, so professors that
  // dropped out of the new results are removed instead of piling up with
  // stale scores. Saved and contacted ones stay.
  const [{ data: existing, error: existingError }, { data: contacted, error: contactedError }] = await Promise.all([
    supabase.from('match_recommendations').select('id, opportunity_id, saved_at').eq('student_profile_id', studentProfileId),
    supabase.from('interactions').select('opportunity_id').eq('student_profile_id', studentProfileId),
  ])
  // If either lookup fails, skip pruning: guessing could delete a contacted match.
  if (existingError || contactedError) {
    console.error('Skipped stale-match cleanup:', (existingError ?? contactedError)?.message)
    return rows
  }
  const keep = new Set([...rows.map((r) => r.opportunity_id), ...(contacted ?? []).map((i) => i.opportunity_id)])
  const stale = staleMatchIds(existing, keep)
  if (stale.length) {
    const { error: deleteError } = await supabase.from('match_recommendations').delete().in('id', stale)
    if (deleteError) console.error('Could not remove stale matches:', deleteError.message)
  }

  return rows
}