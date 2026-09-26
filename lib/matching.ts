// lib/matching.ts
//
// The live counterpart to what the seed script does for professors:
// turn a student's onboarding answers into a vector, ask the database
// which opportunities are closest to it, and cache the results.
//
// What this does NOT do yet: generate the human-readable explanation,
// suggested questions, or outreach draft for each match. Those columns
// are left null here — that's a separate step (an LLM call), deliberately
// kept out of this function so the core ranking logic stays testable on
// its own first.

import { createClient } from '@/utils/supabase/server'
import { embed } from '@/lib/embeddings'

type StudentProfile = {
  id: string
  major: string | null
  academic_year: string | null
  coursework: string[] | null
  technical_skills: string[] | null
  research_interests: string[] | null
  career_goals: string | null
}

function toEmbeddingText(p: StudentProfile): string {
  // Mirrors the seed script's toEmbeddingText for opportunities — same
  // idea, different fields. Whatever isn't included here is invisible to
  // the matching algorithm, so if you add a new onboarding field later and
  // want it to affect matching, it has to get pulled in here too.
  const lines: string[] = []
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

export async function generateMatchesForStudent(studentProfileId: string) {
  const supabase = await createClient()

  const { data: profile, error: profileError } = await supabase
    .from('student_profiles')
    .select('id, major, academic_year, coursework, technical_skills, research_interests, career_goals')
    .eq('id', studentProfileId)
    .single()

  if (profileError || !profile) {
    throw new Error(`Could not load student profile ${studentProfileId}: ${profileError?.message}`)
  }

  const embedding = await embed(toEmbeddingText(profile))

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

  const rows = matches.map((m: { opportunity_id: string; similarity: number }) => ({
    student_profile_id: studentProfileId,
    opportunity_id: m.opportunity_id,
    similarity_score: m.similarity,
    compatibility_label: toCompatibilityLabel(m.similarity),
    // Filled in by a later step — see the note at the top of this file.
    explanation: null,
    suggested_questions: null,
    outreach_draft: null,
  }))

  const { error: insertError } = await supabase
    .from('match_recommendations')
    .upsert(rows, { onConflict: 'student_profile_id,opportunity_id' })

  if (insertError) {
    throw new Error(`Could not save match recommendations: ${insertError.message}`)
  }

  return rows
}
