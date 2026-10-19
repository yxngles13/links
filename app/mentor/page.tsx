// app/mentor/page.tsx
// Mentor dashboard: incoming requests, upcoming chats, past mentees.
import { redirect } from 'next/navigation'
import AppNav from '@/components/AppNav'
import { requireUser } from '@/lib/auth'
import { formatChatTime, initials, timeAgo } from '@/lib/format'
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
    <div className="l-page">
      <AppNav active="mentor-dashboard" />

      <div className="l-layout">
        <div className="l-main" style={{ gap: 18 }}>
          <div>
            <h1 className="l-page-title" style={{ margin: '0 0 6px' }}>Welcome back, {firstName}</h1>
            <p className="l-body" style={{ margin: 0, fontSize: 15 }}>
              {incoming.length
                ? `${incoming.length} student${incoming.length === 1 ? ' wants' : 's want'} to talk to you. Reply when you have a minute.`
                : 'No new requests right now.'}
            </p>
          </div>

          <div className="l-stats">
            <div className="l-stat" style={{ background: 'var(--links-tint-1)' }}>
              <div className="l-stat-num" style={{ color: 'var(--links-secondary)' }}>{incoming.length}</div>
              <div className="l-stat-label">New requests</div>
            </div>
            <div className="l-stat" style={{ background: 'var(--links-surface)' }}>
              <div className="l-stat-num" style={{ color: 'var(--links-primary-hover)' }}>{thisWeek}</div>
              <div className="l-stat-label">Chat{thisWeek === 1 ? '' : 's'} this week</div>
            </div>
            <div className="l-stat" style={{ background: 'var(--links-tint-3)' }}>
              <div className="l-stat-num" style={{ color: '#4b5578' }}>{helped}</div>
              <div className="l-stat-label">Student{helped === 1 ? '' : 's'} helped</div>
            </div>
          </div>

          <section>
            <h2 className="l-eyebrow" style={{ margin: '0 0 10px' }}>Incoming requests</h2>
            {incoming.length === 0 ? (
              <p className="l-body" style={{ margin: 0 }}>
                {mentor.is_accepting ? 'Nothing waiting. Students see your profile under Mentors.' : 'You are paused, so students cannot send new requests.'}
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {incoming.map((r) => (
                  <div key={r.id} className="l-card l-card-soft" style={{ borderRadius: 20, padding: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                      <div style={{ display: 'flex', gap: 12 }}>
                        <div className="l-avatar l-avatar-sm">{initials(r.student_name)}</div>
                        <div>
                          <div style={{ fontWeight: 700 }}>
                            {r.student_name ?? 'A student'}
                            {r.student_summary ? <span style={{ fontWeight: 600, color: 'rgba(19,19,22,0.55)' }}> · {r.student_summary}</span> : null}
                          </div>
                          {r.topic ? <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--links-primary-hover)', marginTop: 2 }}>{r.topic}</div> : null}
                          {r.message ? <p style={{ margin: '8px 0 0', fontSize: 14, lineHeight: 1.55, color: 'rgba(19,19,22,0.75)' }}>“{r.message}”</p> : null}
                          <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(19,19,22,0.45)', marginTop: 6 }}>{timeAgo(r.created_at)}</div>
                        </div>
                      </div>
                      {r.fit_label ? <span className="l-chip l-chip-strong" style={{ flexShrink: 0 }}>{r.fit_label}</span> : null}
                    </div>
                    <form action={respondToRequest} style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 14 }}>
                      <input type="hidden" name="request_id" value={r.id} />
                      <button type="submit" name="decision" value="declined" className="l-btn l-btn-white l-btn-sm">Decline</button>
                      <button type="submit" name="decision" value="accepted" className="l-btn l-btn-primary l-btn-sm">Accept</button>
                    </form>
                  </div>
                ))}
              </div>
            )}
          </section>

          <div className="l-grid" style={{ gap: 14 }}>
            <section className="l-card l-card-dark" style={{ borderRadius: 22, padding: 20 }}>
              <h2 className="l-eyebrow" style={{ margin: '0 0 10px' }}>Upcoming chats</h2>
              {scheduled.length === 0 ? (
                <p style={{ margin: 0, fontSize: 14, color: 'var(--links-on-dark-muted)' }}>
                  {waiting.length ? `${waiting.length} accepted, waiting for the student to pick a time.` : 'Nothing scheduled yet.'}
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {scheduled.map((r) => (
                    <div key={r.id}>
                      <div style={{ fontSize: 15, fontWeight: 700 }}>{r.student_name} · {formatChatTime(r.scheduled_at!)}</div>
                      <div style={{ fontSize: 13, color: 'var(--links-on-dark-muted)' }}>
                        {[r.topic, mentor.preferred_format].filter(Boolean).join(' · ')}
                      </div>
                      {r.isPast ? (
                        <form action={completeChatAsMentor} style={{ marginTop: 8 }}>
                          <input type="hidden" name="request_id" value={r.id} />
                          <button type="submit" className="l-btn l-btn-white l-btn-sm">Mark as done</button>
                        </form>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="l-card l-card-soft" style={{ borderRadius: 22, padding: 20 }}>
              <h2 className="l-eyebrow" style={{ margin: '0 0 10px' }}>Past mentees</h2>
              {completed.length === 0 ? (
                <p className="l-body" style={{ margin: 0 }}>No completed chats yet.</p>
              ) : (
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14, fontWeight: 600 }}>
                  {completed.map((r) => (
                    <li key={r.id}>
                      {r.student_name} · {new Date(r.scheduled_at ?? r.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/Los_Angeles' })}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>

        <aside className="l-side">
          <div className="l-card l-card-soft" style={{ borderRadius: 22, padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="l-eyebrow">Availability</div>
            <form action={toggleAccepting} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <span style={{ fontSize: 15, fontWeight: 800 }}>{mentor.is_accepting ? 'Open to new mentees' : 'Paused'}</span>
              <button type="submit" className="l-btn l-btn-sm l-btn-soft" aria-pressed={mentor.is_accepting}>
                {mentor.is_accepting ? 'Pause' : 'Reopen'}
              </button>
            </form>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--links-text-muted)' }}>
              {[mentor.availability, mentor.preferred_format].filter(Boolean).join(' · ')}
            </div>
          </div>

          {mentor.mentor_topics.length ? (
            <div className="l-card l-card-tint" style={{ borderRadius: 22, padding: 20 }}>
              <div className="l-eyebrow" style={{ color: 'var(--links-secondary)', marginBottom: 10 }}>I can help with</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {mentor.mentor_topics.map((t) => (
                  <span key={t} className="l-chip" style={{ background: 'rgba(255,255,255,0.7)', color: 'var(--links-secondary)' }}>{t}</span>
                ))}
              </div>
            </div>
          ) : null}

          <div className="l-card l-card-dark" style={{ borderRadius: 22, padding: 20 }}>
            <div className="l-eyebrow" style={{ marginBottom: 10 }}>Your impact</div>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: 'var(--links-on-dark-muted)' }}>
              {helped
                ? `${helped} student${helped === 1 ? '' : 's'} helped over ${completed.length} chat${completed.length === 1 ? '' : 's'}. Share your profile with your club to bring in more mentees.`
                : 'Your first completed chat shows up here. Share Links with your club to bring in mentees.'}
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}
