// lib/mentors.ts
// Mentor matching: rank mentor profiles against a student's existing
// profile embedding (the same vector research matching uses), in JS since
// the mentor pool is small.
import type { SupabaseClient } from '@supabase/supabase-js'
import { cosine, parseVector } from '@/lib/similarity'

export type MentorProfile = {
  id: string
  user_id: string
  full_name: string
  grad_year: number | null
  job_title: string | null
  company: string | null
  mentor_topics: string[]
  bio: string | null
  availability: string | null
  preferred_format: string | null
  is_accepting: boolean
}

export const MENTOR_COLUMNS =
  'id, user_id, full_name, grad_year, job_title, company, mentor_topics, bio, availability, preferred_format, is_accepting'

export const MENTOR_TOPICS = [
  'Resume review',
  'Interview prep',
  'Internship search',
  'Grad school advice',
  'Research → industry',
  'ML careers',
  'Backend / infra',
  'Product management',
]

export function mentorEmbeddingText(m: Pick<MentorProfile, 'job_title' | 'company' | 'mentor_topics' | 'bio'>) {
  return [
    [m.job_title, m.company].filter(Boolean).join(' at '),
    m.mentor_topics.length ? `Can help with: ${m.mentor_topics.join(', ')}` : '',
    m.bio ?? '',
  ]
    .filter(Boolean)
    .join('\n')
}

// Starting guesses, like the research thresholds in lib/matching.ts: tune
// once there are real mentor profiles to look at.
export function mentorFitLabel(similarity: number) {
  if (similarity >= 0.45) return 'Great fit'
  if (similarity >= 0.3) return 'Good fit'
  return 'Worth a chat'
}

export function mentorSubtitle(m: Pick<MentorProfile, 'grad_year' | 'job_title' | 'company'>) {
  const year = m.grad_year ? `CPP '${String(m.grad_year).slice(-2)}` : null
  const job = [m.job_title, m.company].filter(Boolean).join(', ')
  return [year, job].filter(Boolean).join(' · ')
}

export async function getOwnMentorProfile(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase.from('mentor_profiles').select(MENTOR_COLUMNS).eq('user_id', userId).maybeSingle()
  return data as MentorProfile | null
}

// Returns accepting mentors ranked for this student, best first. Mentors
// are still listed (unranked) if the student has no embedding yet.
export async function rankMentorsForStudent(supabase: SupabaseClient, userId: string) {
  const [{ data: student }, { data: mentors, error }] = await Promise.all([
    supabase.from('student_profiles').select('profile_embedding').eq('user_id', userId).maybeSingle(),
    supabase.from('mentor_profiles').select(`${MENTOR_COLUMNS}, profile_embedding`).eq('is_accepting', true).neq('user_id', userId),
  ])
  if (error) throw new Error(error.message)

  const studentVec = parseVector(student?.profile_embedding)
  return ((mentors ?? []) as (MentorProfile & { profile_embedding: unknown })[])
    .map(({ profile_embedding, ...m }) => {
      const v = parseVector(profile_embedding)
      const similarity = studentVec && v ? cosine(studentVec, v) : 0
      return { mentor: m as MentorProfile, similarity, fit: mentorFitLabel(similarity) }
    })
    .sort((a, b) => b.similarity - a.similarity)
}

// <input type="datetime-local"> sends wall-clock time with no zone. Every
// user is at CPP, so read it as Pacific time rather than the server's zone.
export function pacificLocalToISO(value: string) {
  const asUtc = new Date(`${value}:00Z`)
  if (Number.isNaN(asUtc.getTime())) return null
  const pacificWall = new Date(asUtc.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }) + ' UTC')
  return new Date(asUtc.getTime() + (asUtc.getTime() - pacificWall.getTime())).toISOString()
}

export function isoToPacificLocal(iso: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso))
  const get = (t: string) => parts.find((p) => p.type === t)?.value
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`
}
