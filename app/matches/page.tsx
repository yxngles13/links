// app/matches/page.tsx
import Link from 'next/link'
import AppNav from '@/components/AppNav'
import ProfileReminder from '@/components/ProfileReminder'
import { requireUser } from '@/lib/auth'

const LABEL_TEXT = { strong: 'Strong', moderate: 'Good', exploratory: 'Possible' } as const

type Opportunity = { professor_name: string; department: string | null; lab_name: string | null; research_areas: string[] | null }

export default async function MatchesPage() {
  const { supabase, user } = await requireUser()

  const [{ data: studentProfile }, { count: networkCount }] = await Promise.all([
    supabase.from('student_profiles').select('id').eq('user_id', user.id).maybeSingle(),
    supabase.from('network_contacts').select('id', { count: 'exact', head: true }),
  ])

  let body: React.ReactNode
  if (!studentProfile) {
    body = (
      <>
        <h1 className="title" style={{ marginBottom: 16 }}>Your matches</h1>
        <p className="body-copy" style={{ marginBottom: 24 }}>You need a profile before we can find matches.</p>
        <Link href="/profile#matching" className="btn btn-lg">Set up your profile</Link>
      </>
    )
  } else {
    // `*` so this keeps working whether or not the saved_at migration has run.
    const [{ data: matches, error }, { data: contacted }] = await Promise.all([
      supabase
        .from('match_recommendations')
        .select(`*, opportunities ( professor_name, department, lab_name, research_areas )`)
        .eq('student_profile_id', studentProfile.id)
        .order('similarity_score', { ascending: false }),
      supabase.from('interactions').select('opportunity_id').eq('student_profile_id', studentProfile.id),
    ])
    const contactedIds = new Set((contacted ?? []).map((i) => i.opportunity_id))

    if (error) {
      body = <div className="alert">Could not load matches: {error.message}</div>
    } else if (!matches?.length) {
      body = (
        <>
          <h1 className="title" style={{ marginBottom: 16 }}>Your matches</h1>
          <p className="body-copy">
            No matches yet. <Link href="/profile#matching" className="link">Update your profile</Link> to generate some.
          </p>
        </>
      )
    } else {
      const strong = matches.filter((m) => m.compatibility_label === 'strong').length
      body = (
        <>
          <h1 className="title" style={{ marginBottom: 10 }}>Your matches</h1>
          <div className="meta" style={{ marginBottom: 32 }}>
            {matches.length} professors · {strong} strong · {contactedIds.size} contacted
          </div>

          <ol className="rows" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {matches.map((m, i) => {
              const opp = m.opportunities as Opportunity | null
              const fit = (m.compatibility_label ?? 'exploratory') as keyof typeof LABEL_TEXT
              const tags = [contactedIds.has(m.opportunity_id) && 'Contacted', m.saved_at && 'Saved'].filter(Boolean).join(' · ')
              return (
                <li key={m.id}>
                  <Link href={`/matches/${m.id}`} className="row" style={{ display: 'flex', gap: 28, padding: '26px 0' }}>
                    <span className="num" style={{ width: 24, paddingTop: 8 }}>{String(i + 1).padStart(2, '0')}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="name" style={{ color: fit === 'exploratory' ? '#444' : undefined }}>{opp?.professor_name}</div>
                      <div style={{ fontSize: 13.5, color: 'var(--muted)', margin: '2px 0 12px' }}>
                        {[opp?.department, opp?.lab_name].filter(Boolean).join(' · ')}
                      </div>
                      {m.explanation ? <p className="body-copy" style={{ color: 'var(--text-2)', maxWidth: 560 }}>{m.explanation}</p> : null}
                      {tags ? <div className="num" style={{ marginTop: 10 }}>{tags}</div> : null}
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      {/* Raw cosine similarity as 0–100; see the note on scores. */}
                      <div className="serif" style={{ fontSize: 44, lineHeight: 1, color: i === 0 ? 'var(--accent)' : fit === 'exploratory' ? '#888' : undefined }}>
                        {Math.round((m.similarity_score ?? 0) * 100)}
                      </div>
                      <div className="label" style={{ marginTop: 6 }}>{LABEL_TEXT[fit] ?? 'Match'}</div>
                    </div>
                  </Link>
                </li>
              )
            })}
          </ol>
        </>
      )
    }
  }

  return (
    <>
      <AppNav active="research" />
      <ProfileReminder />
      <div className="shell">
        <main className="main">{body}</main>
        <aside className="aside">
          <div className="label" style={{ marginBottom: 12 }}>A note on scores</div>
          <p className="body-copy" style={{ fontSize: 14, marginBottom: 40 }}>
            Scores reflect overlap with your interests and skills. They are not a prediction of acceptance.
          </p>
          <div className="label" style={{ marginBottom: 8 }}>Your network</div>
          <Link href="/network" style={{ display: 'block' }}>
            <span className="serif" style={{ fontSize: 44, lineHeight: 1, display: 'block' }}>{networkCount ?? 0}</span>
            <span className="meta" style={{ fontSize: 13 }}>connection{networkCount === 1 ? '' : 's'} started</span>
          </Link>
        </aside>
      </div>
    </>
  )
}
