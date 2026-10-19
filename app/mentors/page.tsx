// app/mentors/page.tsx
// Mentee dashboard: next chat, request statuses, goals, suggested mentors.
import Link from 'next/link'
import AppNav from '@/components/AppNav'
import MigrationNotice, { isMissingTable } from '@/components/MigrationNotice'
import LinkedInLink from '@/components/LinkedInLink'
import SubmitButton from '@/components/SubmitButton'
import { requireUser, displayName } from '@/lib/auth'
import { formatChatTime, timeAgo } from '@/lib/format'
import { isoToPacificLocal, mentorSubtitle, rankMentorsForStudent } from '@/lib/mentors'
import { addGoal, logMentorChat, scheduleChat, toggleGoal } from './actions'

type Request = {
  id: string
  topic: string | null
  status: string
  scheduled_at: string | null
  created_at: string
  mentor_profile_id: string
  mentor_profiles: { full_name: string; grad_year: number | null; job_title: string | null; company: string | null; preferred_format: string | null; linkedin_url?: string | null } | null
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
    <details className="details">
      <summary className="link">{label}</summary>
      <form action={scheduleChat} style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end', marginTop: 14 }}>
        <input type="hidden" name="request_id" value={request.id} />
        <div className="field">
          <label htmlFor={`when-${request.id}`}>Chat time (Pacific)</label>
          <input
            id={`when-${request.id}`}
            type="datetime-local"
            name="scheduled_at"
            required
            defaultValue={request.scheduled_at ? isoToPacificLocal(request.scheduled_at) : undefined}
            className="input"
            style={{ width: 'auto', fontSize: 15 }}
          />
        </div>
        <button type="submit" className="btn btn-sm">Save time</button>
      </form>
    </details>
  )
}

function LogChatForm({ request }: { request: Request }) {
  return (
    <details className="details">
      <summary className="link">Log what you learned</summary>
      <form action={logMentorChat} className="form" style={{ gap: 14, marginTop: 14, maxWidth: 480 }}>
        <input type="hidden" name="request_id" value={request.id} />
        <div className="field">
          <label htmlFor={`learned-${request.id}`}>What you learned</label>
          <textarea id={`learned-${request.id}`} name="notes" rows={2} required placeholder="Anything you promised to follow up on?" className="input" style={{ fontSize: 15 }} />
        </div>
        <div><SubmitButton className="btn btn-sm" pendingText="Drafting a thank-you note…">Save and draft thank-you</SubmitButton></div>
      </form>
    </details>
  )
}

function statusText(r: ReturnType<typeof bucket>['requests'][number]) {
  if (r.status === 'requested') return `Requested ${timeAgo(r.created_at).toLowerCase()}`
  if (r.status === 'accepted') return 'Accepted, pick a time'
  if (r.status === 'declined') return 'Declined'
  if (r.status === 'completed') return 'Completed'
  return r.isPast ? 'Chat done?' : `Scheduled · ${formatChatTime(r.scheduled_at!)}`
}

