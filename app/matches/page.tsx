// app/matches/page.tsx
import Link from 'next/link'
import { requireUser } from '@/lib/auth'
import { displayScore } from '@/lib/similarity'
import { pastelFor, scoreTier } from '@/lib/theme'


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
        <p className="body-copy" style={{ marginTop: 24 }}>
          <Link href="/professors" className="link">Or browse all professors →</Link>
        </p>
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
          <p className="body-copy" style={{ marginTop: 16 }}>
            <Link href="/professors" className="link">Or browse all professors →</Link>
          </p>
        </>
      )
    } else {
      const strong = matches.filter((m) => m.compatibility_label === 'strong').length
      body = (
        <>
          <h1 className="title" style={{ marginBottom: 10 }}>Your matches</h1>
          <div className="meta" style={{ marginBottom: 24 }}>
            {matches.length} professors · {strong} strong · {contactedIds.size} contacted
          </div>

          <ol className="rank-list">
            {matches.map((m, i) => {
              const opp = m.opportunities as Opportunity | null
              const name = opp?.professor_name ?? ''
              const tier = scoreTier(m.similarity_score ?? 0)
              return (
                <li key={m.id} className={`rank-card card-${pastelFor(name)}`}>
                  <span className="rank-num" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
                  <div className="rank-body">
                    <h2 className="rank-name"><Link href={`/matches/${m.id}`}>{name}</Link></h2>
                    <p className="rank-sub">{[opp?.department, opp?.lab_name].filter(Boolean).join(' · ')}</p>
                    {m.explanation ? <p className="rank-why">{m.explanation}</p> : null}
                    {m.picked_at || contactedIds.has(m.opportunity_id) || m.saved_at ? (
                      <div className="tags" style={{ marginTop: 10 }}>
                        {m.picked_at ? <span className="pill">You picked</span> : null}
                        {contactedIds.has(m.opportunity_id) ? <span className="pill">Contacted</span> : null}
                        {m.saved_at ? <span className="pill">Saved</span> : null}
                      </div>
                    ) : null}
                  </div>
                  {/* Display score, not raw cosine; see displayScore in lib/similarity.ts. */}
                  <span className={`badge badge-score badge-${tier}`}>
                    <span className="badge-num">{displayScore(m.similarity_score ?? 0)}</span>
                    <span className="badge-tier">{tier}</span>
                  </span>
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
      <div className="shell">
        <main className="main">{body}</main>
        <aside className="aside side-cards">
          <section className="card card-lilac">
            <h2 className="label" style={{ marginBottom: 8 }}>A note on scores</h2>
            <p className="body-copy" style={{ fontSize: 14 }}>
              Scores reflect overlap with your interests and skills. They are not a prediction of acceptance.
            </p>
          </section>
          <section className="card">
            <h2 className="label" style={{ marginBottom: 8 }}>Your network</h2>
            <Link href="/network" style={{ display: 'block', minHeight: 44 }}>
              <span className="num" style={{ fontSize: 44, lineHeight: 1, display: 'block', color: 'var(--accent-ink)' }}>{networkCount ?? 0}</span>
              <span className="meta" style={{ fontSize: 13 }}>connection{networkCount === 1 ? '' : 's'} started</span>
            </Link>
          </section>
        </aside>
      </div>
    </>
  )
}
