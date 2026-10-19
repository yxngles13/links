// lib/student-profile.ts
// Reads for the public student profile (student_public_profiles) and its
// photo / resume in the private "profile-files" bucket.
import type { SupabaseClient } from '@supabase/supabase-js'
import { isMissingTable } from '@/components/MigrationNotice'
import type { PromptAnswer } from '@/lib/profile'

export const PROFILE_BUCKET = 'profile-files'
export const PROFILE_MIGRATION = 'supabase/migrations/20261020000000_student_public_profiles.sql'

export type PublicProfile = {
  user_id: string
  full_name: string | null
  headline: string | null
  prompts: PromptAnswer[]
  linkedin_url: string | null
  github_url: string | null
  photo_path: string | null
  resume_path: string | null
  reminder_seen_at: string | null
}

// `missing` = the migration hasn't been run yet, so pages can say so instead
// of crashing.
export async function getPublicProfile(
  supabase: SupabaseClient,
  userId: string
): Promise<{ profile: PublicProfile | null; missing: boolean }> {
  const { data, error } = await supabase.from('student_public_profiles').select('*').eq('user_id', userId).maybeSingle()
  if (error) {
    if (isMissingTable(error)) return { profile: null, missing: true }
    throw new Error(`Could not load profile: ${error.message}`)
  }
  return { profile: data ? { ...data, prompts: cleanPrompts(data.prompts) } : null, missing: false }
}

// Rows can be written straight through the API, not only by our form, so
// never trust the shape of the stored JSON when rendering it.
function cleanPrompts(value: unknown): PromptAnswer[] {
  if (!Array.isArray(value)) return []
  return value.filter((p): p is PromptAnswer => typeof p?.key === 'string' && typeof p?.answer === 'string')
}

// The bucket is private; pages render links that work for an hour.
export async function signedFileUrls(
  supabase: SupabaseClient,
  profile: Pick<PublicProfile, 'photo_path' | 'resume_path'> | null
): Promise<{ photoUrl: string | null; resumeUrl: string | null }> {
  const sign = async (path: string | null | undefined) => {
    if (!path) return null
    const { data } = await supabase.storage.from(PROFILE_BUCKET).createSignedUrl(path, 60 * 60)
    return data?.signedUrl ?? null
  }
  const [photoUrl, resumeUrl] = await Promise.all([sign(profile?.photo_path), sign(profile?.resume_path)])
  return { photoUrl, resumeUrl }
}
