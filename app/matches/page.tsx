// app/matches/page.tsx
//
// Deliberately ugly on purpose. This exists to prove one thing: that a
// signed-in student's match_recommendations rows can be read back out,
// joined with the professor's info, and rendered — nothing else. Styling
// this to match the mockups is a separate, later step.

import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'

export default async function MatchesPage() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return <p>Not signed in.</p>
  }

  const { data: studentProfile } = await supabase
    .from('student_profiles')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!studentProfile) {
    return <p>No student profile yet — go through onboarding first.</p>
  }

  // Supabase's nested select syntax: `opportunities (...)` pulls in the
  // related row from the opportunities table via the foreign key, in one
  // query instead of two round trips.
  const { data: matches, error } = await supabase
    .from('match_recommendations')
    .select(
      `
      id,
      similarity_score,
      compatibility_label,
      opportunities (
        professor_name,
        department,
        lab_name
      )
    `
    )
    .eq('student_profile_id', studentProfile.id)
    .order('similarity_score', { ascending: false })

  if (error) {
    return <p>Error loading matches: {error.message}</p>
  }

  if (!matches || matches.length === 0) {
    return <p>No matches yet.</p>
  }

  return (
    <main style={{ padding: 24, fontFamily: 'monospace' }}>
      <h1>Your matches (unstyled — pipeline check only)</h1>
      <ul>
        {matches.map((m) => (
          <li key={m.id} style={{ marginBottom: 12 }}>
            <strong>{m.opportunities?.professor_name}</strong> —{' '}
            {m.opportunities?.department} {m.opportunities?.lab_name ? `(${m.opportunities.lab_name})` : ''}
            <br />
            {m.compatibility_label} ({m.similarity_score.toFixed(3)})
          </li>
        ))}
      </ul>
    </main>
  )
}