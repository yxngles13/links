// app/professors/page.tsx
// Every professor, A–Z, for anyone signed in (no profile needed). Search
// and the department filter are plain GET params. Professors that are
// already one of the student's matches show the score or "You picked".
import Link from 'next/link'
import { requireUser } from '@/lib/auth'
import { departmentsOf, filterProfessors, type ProfessorRow } from '@/lib/professors'
import { displayScore } from '@/lib/similarity'

const AREAS_PREVIEW = 120

type MatchInfo = { score: number; picked: boolean }

function first(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v
}

function areas(list: string[] | null) {
  const text = (list ?? []).join(', ')
  return text.length > AREAS_PREVIEW ? `${text.slice(0, AREAS_PREVIEW).trimEnd()}…` : text
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
          <div className="meta">{all.length} professor{all.length === 1 ? '' : 's'}</div>
        </div>
        <form method="get" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 16 }}>
          <label htmlFor="q" className="sr-only">Search professors</label>
          <input id="q" name="q" type="search" defaultValue={q} placeholder="Search name or topic" className="input" style={{ fontSize: 14, minWidth: 220 }} />
          {departments.length > 1 ? (
            <>
              <label htmlFor="dept" className="sr-only">Department</label>
              <select id="dept" name="dept" defaultValue={dept} className="input" style={{ fontSize: 14 }}>
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
        <ul className="rows measure" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {shown.map((p) => {
            const match = matchFor.get(p.id)
            return (
              <li key={p.id}>
                <Link href={`/professors/${p.id}`} className="row row-split" style={{ alignItems: 'flex-start', gap: 24 }}>
                  <span style={{ minWidth: 0 }}>
                    <span className="name-sm" style={{ display: 'block' }}>{p.professor_name}</span>
                    <span style={{ display: 'block', fontSize: 13, color: 'var(--muted)' }}>{[p.department, p.lab_name].filter(Boolean).join(' · ')}</span>
                    {p.research_areas?.length ? <span className="body-copy" style={{ display: 'block', fontSize: 14, marginTop: 6 }}>{areas(p.research_areas)}</span> : null}
                    {!p.is_available ? <span style={{ display: 'block', fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>Ask to confirm availability</span> : null}
                  </span>
                  {match ? (
                    match.picked ? (
                      <span className="label" style={{ flexShrink: 0, color: 'var(--accent)' }}>You picked</span>
                    ) : (
                      <span style={{ textAlign: 'right', flexShrink: 0 }}>
                        <span className="serif" style={{ display: 'block', fontSize: 28, lineHeight: 1 }}>{displayScore(match.score)}</span>
                        <span className="label">Match</span>
                      </span>
                    )
                  ) : null}
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </main>
  )
}
