// app/mentors/page.tsx
// Mentee dashboard: next chat, request statuses, goals, suggested mentors.
import Link from 'next/link'
import AppNav from '@/components/AppNav'
import MigrationNotice, { isMissingTable } from '@/components/MigrationNotice'
import SubmitButton from '@/components/SubmitButton'
import { requireUser, displayName } from '@/lib/auth'
import { formatChatTime, initials, timeAgo } from '@/lib/format'
import { isoToPacificLocal, mentorSubtitle, rankMentorsForStudent } from '@/lib/mentors'
import { addGoal, logMentorChat, scheduleChat, toggleGoal } from './actions'

type Request = {
  id: string
  topic: string | null
  status: string
  scheduled_at: string | null
  created_at: string
  mentor_profile_id: string
  mentor_profiles: { full_name: string; grad_year: number | null; job_title: string | null; company: string | null; preferred_format: string | null } | null
}

// Splits requests by time. Kept out of the component so "now" is read once
// per request, not during render.
function bucket(requests: Request[], now = Date.now()) {
  const withPast = requests.map((r) => ({
    ...r,
    isPast: r.status === 'scheduled' && !!r.scheduled_at && new Date(r.scheduled_at).getTime() <= now,
  }))
  return {
    requests: withPast,
    upcoming: withPast
      .filter((r) => r.status === 'scheduled' && !r.isPast)
      .sort((a, b) => a.scheduled_at!.localeCompare(b.scheduled_at!)),
  }
}

function ScheduleForm({ request, label }: { request: Request; label: string }) {
  return (
    <details className="l-details">
      <summary className="l-link">{label}</summary>
      <form action={scheduleChat} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 10 }}>
        <input type="hidden" name="request_id" value={request.id} />
        <label htmlFor={`when-${request.id}`} className="sr-only">Chat time (Pacific)</label>
        <input
          id={`when-${request.id}`}
          type="datetime-local"
          name="scheduled_at"
          required
          defaultValue={request.scheduled_at ? isoToPacificLocal(request.scheduled_at) : undefined}
          className="l-input l-input-sm"
          style={{ width: 'auto', background: '#fff' }}
        />
        <button type="submit" className="l-btn l-btn-primary l-btn-sm">Save time</button>
      </form>
    </details>
  )
}

function LogChatForm({ request }: { request: Request }) {
  return (
    <details className="l-details">
      <summary className="l-link">Log it →</summary>
      <form action={logMentorChat} style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
        <input type="hidden" name="request_id" value={request.id} />
        <label htmlFor={`learned-${request.id}`} className="sr-only">What you learned</label>
        <textarea id={`learned-${request.id}`} name="notes" rows={3} required placeholder="What did you learn? Anything you promised to follow up on?" className="l-textarea l-input-sm" style={{ background: '#fff', resize: 'vertical' }} />
        <SubmitButton pendingText="Drafting a thank-you note…">Save and draft thank-you</SubmitButton>
      </form>
    </details>
  )
}

