// app/mentors/find/page.tsx
// Mentor matches for a student: accepting mentors ranked against the
// student's profile, each with an inline "Request a chat" form.
import Link from 'next/link'
import AppNav from '@/components/AppNav'
import MigrationNotice, { isMissingTable } from '@/components/MigrationNotice'
import SubmitButton from '@/components/SubmitButton'
import { requireUser } from '@/lib/auth'
import { initials } from '@/lib/format'
import { mentorSubtitle, rankMentorsForStudent } from '@/lib/mentors'
import { requestChat } from '../actions'

const FIT_CLASS: Record<string, string> = { 'Great fit': 'l-card-tint', 'Good fit': 'l-card-soft' }

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

  const { data: open } = missing
    ? { data: [] }
    : await supabase
        .from('mentorship_requests')
        .select('mentor_profile_id, status')
        .eq('student_user_id', user.id)
        .in('status', ['requested', 'accepted', 'scheduled'])
  const openIds = new Set((open ?? []).map((r) => r.mentor_profile_id))

  const { data: student } = await supabase.from('student_profiles').select('id').eq('user_id', user.id).maybeSingle()

  return (
    <div className="l-page">
      <AppNav active="mentors" />
      <div className="l-layout">
        <div className="l-main">
          <div>
            <Link href="/mentors" style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--links-text-faint)' }}>← Your mentors</Link>
            <h1 className="l-page-title" style={{ margin: '10px 0 6px' }}>Your mentor matches</h1>
            <p className="l-body" style={{ margin: 0, fontSize: 15 }}>Alumni and seniors whose path lines up with where you want to go.</p>
          </div>

          {error ? <div className="l-card l-card-soft" style={{ color: '#a01818', fontWeight: 600 }}>{error}</div> : null}
          {missing ? <MigrationNotice /> : null}
          {!missing && !student ? (
            <div className="l-card l-card-soft">
              <p className="l-body" style={{ margin: '0 0 12px' }}>Fill in your profile so we can rank mentors for you.</p>
              <Link href="/onboarding" className="l-btn l-btn-primary">Start onboarding</Link>
            </div>
          ) : null}
          {!missing && ranked.length === 0 ? (
            <div className="l-card l-card-soft"><p className="l-body" style={{ margin: 0 }}>No mentors are taking requests yet.</p></div>
          ) : null}

          {ranked.map(({ mentor: m, fit }) => (
            <article key={m.id} id={`m-${m.id}`} className={`l-card ${FIT_CLASS[fit] ?? ''}`} style={{ border: FIT_CLASS[fit] ? undefined : '1.5px solid var(--links-tint-3)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', gap: 14 }}>
                  <div className="l-avatar">{initials(m.full_name)}</div>
                  <div>
                    <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--links-secondary)' }}>{m.full_name}</h2>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: 'rgba(19,19,22,0.55)' }}>{mentorSubtitle(m)}</div>
                  </div>
                </div>
                <span className="l-chip l-chip-strong" style={{ flexShrink: 0 }}>{fit}</span>
              </div>

              {m.bio ? <p style={{ margin: '14px 0 0', fontSize: 14.5, fontWeight: 500, lineHeight: 1.6, color: 'rgba(19,19,22,0.8)' }}>{m.bio}</p> : null}

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
                {m.mentor_topics.map((t) => (
                  <span key={t} className="l-chip" style={{ background: 'rgba(255,255,255,0.65)', color: 'var(--links-secondary)' }}>{t}</span>
                ))}
              </div>

              {openIds.has(m.id) ? (
                <div style={{ marginTop: 14, fontSize: 13.5, fontWeight: 800, color: 'var(--links-text-faint)' }}>
                  Request open · <Link href="/mentors" className="l-link">see status</Link>
                </div>
              ) : (
                <details className="l-details" style={{ marginTop: 14 }}>
                  <summary className="l-link" style={{ fontSize: 14 }}>Request a chat →</summary>
                  <form action={requestChat} style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
                    <input type="hidden" name="mentor_profile_id" value={m.id} />
                    {m.mentor_topics.length ? (
                      <div className="l-field">
                        <label htmlFor={`topic-${m.id}`} className="l-label">Topic</label>
                        <select id={`topic-${m.id}`} name="topic" className="l-input l-input-sm" style={{ background: '#fff' }}>
                          {m.mentor_topics.map((t) => <option key={t}>{t}</option>)}
                        </select>
                      </div>
                    ) : null}
                    <div className="l-field">
                      <label htmlFor={`msg-${m.id}`} className="l-label">Message</label>
                      <textarea id={`msg-${m.id}`} name="message" rows={3} required placeholder="What would you like to talk about?" className="l-textarea l-input-sm" style={{ background: '#fff', resize: 'vertical' }} />
                    </div>
                    <SubmitButton pendingText="Sending…">Send request</SubmitButton>
                  </form>
                </details>
              )}
            </article>
          ))}
        </div>

        <aside className="l-side">
          <div className="l-card l-card-dark" style={{ borderRadius: 22, padding: 20 }}>
            <div className="l-eyebrow" style={{ marginBottom: 10 }}>How matching works</div>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: 'var(--links-on-dark-muted)' }}>
              Based on overlap between your profile and what each mentor says they can help with, not seniority or GPA.
            </p>
          </div>
          <div className="l-card l-card-tint" style={{ borderRadius: 22, padding: 20 }}>
            <div className="l-eyebrow" style={{ color: 'var(--links-secondary)', marginBottom: 6 }}>Are you an alum?</div>
            <p style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 600, color: 'var(--links-secondary)' }}>Set up a mentor profile in 5 minutes.</p>
            <Link href="/mentor/profile" className="l-link">Become a mentor →</Link>
          </div>
        </aside>
      </div>
    </div>
  )
}
