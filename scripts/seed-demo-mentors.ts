// scripts/seed-demo-mentors.ts
//
// Seeds a small pool of demo mentors plus requests between them and the
// demo student, so both dashboards have something to show:
//   - student side (demo@links-demo.com):   /mentors
//   - mentor side  (mentor@links-demo.com): /mentor   (signs in as Jordan Alvarez)
//
// Run with: npx tsx scripts/seed-demo-mentors.ts
//
// Requires supabase/migrations/20261018000000_mentors.sql to have been run,
// and scripts/seed-demo-user.ts first (the demo student must exist).
// Safe to re-run: demo mentors and their requests are reset each time.
// All people here are fictional demo data.

import { createClient, type User } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const PASSWORD = process.env.DEMO_PASSWORD ?? 'links-demo-2026'
const STUDENT_EMAIL = process.env.DEMO_EMAIL ?? 'demo@links-demo.com'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const MENTORS = [
  {
    email: 'mentor@links-demo.com',
    full_name: 'Jordan Alvarez',
    grad_year: 2023,
    job_title: 'Software Engineer',
    company: 'Datadog',
    mentor_topics: ['Resume review', 'Interview prep', 'Backend / infra', 'Research → industry'],
    bio: 'Started in CS at CPP wanting to do research, ended up in backend infra instead. Happy to talk through how that path actually played out.',
    availability: '2 chats / month',
    preferred_format: 'Video call',
  },
  {
    email: 'mentor-sofia@links-demo.com',
    full_name: 'Sofia Liu',
    grad_year: 2022,
    job_title: 'ML Engineer',
    company: 'a robotics startup',
    mentor_topics: ['Grad school advice', 'ML careers', 'Research → industry'],
    bio: 'Went from undergrad research assistant to ML engineering. Can speak to how research experience translates into industry roles.',
    availability: '1 chat / month',
    preferred_format: 'Video call',
  },
  {
    email: 'mentor-ravi@links-demo.com',
    full_name: 'Ravi Patel',
    grad_year: 2026,
    job_title: 'Senior, CS',
    company: 'Cal Poly Pomona',
    mentor_topics: ['Internship search', 'Resume review'],
    bio: 'A year ahead of you and going through the internship search right now. Most useful for what is working in this year’s market.',
    availability: '1 chat / week',
    preferred_format: 'Coffee on campus',
  },
  {
    email: 'mentor-maya@links-demo.com',
    full_name: 'Maya Kim',
    grad_year: 2021,
    job_title: 'Product Manager',
    company: 'a cloud software company',
    mentor_topics: ['Product management', 'Interview prep'],
    bio: 'Moved from software engineering into product. Ask me about PM interviews and what the day-to-day is like.',
    availability: '1 chat / month',
    preferred_format: 'Phone call',
  },
]

// Other students who have asked Jordan for a chat, so the mentor dashboard
// shows more than the demo student.
const OTHER_STUDENTS = [
  { email: 'student-amy@links-demo.com', full_name: 'Amy Nguyen', summary: 'Freshman, Computer Science' },
  { email: 'student-dana@links-demo.com', full_name: 'Dana Ruiz', summary: 'Sophomore, Computer Science' },
]

async function upsertUser(email: string, fullName: string): Promise<User> {
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw new Error(`Could not list users: ${error.message}`)
    const existing = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
    if (existing) {
      await supabase.auth.admin.updateUserById(existing.id, { password: PASSWORD, email_confirm: true })
      return existing
    }
    if (data.users.length < 1000) break
  }
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  })
  if (error || !data.user) throw new Error(`Could not create ${email}: ${error?.message}`)
  return data.user
}

const DAY = 24 * 60 * 60 * 1000
const at = (days: number, hourPacific = 16) => {
  // UTC-7 (daylight time); off by an hour in winter, which is fine for demo data.
  const d = new Date(Date.now() + days * DAY)
  d.setUTCHours(hourPacific + 7, 0, 0, 0)
  return d.toISOString()
}

