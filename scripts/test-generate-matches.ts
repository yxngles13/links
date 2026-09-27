// scripts/test-generate-matches.ts
//
// Lets you test the real matching pipeline (lib/matching.ts) before any
// sign-in UI exists. Creates a throwaway auth user + student profile
// directly with the service role key (bypassing RLS, same as the seed
// script), runs generateMatchesForStudent, and prints the results.
//
// This is a scratch/dev tool, not part of the app — don't wire it into
// any route. Delete the test user afterward if you don't want clutter in
// your Supabase Auth dashboard.
//
// Run with: npx tsx scripts/test-generate-matches.ts

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { generateMatchesForStudent } from '../lib/matching'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function main() {
  // 1. Create a throwaway auth user.
  const { data: userData, error: userError } = await supabase.auth.admin.createUser({
    email: `test-student-${Date.now()}@example.com`,
    password: 'test-password-not-real',
    email_confirm: true,
  })

  if (userError || !userData.user) {
    throw new Error(`Could not create test user: ${userError?.message}`)
  }

  console.log(`Created test user: ${userData.user.id}`)

  // 2. Give them a student profile — deliberately similar to Dr. Raheja /
  // Dr. Ji's areas, so you have a rough expectation of what should rank
  // near the top when you look at the results.
  const { data: profile, error: profileError } = await supabase
    .from('student_profiles')
    .insert({
      user_id: userData.user.id,
      major: 'Computer Science',
      academic_year: 'Junior',
      research_interests: ['computer vision', 'machine learning'],
      technical_skills: ['Python', 'PyTorch', 'data pipelines'],
      coursework: ['CS 3110'],
      career_goals: 'Interested in applied AI research, especially image processing.',
      weekly_availability_hours: 5,
    })
    .select('id')
    .single()

  if (profileError || !profile) {
    throw new Error(`Could not create student profile: ${profileError?.message}`)
  }

  console.log(`Created student profile: ${profile.id}`)

  // 3. Run the real matching pipeline.
  const matches = await generateMatchesForStudent(profile.id, supabase)

  console.log('\nMatches:')
  for (const m of matches) {
    console.log(`  ${m.compatibility_label} (${m.similarity_score.toFixed(3)}) — opportunity ${m.opportunity_id}`)
  }
}

main()