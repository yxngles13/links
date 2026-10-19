// app/profile/[id]/page.tsx
// Someone else's profile, as any signed-in user sees it. Only the public
// part: matching answers (student_profiles) are never read here.
import { notFound, redirect } from 'next/navigation'
import AppNav from '@/components/AppNav'
import ProfileHeader from '@/components/ProfileHeader'
import ProfilePrompts from '@/components/ProfilePrompts'
import { requireUser } from '@/lib/auth'
import { getOwnMentorProfile } from '@/lib/mentors'
import { getPublicProfile, signedFileUrls } from '@/lib/student-profile'

export default async function PublicProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase, user } = await requireUser()
  if (id === user.id) redirect('/profile')

  // Malformed ids would make Postgres throw on the uuid cast.
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const [{ profile }, mentor] = await Promise.all([
    getPublicProfile(supabase, id),
    getOwnMentorProfile(supabase, user.id).catch(() => null),
  ])
  // No row: the student hasn't filled anything in yet (or the id is unknown;
  // RLS doesn't let us tell those apart, and it doesn't matter here).
  if (!profile || (!profile.full_name && !profile.headline && !profile.prompts.length)) {
    return (
      <>
        <AppNav active={mentor ? 'mentor-dashboard' : 'profile'} />
        <main className="page">
          <p className="body-copy">This student hasn&apos;t filled in their profile yet.</p>
        </main>
      </>
    )
  }
  const { photoUrl, resumeUrl } = await signedFileUrls(supabase, profile)

  return (
    <>
      <AppNav active={mentor ? 'mentor-dashboard' : 'profile'} />
      <main className="page" style={{ maxWidth: 960 }}>
        <ProfileHeader
          name={profile.full_name || 'A Links student'}
          headline={profile.headline}
          photoUrl={photoUrl}
          resumeUrl={resumeUrl}
          linkedin={profile.linkedin_url}
          github={profile.github_url}
        />
        <div style={{ paddingTop: 16 }}>
          {profile.prompts.length ? <ProfilePrompts prompts={profile.prompts} /> : <p className="body-copy" style={{ paddingTop: 24 }}>Nothing here yet.</p>}
        </div>
      </main>
    </>
  )
}
