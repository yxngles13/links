// app/onboarding/actions.ts
'use server'

import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { generateMatchesForStudent } from '@/lib/matching'

// Comma-separated text fields (research interests, skills, coursework) come
// in from the form as one string — split, trim, and drop empty entries
// before they hit a text[] column.
function toArray(value: FormDataEntryValue | null): string[] {
  if (!value || typeof value !== 'string') return []
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

export async function submitOnboarding(formData: FormData) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    // Onboarding is only reachable by a signed-in student — if this fires,
    // something upstream (a route guard) let a logged-out request through.
    throw new Error('No authenticated user — cannot save a profile without one.')
  }

  const weeklyHoursRaw = formData.get('weekly_availability_hours')
  const weeklyHours = weeklyHoursRaw ? parseInt(weeklyHoursRaw as string, 10) : null

  const { data: profile, error } = await supabase
    .from('student_profiles')
    .upsert(
      {
        user_id: user.id,
        major: formData.get('major') as string,
        academic_year: formData.get('academic_year') as string,
        research_interests: toArray(formData.get('research_interests')),
        technical_skills: toArray(formData.get('technical_skills')),
        coursework: toArray(formData.get('coursework')),
        career_goals: formData.get('career_goals') as string,
        weekly_availability_hours: weeklyHours,
      },
      { onConflict: 'user_id' }
    )
    .select('id')
    .single()

  if (error || !profile) {
    throw new Error(`Could not save student profile: ${error?.message}`)
  }

  // This call embeds the profile and writes match_recommendations before
  // the student ever sees the matches page — so by the time they land
  // there, the data is already sitting in the database waiting to be read,
  // not generated on the fly while they watch a spinner.
  await generateMatchesForStudent(profile.id, supabase)

  redirect('/matches')
}