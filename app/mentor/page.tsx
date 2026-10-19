// app/mentor/page.tsx
// Mentor dashboard: incoming requests, upcoming chats, past mentees.
import Link from 'next/link'
import { redirect } from 'next/navigation'
import AppNav from '@/components/AppNav'
import { requireUser } from '@/lib/auth'
import { formatChatTime, timeAgo } from '@/lib/format'
import { getOwnMentorProfile } from '@/lib/mentors'
import { completeChatAsMentor, respondToRequest, toggleAccepting } from './actions'

type Request = {
  id: string
  student_user_id: string
  student_name: string | null
  student_summary: string | null
  topic: string | null
  message: string | null
  fit_label: string | null
  status: string
  scheduled_at: string | null
  updated_at: string
  created_at: string
}

const WEEK = 7 * 24 * 60 * 60 * 1000

// Splits requests into the dashboard's sections. Kept out of the component
// so "now" is read once per request, not during render.
function bucket(requests: Request[], now = Date.now()) {
  const scheduled = requests
    .filter((r) => r.status === 'scheduled' && r.scheduled_at)
    .sort((a, b) => a.scheduled_at!.localeCompare(b.scheduled_at!))
    .map((r) => ({ ...r, isPast: new Date(r.scheduled_at!).getTime() < now }))
  const completed = requests.filter((r) => r.status === 'completed')
  return {
    incoming: requests.filter((r) => r.status === 'requested'),
    waiting: requests.filter((r) => r.status === 'accepted'),
    scheduled,
    thisWeek: scheduled.filter((r) => new Date(r.scheduled_at!).getTime() - now < WEEK).length,
    completed,
    helped: new Set(completed.map((r) => r.student_user_id)).size,
  }
}

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/Los_Angeles' })