export default async function MenteeDashboardPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams
  const { supabase, user } = await requireUser()
  const name = displayName(user).split(' ')[0]

  const [{ data, error: reqError }, { data: goals }] = await Promise.all([
    supabase
      .from('mentorship_requests')
      .select('id, topic, status, scheduled_at, created_at, mentor_profile_id, mentor_profiles ( * )')
      .eq('student_user_id', user.id)
      .order('created_at', { ascending: false }),
    // Tie-break on id: goals created together share a timestamp, and without
    // it the list reshuffles every time one is ticked.
    supabase.from('student_goals').select('id, text, done').eq('user_id', user.id).order('created_at').order('id'),
  ])

  if (isMissingTable(reqError)) {
    return (
      <>
        <AppNav active="mentors" />
        <main className="page"><MigrationNotice /></main>
      </>
    )
  }

  const { requests, upcoming } = bucket((data ?? []) as unknown as Request[])
  const waiting = requests.filter((r) => r.status === 'requested' || r.status === 'accepted').length
  const completed = requests.filter((r) => r.status === 'completed').length
  const next = upcoming[0]

  const requestedIds = new Set(requests.filter((r) => r.status !== 'declined').map((r) => r.mentor_profile_id))
  const suggested = (await rankMentorsForStudent(supabase, user.id)).filter((r) => !requestedIds.has(r.mentor.id)).slice(0, 2)

  return (
    <>
      <AppNav active="mentors" />
      <div className="shell">
        <main className="main">
          <div className="head-row">
            <div>
              <h1 className="title" style={{ marginBottom: 10 }}>Hello, {name}</h1>
              <div className="meta">
                {requests.length === 0
                  ? 'No mentor chats yet. Find someone who has walked the path you are figuring out.'
                  : `${upcoming.length === 1 ? 'One chat' : `${upcoming.length} chats`} coming up and ${waiting} request${waiting === 1 ? '' : 's'} waiting on a next step.`}
              </div>
            </div>
            <Link href="/mentors/find" className="btn">Find a mentor</Link>
          </div>

          {error ? <div className="alert" role="alert">{error}</div> : null}

          <div className="stats">
            <div className="stat"><span className="serif">{requests.length}</span><span>Requests sent</span></div>
            <div className="stat"><span className="serif accent">{upcoming.length}</span><span>Chat{upcoming.length === 1 ? '' : 's'} scheduled</span></div>
            <div className="stat"><span className="serif">{completed}</span><span>Chat{completed === 1 ? '' : 's'} completed</span></div>
          </div>

          {next ? (
            <section style={{ borderBottom: '1px solid var(--line)', paddingBottom: 22, marginBottom: 26 }}>
              <div className="label" style={{ marginBottom: 6 }}>Next chat · {formatChatTime(next.scheduled_at!)}</div>
              <div className="row-split" style={{ alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div>
                  <div className="serif" style={{ fontSize: 32 }}>{next.mentor_profiles?.full_name}</div>
                  <div className="meta" style={{ fontSize: 13.5, display: 'flex', flexWrap: 'wrap', gap: '4px 14px' }}>
                    <span>{[next.topic, next.mentor_profiles?.preferred_format].filter(Boolean).join(' · ')}</span>
                    <LinkedInLink url={next.mentor_profiles?.linkedin_url} name={next.mentor_profiles?.full_name ?? 'Mentor'} style={{ fontSize: 13 }} />
                  </div>
                </div>
                <ScheduleForm request={next} label="Reschedule" />
              </div>
            </section>
          ) : null}

          <section>
            <h2 className="label" style={{ margin: '0 0 6px', fontWeight: 400 }}>Your requests</h2>
            {requests.length === 0 ? (
              <p className="body-copy">Requests you send show up here with their status.</p>
            ) : (
              <ul className="rows" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {requests.map((r) => (
                  <li key={r.id} className="row row-tight">
                    <div className="row-split" style={{ flexWrap: 'wrap', fontSize: 15 }}>
                      <span>
                        {r.mentor_profiles?.full_name}{' '}
                        <span className="muted">· {r.topic ?? (r.mentor_profiles ? mentorSubtitle(r.mentor_profiles) : '')}</span>{' '}
                        <LinkedInLink url={r.mentor_profiles?.linkedin_url} name={r.mentor_profiles?.full_name ?? 'Mentor'} style={{ fontSize: 13, marginLeft: 8 }} />
                      </span>
                      <span style={{ color: r.status === 'scheduled' && !r.isPast ? 'var(--accent)' : 'var(--text-3)' }}>{statusText(r)}</span>
                    </div>
                    {r.status === 'accepted' ? <div style={{ marginTop: 10 }}><ScheduleForm request={r} label="Pick a time" /></div> : null}
                    {r.isPast || r.status === 'completed' ? <div style={{ marginTop: 10 }}><LogChatForm request={r} /></div> : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </main>

        <aside className="aside">
          <div className="label" style={{ marginBottom: 8 }}>Your goals</div>
          <ul className="rows" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {(goals ?? []).map((g) => (
              <li key={g.id} className="row" style={{ padding: '8px 0' }}>
                <form action={toggleGoal}>
                  <input type="hidden" name="goal_id" value={g.id} />
                  <button type="submit" aria-pressed={g.done} className="check">
                    <span className="box" aria-hidden="true">{g.done ? '✓' : ''}</span>
                    <span className="text">{g.text}</span>
                  </button>
                </form>
              </li>
            ))}
          </ul>
          <form action={addGoal} style={{ display: 'flex', gap: 12, alignItems: 'flex-end', marginTop: 12 }}>
            <label htmlFor="goal" className="sr-only">New goal</label>
            <input id="goal" name="text" placeholder="Add a goal" className="input" style={{ fontSize: 14 }} />
            <button type="submit" className="link" style={{ fontSize: 13 }}>Add</button>
          </form>

          {suggested.length ? (
            <>
              <div className="label" style={{ margin: '36px 0 8px' }}>Suggested for you</div>
              <ul className="rows" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {suggested.map(({ mentor: m }) => (
                  <li key={m.id} className="row row-tight row-split" style={{ fontSize: 14 }}>
                    <span>
                      {m.full_name} <span className="muted">· {m.grad_year ? `CPP '${String(m.grad_year).slice(-2)}` : m.company}</span>{' '}
                      <LinkedInLink url={m.linkedin_url} name={m.full_name} style={{ fontSize: 12, marginLeft: 6 }} />
                    </span>
                    <Link href={`/mentors/find#m-${m.id}`} className="link" style={{ fontSize: 13 }}>Request</Link>
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          <p className="body-copy" style={{ marginTop: 32, fontSize: 13, color: 'var(--muted)' }}>
            After a chat, log what you learned and Links adds your mentor to your network with a thank-you note drafted.
          </p>
        </aside>
      </div>
    </>
  )
}
