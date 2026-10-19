// scripts/seed-demo-user.ts
//
// Creates (or resets) a fixed demo account so anyone can sign in at /login
// and land straight on a populated /matches page — no signup, no email
// confirmation, no onboarding form.
//
// Run with: npx tsx scripts/seed-demo-user.ts
//
// Requires in .env.local (same as the other scripts):
//   NEXT_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   GROQ_API_KEY               <- match content generation needs it
// Optional overrides:
//   DEMO_EMAIL, DEMO_PASSWORD
//
// Safe to re-run: if the demo user already exists, its password is reset
// and its profile + matches are overwritten rather than duplicated. Run
// seed-opportunities.ts first, or there's nothing to match against.

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const DEMO_EMAIL = process.env.DEMO_EMAIL ?? 'demo@links-demo.com'
const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? 'links-demo-2026'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function findUserByEmail(email: string) {
  // The admin API has no lookup-by-email, so page through users. Fine for
  // a small project; revisit if the auth table ever gets large.
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw new Error(`Could not list users: ${error.message}`)
    const match = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
    if (match) return match
    if (data.users.length < 1000) return null
  }
}

async function main() {
  // 1. Create the demo user, or reset its password if it already exists.
  // email_confirm: true skips the confirmation email so the login works
  // immediately.
  let user = await findUserByEmail(DEMO_EMAIL)

  if (user) {
    const { error } = await supabase.auth.admin.updateUserById(user.id, {
      password: DEMO_PASSWORD,
      email_confirm: true,
    })
    if (error) throw new Error(`Could not reset demo user: ${error.message}`)
    console.log(`Reset existing demo user: ${user.id}`)
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: 'Demo Student' },
    })
    if (error || !data.user) throw new Error(`Could not create demo user: ${error?.message}`)
    user = data.user
    console.log(`Created demo user: ${user.id}`)
  }

  // 2. Give them a filled-in profile, same shape as what onboarding writes.
  const { data: profile, error: profileError } = await supabase
    .from('student_profiles')
    .upsert(
      {
        user_id: user.id,
        major: 'Computer Science',
        academic_year: 'Junior',
        research_interests: ['machine learning', 'computer vision', 'cybersecurity'],
        technical_skills: ['Python', 'PyTorch', 'SQL', 'Git'],
        coursework: ['Data Structures', 'Algorithms', 'Intro to Machine Learning'],
        career_goals: 'Get undergraduate research experience in applied ML before applying to grad school.',
        weekly_availability_hours: 10,
      },
      { onConflict: 'user_id' }
    )
    .select('id')
    .single()

  if (profileError || !profile) {
    throw new Error(`Could not save demo profile: ${profileError?.message}`)
  }

  // 3. Pre-generate matches so /matches is populated on first sign-in.
  // Imported here, not at the top: lib/generate-match-content.ts builds its
  // Groq client at module load, and static imports run before
  // dotenv.config() — so GROQ_API_KEY would still be unset.
  const { generateMatchesForStudent } = await import('../lib/matching')
  console.log('Generating matches (this can take a minute)...')
  await generateMatchesForStudent(profile.id, supabase)

  // 4. A few network contacts with backdated history, so the Network tab
  // shows both "On track" and "Needs follow-up" rows.
  await seedNetwork(user.id)

  console.log('\nDemo login ready:')
  console.log(`  Email:    ${DEMO_EMAIL}`)
  console.log(`  Password: ${DEMO_PASSWORD}`)
}

const DAY = 24 * 60 * 60 * 1000
const daysAgo = (n: number) => new Date(Date.now() - n * DAY).toISOString()

const DEMO_CONTACTS = [
  {
    full_name: 'Priya Nair',
    role: 'Product Manager',
    company: 'Notion',
    met_context: 'LinkedIn message',
    tags: ['Product', 'Alumni'],
    notes: 'Moved from engineering to PM. Mentors students on the side.',
    log: [
      { days: 12, type: 'LinkedIn message', notes: 'Sent first outreach message after finding her profile through a CPP alumni search.' },
      { days: 5, type: 'LinkedIn message', notes: 'She replied and offered a quick call next week to talk about her eng-to-PM transition.' },
    ],
  },
  {
    full_name: 'David Kim',
    role: 'Software Engineer',
    company: 'Stripe',
    met_context: 'Career fair',
    tags: ['Backend'],
    notes: 'Works on payments infrastructure. Said to email him about the new-grad pipeline.',
    log: [{ days: 42, type: 'Career fair', notes: 'Talked at the fall career fair about backend roles. He said to email him about the new-grad pipeline.' }],
  },
  {
    full_name: 'Aisha Reyes',
    role: 'CPP Alum',
    company: 'Google',
    met_context: 'Coffee chat',
    tags: ['Alumni', 'Referral'],
    notes: 'CPP CS alum, now on a ML infrastructure team.',
    log: [
      { days: 9, type: 'Email', notes: 'Asked for a coffee chat about ML infrastructure roles.' },
      { days: 1, type: 'Coffee chat', notes: 'Coffee chat on campus. Walked through how her team serves models; offered to review my resume.' },
    ],
  },
  {
    full_name: 'Marcus Tan',
    role: 'Recruiter',
    company: 'Datadog',
    met_context: 'LinkedIn message',
    tags: ['Recruiting'],
    notes: 'University recruiter for internships.',
    log: [{ days: 21, type: 'LinkedIn message', notes: 'Asked about summer internship timelines. He said applications open in late fall.' }],
  },
]

async function seedNetwork(userId: string) {
  // Imported late for the same reason as matching: these modules read env
  // vars at load time.
  const { embed } = await import('../lib/embeddings')
  const { contactEmbeddingText } = await import('../lib/network')
  const { refreshContactContent } = await import('../lib/generate-network-content')

  // Start clean so re-runs don't duplicate contacts. Interactions, summaries
  // and follow-ups cascade with the contact.
  await supabase.from('network_contacts').delete().eq('user_id', userId)

  for (const { log, ...fields } of DEMO_CONTACTS) {
    const { data: contact, error } = await supabase
      .from('network_contacts')
      .insert({
        user_id: userId,
        ...fields,
        contact_embedding: await embed(contactEmbeddingText(fields)),
        last_interaction_at: daysAgo(Math.min(...log.map((l) => l.days))),
      })
      .select('id')
      .single()
    if (error || !contact) throw new Error(`Could not seed contact ${fields.full_name}: ${error?.message}`)

    await supabase.from('network_interactions').insert(
      log.map((l) => ({ contact_id: contact.id, interaction_type: l.type, notes: l.notes, occurred_at: daysAgo(l.days) }))
    )
    await refreshContactContent(contact.id, supabase, 'Demo Student')
    console.log(`Seeded contact: ${fields.full_name}`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