export default async function MentorDashboardPage() {
  const { supabase, user } = await requireUser()
  const mentor = await getOwnMentorProfile(supabase, user.id)
  if (!mentor) redirect('/mentor/profile')

  const { data } = await supabase
    .from('mentorship_requests')
    .select('id, student_user_id, student_name, student_summary, topic, message, fit_label, status, scheduled_at, updated_at, created_at')
    .eq('mentor_profile_id', mentor.id)
    .order('created_at', { ascending: false })
  const requests = (data ?? []) as Request[]

  const { incoming, waiting, scheduled, thisWeek, completed, helped } = bucket(requests)
  const firstName = mentor.full_name.split(' ')[0]

  return (
    <>
      <AppNav active="mentor-dashboard" />
      <div className="shell">
        <main className="main">
          <h1 className="title" style={{ marginBottom: 10 }}>Welcome back, {firstName}</h1>
          <div className="meta" style={{ marginBottom: 28 }}>
            {incoming.length
              ? `${incoming.length === 1 ? 'One student wants' : `${incoming.length} students want`} to talk to you. Reply when you have a minute.`
              : 'No new requests right now.'}
          </div>

          <div className="stats">
            <div className="stat"><span className={`serif${incoming.length ? ' accent' : ''}`}>{incoming.length}</span><span>New request{incoming.length === 1 ? '' : 's'}</span></div>
            <div className="stat"><span className="serif">{thisWeek}</span><span>Chat{thisWeek === 1 ? '' : 's'} this week</span></div>
            <div className="stat"><span className="serif">{helped}</span><span>Student{helped === 1 ? '' : 's'} helped</span></div>
          </div>

          <section>
            <h2 className="label" style={{ margin: '0 0 6px', fontWeight: 400 }}>Incoming requests</h2>
            {incoming.length === 0 ? (
              <p className="body-copy">
                {mentor.is_accepting ? 'Nothing waiting. Students find you under Mentors.' : 'You are paused, so students cannot send new requests.'}
              </p>
            ) : (
              <ul className="rows" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {incoming.map((r) => (
                  <li key={r.id} className="row" style={{ display: 'flex', flexWrap: 'wrap', gap: '16px 24px', padding: '20px 0' }}>
                    <div style={{ flex: 1, minWidth: 'min(100%, 320px)' }}>
                      <div>
                        <Link href={`/profile/${r.student_user_id}`} className="name-sm" style={{ fontSize: 26 }}>{r.student_name ?? 'A student'}</Link>{' '}
                        <span style={{ fontSize: 13, color: 'var(--muted)' }}>{[r.student_summary, r.topic].filter(Boolean).join(' · ')}</span>
                      </div>
                      {r.message ? <p className="body-copy" style={{ color: 'var(--text-2)', marginTop: 4, maxWidth: 520 }}>“{r.message}”</p> : null}
                      <div className="num" style={{ marginTop: 6 }}>{timeAgo(r.created_at)}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      {r.fit_label ? <div className="label" style={{ color: r.fit_label === 'Great fit' ? 'var(--accent)' : undefined, marginBottom: 12 }}>{r.fit_label}</div> : null}
                      <form action={respondToRequest} style={{ display: 'flex', alignItems: 'center', gap: 20, justifyContent: 'flex-end' }}>
                        <input type="hidden" name="request_id" value={r.id} />
                        <button type="submit" name="decision" value="declined" className="link-quiet">Decline</button>
                        <button type="submit" name="decision" value="accepted" className="btn btn-sm">Accept</button>
                      </form>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </main>

        <aside className="aside">
          <div className="label" style={{ marginBottom: 8 }}>Upcoming chats</div>
          {scheduled.length === 0 ? (
            <p className="body-copy" style={{ fontSize: 14, marginBottom: 28 }}>
              {waiting.length ? `${waiting.length} accepted, waiting for the student to pick a time.` : 'Nothing scheduled yet.'}
            </p>
          ) : (
            <ul className="rows" style={{ listStyle: 'none', margin: '0 0 28px', padding: 0 }}>
              {scheduled.map((r) => (
                <li key={r.id} className="row row-tight">
                  <Link href={`/profile/${r.student_user_id}`} className="name-sm" style={{ fontSize: 22, display: 'block' }}>{r.student_name}</Link>
                  <div style={{ fontSize: 13, color: 'var(--muted)' }}>{[formatChatTime(r.scheduled_at!), r.topic].filter(Boolean).join(' · ')}</div>
                  {r.isPast ? (
                    <form action={completeChatAsMentor} style={{ marginTop: 8 }}>
                      <input type="hidden" name="request_id" value={r.id} />
                      <button type="submit" className="link" style={{ fontSize: 13 }}>Mark as done</button>
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>
          )}

          <div className="label" style={{ marginBottom: 8 }}>Availability</div>
          <form action={toggleAccepting} className="row-split" style={{ marginBottom: 4 }}>
            <span style={{ fontSize: 15, fontWeight: 500, color: mentor.is_accepting ? 'var(--accent)' : undefined }}>
              {mentor.is_accepting ? 'Open to new mentees' : 'Paused'}
            </span>
            <button type="submit" className="link" style={{ fontSize: 13 }} aria-pressed={mentor.is_accepting}>
              {mentor.is_accepting ? 'Pause' : 'Reopen'}
            </button>
          </form>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 28 }}>{[mentor.availability, mentor.preferred_format].filter(Boolean).join(' · ')}</div>

          {mentor.mentor_topics.length ? (
            <>
              <div className="label" style={{ marginBottom: 8 }}>I can help with</div>
              <p className="body-copy" style={{ fontSize: 14, color: 'var(--text-2)', marginBottom: 28 }}>{mentor.mentor_topics.join(', ')}</p>
            </>
          ) : null}

          <div className="label" style={{ marginBottom: 8 }}>Past mentees</div>
          {completed.length === 0 ? (
            <p className="body-copy" style={{ fontSize: 14 }}>No completed chats yet.</p>
          ) : (
            <ul className="rows" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {completed.map((r) => (
                <li key={r.id} className="row row-tight row-split" style={{ fontSize: 14 }}>
                  <span>{r.student_name}</span>
                  <span className="muted">{shortDate(r.scheduled_at ?? r.updated_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </>
  )
}
