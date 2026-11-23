// app/dashboard/page.tsx
// Student home: getting-started steps for new users, what needs doing next
// (follow-ups), and one highlight per area linking into it.
import Link from 'next/link'
import AppNav from '@/components/AppNav'
import ExtensionCard from '@/components/ExtensionCard'
import ProfileReminder from '@/components/ProfileReminder'
import { displayName, requireUser } from '@/lib/auth'
import { gettingStartedSteps, greeting } from '@/lib/dashboard'
import { needsFollowUp, timeAgo } from '@/lib/format'
import { displayScore } from '@/lib/similarity'
import { pastelFor, scoreTier } from '@/lib/theme'
import { getPublicProfile } from '@/lib/student-profile'

type Match = {
  id: string
  opportunity_id: string
  similarity_score: number | null
  saved_at: string | null
  opportunities: { professor_name: string; department: string | null; lab_name: string | null } | null
}
type Contact = { id: string; full_name: string; role: string | null; company: string | null; last_interaction_at: string | null }

// Kept out of the component so "now" is read once per request, not during render.
function dueFollowUps(contacts: Contact[], now = Date.now()) {
  return contacts.filter((c) => needsFollowUp(c.last_interaction_at, now))
}

function Section({ title, href, cta, children }: { title: string; href: string; cta: string; children: React.ReactNode }) {
  return (
    <section className="card">
      <div className="card-head">
        <h2>{title}</h2>
        <Link href={href} className="link" style={{ fontSize: 13 }}>{cta} →</Link>
      </div>
      {children}
    </section>
  )
}

