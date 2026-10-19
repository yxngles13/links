// components/ProfileReminder.tsx
// Nudges students who haven't answered the matching questions yet: a pop-up
// the first time, then a slim banner on every student page until they do.
// Renders nothing once the questions are answered.
import Link from 'next/link'
import ReminderDialog from '@/components/ReminderDialog'
import { requireUser } from '@/lib/auth'
import { getPublicProfile } from '@/lib/student-profile'

export default async function ProfileReminder() {
  const { supabase, user } = await requireUser()
  const [{ data: answers }, { profile, missing }] = await Promise.all([
    supabase.from('student_profiles').select('id').eq('user_id', user.id).maybeSingle(),
    getPublicProfile(supabase, user.id),
  ])
  if (answers) return null

  // Without the profiles table there's nowhere to remember "seen", so skip
  // the pop-up rather than show it on every page load.
  if (!missing && !profile?.reminder_seen_at) return <ReminderDialog />

  return (
    <div style={{ borderBottom: '1px solid var(--line)', padding: '12px var(--gutter)' }}>
      <div style={{ borderLeft: '2px solid var(--accent)', paddingLeft: 14, fontSize: 14, color: 'var(--text-2)' }}>
        Your matches are waiting.{' '}
        <Link href="/profile#matching" className="link">Answer a few questions →</Link>
      </div>
    </div>
  )
}
