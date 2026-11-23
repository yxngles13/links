// app/professors/page.tsx
// Every professor, A–Z, for anyone signed in (no profile needed). Search
// and the department filter are plain GET params. Professors that are
// already one of the student's matches show the score or "You picked".
import Link from 'next/link'
import { requireUser } from '@/lib/auth'
import { departmentsOf, filterProfessors, type ProfessorRow } from '@/lib/professors'
import { initials } from '@/lib/format'
import { displayScore } from '@/lib/similarity'
import { pastelFor, scoreTier } from '@/lib/theme'

const TIER_LABEL = { strong: 'Strong', good: 'Good', possible: 'Possible' } as const

type MatchInfo = { score: number; picked: boolean }

function first(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v
}

export default async function ProfessorsPage({ searchParams }: { searchParams: Promise<{ q?: string | string[]; dept?: string | string[] }> }) {
  const params = await searchParams
  const q = first(params.q) ?? ''
  const dept = first(params.dept) ?? ''
  const { supabase, user } = await requireUser()

  const [{ data: rows, error }, { data: student }] = await Promise.all([
    supabase.from('opportunities').select('id, professor_name, department, lab_name, research_areas, is_available'),
    supabase.from('student_profiles').select('id').eq('user_id', user.id).maybeSingle(),
  ])

  // `*` so this keeps working before the picked_at migration has run.
  const { data: matches } = student
    ? await supabase.from('match_recommendations').select('*').eq('student_profile_id', student.id)
    : { data: [] }
  const matchFor = new Map<string, MatchInfo>(
    (matches ?? []).map((m) => [m.opportunity_id as string, { score: (m.similarity_score as number | null) ?? 0, picked: !!m.picked_at }])
  )

  const all = (rows ?? []) as ProfessorRow[]
  const shown = filterProfessors(all, { q, dept })
  const departments = departmentsOf(all)

  return (
    <main className="page">
      <div className="head-row">
        <div>
          <h1 className="title" style={{ marginBottom: 10 }}>Professors</h1>
          <div className="meta">{all.length} professor{all.length === 1 ? '' : 's'}. Pick anyone and we&apos;ll write you a draft.</div>
        </div>
        <form method="get" className="prof-tools">
          <label className="search" htmlFor="q">
            <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" strokeWidth="2.4" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
            <span className="sr-only">Search professors</span>
            <input id="q" name="q" type="search" defaultValue={q} placeholder="Search name or topic" />
          </label>
          {departments.length > 1 ? (
            <>
              <label htmlFor="dept" className="sr-only">Department</label>
              <select id="dept" name="dept" defaultValue={dept} className="input">
                <option value="">All departments</option>
                {departments.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </>
          ) : null}
          <button type="submit" className="btn btn-sm btn-outline">Search</button>
        </form>
      </div>

      {error ? <div className="alert">Could not load professors: {error.message}</div> : null}

      {!error && shown.length === 0 ? (
        <p className="body-copy">
          No professors match that search. <Link href="/professors" className="link">Show everyone</Link>
        </p>
      ) : (
        <ul className="prof-grid">
          {shown.map((p) => {
            const match = matchFor.get(p.id)
            const pastel = pastelFor(p.professor_name)
            const areaList = p.research_areas ?? []
            const extra = areaList.length - 3
            return (
              <li key={p.id}>
                <article className="card prof-card">
                  <div className="prof-top">
                    <span aria-hidden="true" className={`initials-tile initials-tile-${pastel}`}>{initials(p.professor_name)}</span>
                    <div>
                      <h2 className="prof-name"><Link href={`/professors/${p.id}`}>{p.professor_name}</Link></h2>
                      <p className="prof-sub">{[p.department, p.lab_name].filter(Boolean).join(' · ')}</p>
                    </div>
                  </div>
                  {areaList.length ? (
                    <div className="tags">
                      {areaList.slice(0, 3).map((a) => <span key={a} className={`tag tag-${pastel}`}>{a}</span>)}
                      {extra > 0 ? <span className="tag tag-lilac">+{extra}</span> : null}
                    </div>
                  ) : null}
                  <div className="prof-foot">
                    {match ? (
                      match.picked ? (
                        <span className="badge badge-picked">You picked</span>
                      ) : (
                        <span className={`badge badge-${scoreTier(match.score)}`}>{displayScore(match.score)} · {TIER_LABEL[scoreTier(match.score)]}</span>
                      )
                    ) : !p.is_available ? (
                      <span className="badge badge-ask">Ask to confirm</span>
                    ) : <span />}
                    <Link href={`/professors/${p.id}`} className="link">{match ? 'Open draft' : 'Write a draft'}<span className="sr-only"> for {p.professor_name}</span></Link>
                  </div>
                </article>
              </li>
            )
          })}
        </ul>
      )}

      <div className="banner-accent">
        <svg width="44" height="44" viewBox="0 0 44 44" aria-hidden="true"><circle cx="22" cy="22" r="20" fill="#fff" opacity="0.22" /><path d="M14 22h16M22 14v16" stroke="#fff" strokeWidth="3" strokeLinecap="round" /></svg>
        <div>
          <h2>Not sure who to pick?</h2>
          <p>Your Matches are ranked for your interests and skills.</p>
        </div>
        <Link href="/matches" className="btn-light">See my matches</Link>
      </div>
    </main>
  )
}