export default async function DashboardPage() {
  const { supabase, user } = await requireUser()

  const { data: student } = await supabase.from('student_profiles').select('id').eq('user_id', user.id).maybeSingle()

  // Every area is optional: a missing table or a new account just shows an
  // empty block instead of breaking home.
  const [{ profile }, matchesRes, contactedRes, contactsRes] = await Promise.all([
    getPublicProfile(supabase, user.id).catch(() => ({ profile: null })),
    student
      ? supabase
          .from('match_recommendations')
          .select('id, opportunity_id, similarity_score, saved_at, opportunities ( professor_name, department, lab_name )')
          .eq('student_profile_id', student.id)
          .order('similarity_score', { ascending: false })
      : Promise.resolve({ data: [] }),
    student ? supabase.from('interactions').select('opportunity_id').eq('student_profile_id', student.id) : Promise.resolve({ data: [] }),
    supabase.from('network_contacts').select('id, full_name, role, company, last_interaction_at').order('last_interaction_at', { ascending: true, nullsFirst: true }),
  ])

  const matches = (matchesRes.data ?? []) as unknown as Match[]
  const contactedIds = new Set((contactedRes.data ?? []).map((i: { opportunity_id: string }) => i.opportunity_id))
  const contacts = (contactsRes.data ?? []) as Contact[]

  const saved = matches.filter((m) => m.saved_at).length
  const dueContacts = dueFollowUps(contacts)

  const steps = gettingStartedSteps({
    hasAbout: !!(profile?.headline || profile?.prompts.length),
    hasAnswers: !!student,
    hasActedOnMatch: saved > 0 || contactedIds.size > 0,
    contacts: contacts.length,
    hasMatches: matches.length > 0,
  })
  const doneCount = steps.filter((s) => s.done).length
  const chromeUrl = process.env.NEXT_PUBLIC_CHROME_EXTENSION_URL
  const firstName = (profile?.full_name || displayName(user)).split(' ')[0]

  // "Up next": people waiting on a follow-up, longest wait first.
  const upNext = [
    ...dueContacts.slice(0, 3).map((c) => ({
      key: c.id,
      text: `Follow up with ${c.full_name}`,
      meta: c.last_interaction_at ? `Last talked ${timeAgo(c.last_interaction_at).toLowerCase()}` : 'No interactions logged yet',
      href: `/network/${c.id}`,
    })),
  ]

  return (
    <>
      <AppNav active="home" />
      <ProfileReminder />
      <main className="page" style={{ maxWidth: 1280 }}>
        {/* Hidden until NEXT_PUBLIC_CHROME_EXTENSION_URL is set to the Web Store listing. */}
        {chromeUrl ? <ExtensionCard storeUrl={chromeUrl} /> : null}

        <div className="home-grid">
          <div className="home-col">
            <div className="hero-card">
              <svg className="hero-star" viewBox="0 0 120 120" aria-hidden="true"><path d="M60 8l13 33 35 3-27 22 9 35-30-19-30 19 9-35L12 44l35-3z" fill="#fff" /></svg>
              <p className="hero-hello">{greeting()}</p>
              <h1>Hi, {firstName}!</h1>
              <p className="hero-lead">
                {upNext.length ? `${upNext.length} thing${upNext.length === 1 ? '' : 's'} need${upNext.length === 1 ? 's' : ''} you this week.` : 'Nothing urgent. A good day to reach out to someone new.'}
              </p>
            </div>

            {doneCount < steps.length ? (
              <section aria-labelledby="start-title" className="card">
                <div className="card-head" style={{ marginBottom: 12 }}>
                  <h2 id="start-title">Getting started</h2>
                  <span className="num" style={{ fontSize: 14 }}>{doneCount} of {steps.length} done</span>
                </div>
                <div className="progress" aria-hidden="true">
                  <div style={{ width: `${(doneCount / steps.length) * 100}%` }} />
                </div>
                <ol className="steps">
                  {steps.map((s, i) => (
                    <li key={s.key} className={s.done ? 'step step-done' : 'step'}>
                      <span className="step-dot">{s.done ? '✓' : i + 1}</span>
                      <div className="step-body">
                        <div className="step-title">{s.title}</div>
                        {!s.done ? <div className="step-why">{s.why}</div> : null}
                        {!s.done ? <Link href={s.href} className="btn btn-sm">{s.cta}</Link> : null}
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            ) : null}

            <div className="stats home-stats">
              <div className="stat-tile"><span className="stat-num">{matches.length}</span><span>matches</span></div>
              <div className="stat-tile"><span className="stat-num">{contacts.length}</span><span>in network</span></div>
              <div className="stat-tile"><span className={dueContacts.length ? 'stat-num accent' : 'stat-num'}>{dueContacts.length}</span><span>follow-ups due</span></div>
            </div>
          </div>

          <div className="home-col">
            <section className="card" aria-labelledby="top-title">
              <div className="card-head card-head-lg">
                <h2 id="top-title">Your top professors</h2>
                <Link href="/matches" className="link" style={{ fontSize: 13 }}>All matches →</Link>
              </div>
              {matches.length ? (
                <ul className="match-grid" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {matches.slice(0, 4).map((m) => {
                    const name = m.opportunities?.professor_name ?? ''
                    const tier = scoreTier(m.similarity_score ?? 0)
                    const sub = [m.opportunities?.lab_name ?? m.opportunities?.department, contactedIds.has(m.opportunity_id) && 'Contacted', m.saved_at && 'Saved'].filter(Boolean).join(' · ')
                    return (
                      <li key={m.id} className={`match-card card-${pastelFor(name)}`}>
                        <div className="match-top">
                          <div>
                            <h3 className="match-name"><Link href={`/matches/${m.id}`}>{name}</Link></h3>
                            {sub ? <p className="match-sub">{sub}</p> : null}
                          </div>
                          <span className={`badge badge-score badge-${tier}`}>
                            <span className="badge-num">{displayScore(m.similarity_score ?? 0)}</span>
                            <span className="badge-tier">{tier}</span>
                          </span>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <p className="body-copy" style={{ fontSize: 14 }}>
                  {student ? 'No matches yet.' : 'Answer a few questions and your professor matches show up here.'}{' '}
                  <Link href="/professors" className="link">Browse all professors</Link>
                </p>
              )}
            </section>

            <Section title="Up next" href="/follow-ups" cta="Follow-ups">
              {upNext.length ? (
                <ul className="rows rows-flat" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {upNext.map((u) => (
                    <li key={u.key}>
                      <Link href={u.href} className="row row-tight" style={{ display: 'block' }}>
                        <div style={{ fontSize: 15, fontWeight: 700 }}>{u.text}</div>
                        {u.meta ? <div style={{ fontSize: 13, color: 'var(--muted)' }}>{u.meta}</div> : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="body-copy" style={{ fontSize: 14 }}>No follow-ups waiting.</p>
              )}
            </Section>

            <Section title="Network" href="/network" cta="All contacts">
              {contacts.length ? (
                <ul className="rows rows-flat" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {[...contacts].reverse().slice(0, 3).map((c) => (
                    <li key={c.id}>
                      <Link href={`/network/${c.id}`} className="row row-tight row-split">
                        <span style={{ minWidth: 0 }}>
                          <span style={{ display: 'block', fontSize: 15, fontWeight: 700 }}>{c.full_name}</span>
                          <span style={{ fontSize: 13, color: 'var(--muted)' }}>{[c.role, c.company].filter(Boolean).join(' · ')}</span>
                        </span>
                        <span className="num">{timeAgo(c.last_interaction_at)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="body-copy" style={{ fontSize: 14 }}>Met someone at a career fair or on LinkedIn? Add them and we&apos;ll remind you to follow up.</p>
              )}
            </Section>
          </div>
        </div>
      </main>
    </>
  )
}
