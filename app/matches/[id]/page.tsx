// app/matches/[id]/page.tsx
import Link from 'next/link'
import { notFound } from 'next/navigation'
import DraftEditor from '@/components/DraftEditor'
import SubmitButton from '@/components/SubmitButton'
import { requireUser } from '@/lib/auth'
import { initials } from '@/lib/format'
import { displayScore } from '@/lib/similarity'
import { pastelFor, scoreTier } from '@/lib/theme'
import { logMatchInteraction, rewriteOutreachDraft, saveOutreachDraft, toggleSaved } from '../actions'

const TIER_TEXT = { strong: 'Strong match', good: 'Good match', possible: 'Possible match' } as const

type Opportunity = {
  professor_name: string
  department: string | null
  lab_name: string | null
  time_commitment_hours: number | null
  prerequisites: string | null
  preferred_contact_method: string | null
  is_available: boolean | null
}

function Fact({ label, children, accent }: { label: string; children: React.ReactNode; accent?: boolean }) {
  return (
    <div className="row row-tight fact">
      <span>{label}</span>
      <span style={{ fontSize: 15, color: accent ? 'var(--accent-ink)' : undefined }}>{children}</span>
    </div>
  )
}

export default async function MatchDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { id } = await params
  const { error } = await searchParams
  const { supabase } = await requireUser()

  // RLS restricts this to the signed-in student's matches. `*` so it keeps
  // working whether or not the saved_at migration has run.
  const { data: match } = await supabase
    .from('match_recommendations')
    .select(`*, opportunities ( professor_name, department, lab_name, time_commitment_hours, prerequisites, preferred_contact_method, is_available )`)
    .eq('id', id)
    .maybeSingle()

  if (!match) notFound()
  const opp = match.opportunities as Opportunity | null
  const tier = scoreTier(match.similarity_score ?? 0)
  const pastel = pastelFor(opp?.professor_name ?? '')

  return (
    <main className="page">
      <Link href="/matches" className="back">← All matches</Link>

      <div className="prof-detail">
        <div className="detail-stack">
          <section className="card">
            <div className="prof-detail-head">
              <span aria-hidden="true" className={`initials-tile initials-tile-lg initials-tile-${pastel}`}>{initials(opp?.professor_name ?? '')}</span>
              <div>
                <h1>{opp?.professor_name}</h1>
                <div className="meta" style={{ marginTop: 6 }}>{[opp?.lab_name, opp?.department].filter(Boolean).join(' · ')}</div>
              </div>
              <span className={`badge badge-score badge-${tier}`}>
                <span className="badge-num">{displayScore(match.similarity_score ?? 0)}</span>
                <span className="badge-tier">{tier}</span>
              </span>
            </div>
            <div className="eyebrow accent" style={{ marginBottom: 12 }}>{TIER_TEXT[tier]}</div>

            {error ? <div className="alert" role="alert" style={{ marginBottom: 18 }}>{error}</div> : null}
            {match.explanation ? <p className="lead">{match.explanation}</p> : null}
          </section>

          {match.suggested_questions?.length ? (
            <section className="card">
              <h2 className="label" style={{ margin: '0 0 12px' }}>Questions to ask</h2>
              <ol className="q-list">
                {match.suggested_questions.map((q: string, i: number) => (
                  <li key={i}><span className="q-num">{i + 1}</span><span>{q}</span></li>
                ))}
              </ol>
            </section>
          ) : null}

          <section className="card">
            <DraftEditor
              label="Outreach draft"
              text={match.outreach_draft ?? ''}
              idName="match_id"
              idValue={match.id}
              save={saveOutreachDraft}
              rewrite={rewriteOutreachDraft}
            />
          </section>
        </div>

        <aside className="detail-stack">
          <section className="card">
            <h2 className="label" style={{ marginBottom: 8 }}>Quick facts</h2>
            <div className="rows rows-flat">
              {opp?.time_commitment_hours ? <Fact label="Time commitment">{opp.time_commitment_hours} hours a week</Fact> : null}
              {opp?.prerequisites ? <Fact label="Prerequisites">{opp.prerequisites}</Fact> : null}
              {opp?.preferred_contact_method ? <Fact label="Preferred contact">{opp.preferred_contact_method}</Fact> : null}
              <Fact label="Availability" accent={!!opp?.is_available}>{opp?.is_available ? 'Taking students' : 'Ask to confirm'}</Fact>
            </div>
          </section>

          <section className="card card-lilac">
            <form action={logMatchInteraction} className="form" style={{ gap: 14 }}>
              <input type="hidden" name="match_id" value={match.id} />
              <h2 className="label">Reached out?</h2>
              <div className="field">
                <label htmlFor="interaction_type">How</label>
                <select id="interaction_type" name="interaction_type" className="input" defaultValue="Email">
                  <option>Email</option>
                  <option>Office hours</option>
                  <option>Meeting</option>
                  <option>Reply received</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="log-notes">What happened</label>
                <textarea id="log-notes" name="notes" rows={2} required placeholder="Sent the outreach email…" className="input" style={{ fontSize: 15 }} />
              </div>
              <SubmitButton className="btn btn-block" pendingText="Logging…">Log this interaction</SubmitButton>
              <p className="hint">Adds {opp?.professor_name} to your network with a follow-up draft.</p>
            </form>

            <form action={toggleSaved} style={{ textAlign: 'center', marginTop: 12 }}>
              <input type="hidden" name="match_id" value={match.id} />
              <button type="submit" className="link">{match.saved_at ? 'Saved · remove' : 'Save for later'}</button>
            </form>
          </section>
        </aside>
      </div>
    </main>
  )
}