export default async function MenteeDashboardPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams
  const { supabase, user } = await requireUser()
  const name = displayName(user).split(' ')[0]

  const [{ data, error: reqError }, { data: goals }] = await Promise.all([
    supabase
      .from('mentorship_requests')
      .select('id, topic, status, scheduled_at, created_at, mentor_profile_id, mentor_profiles ( full_name, grad_year, job_title, company, preferred_format )')
      .eq('student_user_id', user.id)
      .order('created_at', { ascending: false }),
    supabase.from('student_goals').select('id, text, done').eq('user_id', user.id).order('created_at'),
  ])

  if (isMissingTable(reqError)) {
    return (
      <div className="l-page">
        <AppNav active="mentors" />
        <MigrationNotice />
      </div>
    )
  }

  const { requests, upcoming } = bucket((data ?? []) as unknown as Request[])
  const waiting = requests.filter((r) => r.status === 'requested' || r.status === 'accepted').length
  const completed = requests.filter((r) => r.status === 'completed').length
  const next = upcoming[0]

  const requestedIds = new Set(requests.filter((r) => r.status !== 'declined').map((r) => r.mentor_profile_id))
  const suggested = (await rankMentorsForStudent(supabase, user.id)).filter((r) => !requestedIds.has(r.mentor.id)).slice(0, 2)

  return (
    <div className="l-page">
      <AppNav active="mentors" />

      <div className="l-layout">
        <div className="l-main" style={{ gap: 18 }}>
          <div className="l-row-head">
            <div>
              <h1 className="l-page-title" style={{ margin: '0 0 6px' }}>Hey {name}</h1>
              <p className="l-body" style={{ margin: 0, fontSize: 15 }}>
                {requests.length === 0
                  ? 'No mentor chats yet. Find someone who has walked the path you are figuring out.'
                  : `You have ${upcoming.length} chat${upcoming.length === 1 ? '' : 's'} coming up and ${waiting} request${waiting === 1 ? '' : 's'} waiting on a next step.`}
              </p>
            </div>
            <Link href="/mentors/find" className="l-btn l-btn-primary">Find a mentor →</Link>
          </div>

          {error ? <div className="l-card l-card-soft" style={{ color: '#a01818', fontWeight: 600 }}>{error}</div> : null}

          <div className="l-stats">
            <div className="l-stat" style={{ background: 'var(--links-tint-1)' }}>
              <div className="l-stat-num" style={{ color: 'var(--links-secondary)' }}>{requests.length}</div>
              <div className="l-stat-label">Requests sent</div>
            </div>
            <div className="l-stat" style={{ background: 'var(--links-surface)' }}>
              <div className="l-stat-num" style={{ color: 'var(--links-primary-hover)' }}>{upcoming.length}</div>
              <div className="l-stat-label">Chat{upcoming.length === 1 ? '' : 's'} scheduled</div>
            </div>
            <div className="l-stat" style={{ background: 'var(--links-tint-3)' }}>
              <div className="l-stat-num" style={{ color: '#4b5578' }}>{completed}</div>
              <div className="l-stat-label">Chat{completed === 1 ? '' : 's'} completed</div>
            </div>
          </div>

          {next ? (
            <div className="l-card l-card-dark" style={{ borderRadius: 22, display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                <div className="l-avatar" style={{ background: '#fff', color: 'var(--links-secondary)' }}>{initials(next.mentor_profiles?.full_name)}</div>
                <div>
                  <div className="l-eyebrow" style={{ marginBottom: 4 }}>Next chat · {formatChatTime(next.scheduled_at!)}</div>
                  <div style={{ fontSize: 18, fontWeight: 800 }}>{next.mentor_profiles?.full_name}</div>
                  <div style={{ fontSize: 13.5, color: 'var(--links-on-dark-muted)' }}>
                    {[next.topic && `Topic: ${next.topic}`, next.mentor_profiles?.preferred_format].filter(Boolean).join(' · ')}
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          <section>
            <h2 className="l-eyebrow" style={{ margin: '0 0 10px' }}>Your requests</h2>
            {requests.length === 0 ? (
              <p className="l-body" style={{ margin: 0 }}>Requests you send show up here with their status.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {requests.map((r) => {
                  const past = r.isPast
                  return (
                    <div key={r.id} className="l-card l-card-soft" style={{ borderRadius: 18, padding: '14px 18px', display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                        <div className="l-avatar l-avatar-sm">{initials(r.mentor_profiles?.full_name)}</div>
                        <div>
                          <div style={{ fontWeight: 700 }}>{r.mentor_profiles?.full_name}</div>
                          <div style={{ fontSize: 12.5, fontWeight: 600, color: 'rgba(19,19,22,0.55)' }}>{r.topic ?? (r.mentor_profiles ? mentorSubtitle(r.mentor_profiles) : '')}</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                        {r.status === 'requested' ? <span className="l-chip l-chip-neutral">Requested · {timeAgo(r.created_at).toLowerCase()}</span> : null}
                        {r.status === 'declined' ? <span className="l-chip l-chip-muted">Declined</span> : null}
                        {r.status === 'accepted' ? (
                          <>
                            <span className="l-chip l-chip-strong">Accepted · pick a time</span>
                            <ScheduleForm request={r} label="Pick a time" />
                          </>
                        ) : null}
                        {r.status === 'scheduled' && !past ? (
                          <>
                            <span className="l-chip">Scheduled · {formatChatTime(r.scheduled_at!)}</span>
                            <ScheduleForm request={r} label="Reschedule" />
                          </>
                        ) : null}
                        {past || r.status === 'completed' ? (
                          <>
                            <span className="l-chip l-chip-neutral">{r.status === 'completed' ? 'Completed' : 'Chat done?'}</span>
                            <LogChatForm request={r} />
                          </>
                        ) : null}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        </div>

        <aside className="l-side">
          <div className="l-card l-card-soft" style={{ borderRadius: 22, padding: 20 }}>
            <div className="l-eyebrow" style={{ marginBottom: 12 }}>Your goals</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {(goals ?? []).map((g) => (
                <form key={g.id} action={toggleGoal}>
                  <input type="hidden" name="goal_id" value={g.id} />
                  <button type="submit" aria-pressed={g.done} className="l-check" style={{ border: 'none', background: 'none', padding: '6px 0', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', color: 'inherit', minHeight: 32 }}>
                    <span aria-hidden="true" style={{ width: 20, height: 20, borderRadius: 6, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: g.done ? 'var(--links-primary)' : '#fff', border: g.done ? 'none' : '1.5px solid rgba(19,19,22,0.2)', color: '#fff', fontSize: 13 }}>
                      {g.done ? '✓' : ''}
                    </span>
                    <span style={{ textDecoration: g.done ? 'line-through' : 'none', opacity: g.done ? 0.6 : 1 }}>{g.text}</span>
                  </button>
                </form>
              ))}
            </div>
            <form action={addGoal} style={{ display: 'flex', gap: 6, marginTop: 10 }}>
              <label htmlFor="goal" className="sr-only">New goal</label>
              <input id="goal" name="text" placeholder="Add a goal" className="l-input l-input-sm" style={{ background: '#fff' }} />
              <button type="submit" className="l-btn l-btn-dark l-btn-sm">Add</button>
            </form>
          </div>

          {suggested.length ? (
            <div className="l-card l-card-tint" style={{ borderRadius: 22, padding: 20 }}>
              <div className="l-eyebrow" style={{ color: 'var(--links-secondary)', marginBottom: 12 }}>Suggested for you</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {suggested.map(({ mentor: m }) => (
                  <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <div className="l-avatar l-avatar-sm">{initials(m.full_name)}</div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700 }}>{m.full_name}</div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(19,19,22,0.55)' }}>{mentorSubtitle(m)}</div>
                      </div>
                    </div>
                    <Link href={`/mentors/find#m-${m.id}`} className="l-link">Request</Link>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="l-card l-card-dark" style={{ borderRadius: 22, padding: 20 }}>
            <div className="l-eyebrow" style={{ marginBottom: 10 }}>After your chat</div>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: 'var(--links-on-dark-muted)' }}>
              Log what you learned and Links adds your mentor to your network with a thank-you note drafted.
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}