async function main() {
  const { embed } = await import('../lib/embeddings')
  const { mentorEmbeddingText } = await import('../lib/mentors')

  const student = await upsertUser(STUDENT_EMAIL, 'Demo Student')

  const mentorIds: Record<string, string> = {}
  for (const { email, ...fields } of MENTORS) {
    const user = await upsertUser(email, fields.full_name)
    const { data, error } = await supabase
      .from('mentor_profiles')
      .upsert(
        { user_id: user.id, ...fields, is_accepting: true, profile_embedding: await embed(mentorEmbeddingText(fields)) },
        { onConflict: 'user_id' }
      )
      .select('id')
      .single()
    if (error || !data) throw new Error(`Could not seed mentor ${fields.full_name}: ${error?.message}`)
    mentorIds[fields.full_name] = data.id
    console.log(`Mentor: ${fields.full_name} <${email}>`)
  }

  const others: Record<string, string> = {}
  for (const s of OTHER_STUDENTS) others[s.full_name] = (await upsertUser(s.email, s.full_name)).id

  // Reset every request touching the demo mentors, then rebuild them.
  await supabase.from('mentorship_requests').delete().in('mentor_profile_id', Object.values(mentorIds))

  const fromDemo = { student_user_id: student.id, student_name: 'Demo Student', student_summary: 'Junior, Computer Science' }
  const { error } = await supabase.from('mentorship_requests').insert([
    // Demo student's side: one scheduled, one accepted, one waiting.
    { ...fromDemo, mentor_profile_id: mentorIds['Jordan Alvarez'], topic: 'Resume review', fit_label: 'Great fit', status: 'scheduled', scheduled_at: at(4),
      message: 'Wanted research but unsure if it helps for industry. Would love to hear how your path went.' },
    { ...fromDemo, mentor_profile_id: mentorIds['Sofia Liu'], topic: 'Grad school advice', fit_label: 'Good fit', status: 'accepted',
      message: 'Trying to decide whether a master’s is worth it before applying to ML roles.' },
    { ...fromDemo, mentor_profile_id: mentorIds['Ravi Patel'], topic: 'Internship search', fit_label: 'Good fit', status: 'requested',
      message: 'What has actually worked for you in this year’s internship search?' },
    // Jordan's side: a new request and a past mentee.
    { student_user_id: others['Amy Nguyen'], student_name: 'Amy Nguyen', student_summary: 'Freshman, Computer Science', mentor_profile_id: mentorIds['Jordan Alvarez'],
      topic: 'Resume review', fit_label: 'Good fit', status: 'requested', message: 'Just started the major. How do I get an interview-ready resume this early?' },
    { student_user_id: others['Dana Ruiz'], student_name: 'Dana Ruiz', student_summary: 'Sophomore, Computer Science', mentor_profile_id: mentorIds['Jordan Alvarez'],
      topic: 'Interview prep', fit_label: 'Great fit', status: 'completed', scheduled_at: at(-16), message: 'Prepping for my first technical interviews.' },
  ])
  if (error) throw new Error(`Could not seed requests: ${error.message}`)

  await supabase.from('student_goals').delete().eq('user_id', student.id)
  // Every row spells out `done`: a multi-row insert sends null for keys a
  // row leaves out, which the NOT NULL column rejects.
  const { error: goalsError } = await supabase.from('student_goals').insert([
    { user_id: student.id, text: 'Get a resume review', done: true },
    { user_id: student.id, text: 'Land a summer internship', done: false },
    { user_id: student.id, text: 'Decide: research vs. industry', done: false },
  ])
  if (goalsError) throw new Error(`Could not seed goals: ${goalsError.message}`)

  console.log('\nDemo logins (password for all):', PASSWORD)
  console.log(`  Student: ${STUDENT_EMAIL}  -> /mentors`)
  console.log('  Mentor:  mentor@links-demo.com  -> /mentor')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
