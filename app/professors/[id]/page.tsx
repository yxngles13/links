// app/professors/[id]/page.tsx
// One professor, as anyone signed in sees it. If they're already one of
// the student's matches this links to that draft; otherwise "Write me a
// draft" makes them a match (needs the student's profile answers).
import Link from 'next/link'
import { notFound } from 'next/navigation'
import SubmitButton from '@/components/SubmitButton'
import { requireUser } from '@/lib/auth'
import { initials } from '@/lib/format'
import { pastelFor } from '@/lib/theme'
import { writeDraft } from '../actions'

type Opportunity = {
  id: string
  professor_name: string
  department: string | null
  lab_name: string | null
  project_description: string | null
  research_areas: string[] | null
  desired_skills: string[] | null
  prerequisites: string | null
  time_commitment_hours: number | null
  preferred_contact_method: string | null
  is_available: boolean | null
  public_resources: string[] | null
}

function Fact({ label, children, accent }: { label: string; children: React.ReactNode; accent?: boolean }) {
  return (
    <div className="row row-tight fact">
      <span>{label}</span>
      <span style={{ fontSize: 15, color: accent ? 'var(--accent-ink)' : undefined }}>{children}</span>
    </div>
  )
}

export default async function ProfessorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { id } = await params
  const { error } = await searchParams
  // Malformed ids would make Postgres throw on the uuid cast.
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const { supabase, user } = await requireUser()

  const [{ data }, { data: student }] = await Promise.all([
    supabase.from('opportunities').select('*').eq('id', id).maybeSingle(),
    supabase.from('student_profiles').select('id').eq('user_id', user.id).maybeSingle(),
  ])
  if (!data) notFound()
  const opp = data as Opportunity

  const { data: match } = student
    ? await supabase.from('match_recommendations').select('id').eq('student_profile_id', student.id).eq('opportunity_id', id).maybeSingle()
    : { data: null }

  const pastel = pastelFor(opp.professor_name)

  return (
    <main className="page">
      <Link href="/professors" className="back">← All professors</Link>

      <div className="prof-detail">
        <section className="card">
          <div className="prof-detail-head">
            <span aria-hidden="true" className={`initials-tile initials-tile-lg initials-tile-${pastel}`}>{initials(opp.professor_name)}</span>
            <div>
              <h1>{opp.professor_name}</h1>
              <div className="meta" style={{ marginTop: 6 }}>{[opp.department, opp.lab_name].filter(Boolean).join(' · ')}</div>
            </div>
          </div>

          {opp.research_areas?.length ? (
            <div className="tags" style={{ marginBottom: 18 }}>
              {opp.research_areas.map((a) => <span key={a} className={`tag tag-${pastel}`}>{a}</span>)}
            </div>
          ) : null}

          {error ? <div className="alert" role="alert" style={{ marginBottom: 18 }}>{error}</div> : null}
          {opp.project_description ? <p className="lead" style={{ marginBottom: 24 }}>{opp.project_description}</p> : null}

          {match ? (
            <Link href={`/matches/${match.id}`} className="btn btn-lg btn-accent">Open your draft →</Link>
          ) : student ? (
            <form action={writeDraft}>
              <input type="hidden" name="opportunity_id" value={opp.id} />
              <SubmitButton pendingText="Writing your draft…" className="btn btn-lg btn-accent">Write me a draft</SubmitButton>
            </form>
          ) : (
            <p className="body-copy">
              Your draft is written from your answers. Set up your profile first.{' '}
              <Link href="/profile#matching" className="link">Set up your profile</Link>
            </p>
          )}
        </section>

        <aside className="card">
          <h2 className="label" style={{ marginBottom: 8 }}>Quick facts</h2>
          <div className="rows">
            {opp.desired_skills?.length ? <Fact label="Desired skills">{opp.desired_skills.join(', ')}</Fact> : null}
            {opp.prerequisites ? <Fact label="Prerequisites">{opp.prerequisites}</Fact> : null}
            {opp.time_commitment_hours ? <Fact label="Time commitment">{opp.time_commitment_hours} hours a week</Fact> : null}
            {opp.preferred_contact_method ? <Fact label="Preferred contact">{opp.preferred_contact_method}</Fact> : null}
            <Fact label="Availability" accent={!!opp.is_available}>{opp.is_available ? 'Taking students' : 'Ask to confirm'}</Fact>
            {opp.public_resources?.length ? (
              <Fact label="Links">
                {opp.public_resources.map((url) => (
                  <a key={url} href={url} target="_blank" rel="noreferrer" className="link" style={{ display: 'block', overflowWrap: 'anywhere' }}>
                    {url.replace(/^https?:\/\/(www\.)?/, '')}
                  </a>
                ))}
              </Fact>
            ) : null}
          </div>
        </aside>
      </div>
    </main>
  )
}
