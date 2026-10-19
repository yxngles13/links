// app/mentors/find/page.tsx
// Mentor matches for a student: accepting mentors ranked against the
// student's profile, each with an inline "Request a chat" form.
import Link from 'next/link'
import AppNav from '@/components/AppNav'
import MigrationNotice, { isMissingTable } from '@/components/MigrationNotice'
import LinkedInLink from '@/components/LinkedInLink'
import SubmitButton from '@/components/SubmitButton'
import { requireUser } from '@/lib/auth'
import { mentorSubtitle, rankMentorsForStudent } from '@/lib/mentors'
import { requestChat } from '../actions'

export default async function MentorMatchesPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams
  const { supabase, user } = await requireUser()

  let ranked: Awaited<ReturnType<typeof rankMentorsForStudent>> = []
  let missing = false
  try {
    ranked = await rankMentorsForStudent(supabase, user.id)
  } catch (err) {
    if (!isMissingTable({ message: (err as Error).message })) throw err
    missing = true
  }

  const [{ data: open }, { data: student }] = await Promise.all([
    missing
      ? Promise.resolve({ data: [] as { mentor_profile_id: string }[] })
      : supabase
          .from('mentorship_requests')
          .select('mentor_profile_id')
          .eq('student_user_id', user.id)
          .in('status', ['requested', 'accepted', 'scheduled']),
    supabase.from('student_profiles').select('id').eq('user_id', user.id).maybeSingle(),
  ])
  const openIds = new Set((open ?? []).map((r) => r.mentor_profile_id))

  return (
    <>
      <AppNav active="mentors" />
      <div className="shell">
        <main className="main">
          <Link href="/mentors" className="back">← Your mentors</Link>
          <h1 className="title" style={{ margin: '18px 0 10px' }}>Your mentor matches</h1>
          <div className="meta" style={{ marginBottom: 28 }}>Alumni and seniors whose path lines up with where you want to go.</div>

          {error ? <div className="alert" role="alert">{error}</div> : null}
          {missing ? <MigrationNotice /> : null}
          {!missing && !student ? (
            <div className="notice" style={{ marginBottom: 24 }}>
              <p className="body-copy" style={{ marginBottom: 14 }}>Fill in your profile so we can rank mentors for you.</p>
              <Link href="/onboarding" className="btn">Set up your profile</Link>
            </div>
          ) : null}
          {!missing && ranked.length === 0 ? <p className="body-copy">No mentors are taking requests yet.</p> : null}

          {ranked.length ? (
            <ol className="rows" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {ranked.map(({ mentor: m, fit }, i) => (
                <li key={m.id} id={`m-${m.id}`} className="row" style={{ display: 'flex', flexWrap: 'wrap', gap: '16px 28px', padding: '24px 0' }}>
                  <span className="num" style={{ width: 24, paddingTop: 8 }}>{String(i + 1).padStart(2, '0')}</span>
                  <div style={{ flex: 1, minWidth: 'min(100%, 320px)' }}>
                    <h2 className="name" style={{ margin: 0 }}>{m.full_name}</h2>
                    <div style={{ fontSize: 13.5, color: 'var(--muted)', margin: '2px 0 10px', display: 'flex', flexWrap: 'wrap', gap: '4px 14px' }}>
                      <span>{mentorSubtitle(m)}</span>
                      <LinkedInLink url={m.linkedin_url} name={m.full_name} style={{ fontSize: 13 }} />
                    </div>
                    {m.bio ? <p className="body-copy" style={{ color: 'var(--text-2)', maxWidth: 560 }}>{m.bio}</p> : null}
                    {m.mentor_topics.length ? <div className="num" style={{ marginTop: 10 }}>{m.mentor_topics.join(' · ')}</div> : null}

                    {!openIds.has(m.id) ? (
                      <details className="details" style={{ marginTop: 16 }}>
                        <summary className="link">Request a chat</summary>
                        <form action={requestChat} className="form" style={{ gap: 16, marginTop: 18, maxWidth: 480 }}>
                          <input type="hidden" name="mentor_profile_id" value={m.id} />
                          {m.mentor_topics.length ? (
                            <div className="field">
                              <label htmlFor={`topic-${m.id}`}>Topic</label>
                              <select id={`topic-${m.id}`} name="topic" className="input">
                                {m.mentor_topics.map((t) => <option key={t}>{t}</option>)}
                              </select>
                            </div>
                          ) : null}
                          <div className="field">
                            <label htmlFor={`msg-${m.id}`}>Message</label>
                            <textarea id={`msg-${m.id}`} name="message" rows={2} required placeholder="What would you like to talk about?" className="input" style={{ fontSize: 15 }} />
                          </div>
                          <div><SubmitButton className="btn" pendingText="Sending…">Send request</SubmitButton></div>
                        </form>
                      </details>
                    ) : null}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="label" style={{ color: fit === 'Great fit' ? 'var(--accent)' : undefined, marginBottom: 14 }}>{fit}</div>
                    {openIds.has(m.id) ? <Link href="/mentors" className="meta">Request open</Link> : null}
                  </div>
                </li>
              ))}
            </ol>
          ) : null}
        </main>

        <aside className="aside">
          <div className="label" style={{ marginBottom: 12 }}>How matching works</div>
          <p className="body-copy" style={{ fontSize: 14, marginBottom: 40 }}>
            Overlap between your profile and what each mentor can help with. Not seniority or GPA.
          </p>
          <div className="label" style={{ marginBottom: 12 }}>Are you an alum?</div>
          <p className="body-copy" style={{ fontSize: 14, marginBottom: 12 }}>Set up a mentor profile in five minutes.</p>
          <Link href="/mentor/profile" className="link">Become a mentor</Link>
        </aside>
      </div>
    </>
  )
}
