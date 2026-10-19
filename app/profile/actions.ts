// app/profile/actions.ts
// Student profile writes: the public "about you" part, the private matching
// answers (what /onboarding used to save), and dismissing the reminder.
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { after } from 'next/server'
import { requireUser } from '@/lib/auth'
import { toArray } from '@/lib/format'
import { generateMatchesForStudent } from '@/lib/matching'
import { githubUrl, linkedinUrl, MAX_HEADLINE_LENGTH, parsePromptAnswers, validateUpload } from '@/lib/profile'
import { getPublicProfile, PROFILE_BUCKET } from '@/lib/student-profile'

const fail = (message: string): never => redirect(`/profile?error=${encodeURIComponent(message)}`)
const text = (formData: FormData, name: string) => String(formData.get(name) ?? '').trim()

export async function saveAbout(formData: FormData) {
  const { supabase, user } = await requireUser()

  const fullName = text(formData, 'full_name').slice(0, 200)
  if (!fullName) fail('Name is required.')

  const linkedin = linkedinUrl(formData.get('linkedin_url'))
  if (text(formData, 'linkedin_url') && !linkedin) fail('LinkedIn link should look like https://www.linkedin.com/in/…')
  const github = githubUrl(formData.get('github_url'))
  if (text(formData, 'github_url') && !github) fail('GitHub link should look like https://github.com/…')

  const photo = validateUpload(formData.get('photo') as File | null, 'photo')
  const resume = validateUpload(formData.get('resume') as File | null, 'resume')
  if (photo && !photo.ok) fail(photo.error)
  if (resume && !resume.ok) fail(resume.error)

  const { profile: existing, missing } = await getPublicProfile(supabase, user.id)
  if (missing) fail('Profiles need a database update first. See the note at the top of this page.')

  // Fixed names under the user's folder, so a new upload replaces the old
  // one. Only the photo's extension can change; then the old file goes.
  const upload = async (field: 'photo' | 'resume', check: typeof photo, oldPath: string | null | undefined) => {
    if (!check?.ok) return oldPath ?? null
    const path = `${user.id}/${field}.${check.ext}`
    const { error } = await supabase.storage
      .from(PROFILE_BUCKET)
      .upload(path, formData.get(field) as File, { upsert: true, contentType: check.type })
    if (error) fail(`Could not upload your ${field}: ${error.message}`)
    if (oldPath && oldPath !== path) await supabase.storage.from(PROFILE_BUCKET).remove([oldPath])
    return path
  }

  const { error } = await supabase.from('student_public_profiles').upsert(
    {
      user_id: user.id,
      full_name: fullName,
      headline: text(formData, 'headline').slice(0, MAX_HEADLINE_LENGTH) || null,
      prompts: parsePromptAnswers(formData.getAll('prompt_key').map(String), formData.getAll('prompt_answer').map(String)),
      linkedin_url: linkedin,
      github_url: github,
      photo_path: await upload('photo', photo, existing?.photo_path),
      resume_path: await upload('resume', resume, existing?.resume_path),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  )
  if (error) fail(`Could not save your profile: ${error.message}`)

  // Headline and prompts reach matching on the next regeneration; re-running
  // it here would spend a minute of Groq quota on a profile tweak.
  revalidatePath('/profile', 'layout')
  redirect('/profile?saved=about')
}

export async function saveMatchingAnswers(formData: FormData) {
  const { supabase, user } = await requireUser()

  const { data: before } = await supabase.from('student_profiles').select('id').eq('user_id', user.id).maybeSingle()
  const weeklyHours = parseInt(text(formData, 'weekly_availability_hours'), 10)

  const { data: profile, error } = await supabase
    .from('student_profiles')
    .upsert(
      {
        user_id: user.id,
        major: text(formData, 'major'),
        academic_year: text(formData, 'academic_year'),
        research_interests: toArray(formData.get('research_interests')),
        technical_skills: toArray(formData.get('technical_skills')),
        coursework: toArray(formData.get('coursework')),
        career_goals: text(formData, 'career_goals'),
        weekly_availability_hours: Number.isFinite(weeklyHours) ? weeklyHours : null,
      },
      { onConflict: 'user_id' }
    )
    .select('id')
    .single()
  if (error || !profile) fail(`Could not save your answers: ${error?.message}`)

  revalidatePath('/', 'layout')

  // First time: wait, so the student lands on matches that already exist
  // (same as the old onboarding). After that, refresh in the background.
  if (!before) {
    await generateMatchesForStudent(profile!.id, supabase)
    redirect('/matches')
  }
  after(() =>
    generateMatchesForStudent(profile!.id, supabase).catch((err) => console.error('Background match refresh failed:', err))
  )
  redirect('/profile?saved=matching#matching')
}

// Both pop-up buttons land here; "Answer questions" also jumps to the form.
export async function dismissReminder(formData: FormData) {
  const { supabase, user } = await requireUser()
  await supabase
    .from('student_public_profiles')
    .upsert({ user_id: user.id, reminder_seen_at: new Date().toISOString() }, { onConflict: 'user_id' })
  revalidatePath('/', 'layout')
  if (formData.get('go') === 'answer') redirect('/profile#matching')
}
