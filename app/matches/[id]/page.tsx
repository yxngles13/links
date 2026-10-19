// app/matches/[id]/page.tsx
import Link from 'next/link'
import { notFound } from 'next/navigation'
import AppNav from '@/components/AppNav'
import DraftEditor from '@/components/DraftEditor'
import SubmitButton from '@/components/SubmitButton'
import { requireUser } from '@/lib/auth'
import { logMatchInteraction, rewriteOutreachDraft, saveOutreachDraft, toggleSaved } from '../actions'

const LABEL_TEXT = { strong: 'Strong match', moderate: 'Good match', exploratory: 'Possible match' } as const

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
      <span style={{ fontSize: 15, color: accent ? 'var(--accent)' : undefined }}>{children}</span>
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
  const fit = (match.compatibility_label ?? 'exploratory') as keyof typeof LABEL_TEXT

  return (
    <>
      <AppNav active="research" />
      <div className="shell">
        <main className="main">
          <Link href="/matches" className="back">← All matches</Link>
          <div className="eyebrow accent" style={{ margin: '22px 0 10px' }}>
            {Math.round((match.similarity_score ?? 0) * 100)} · {LABEL_TEXT[fit]}
          </div>
          <h1 className="title-sm" style={{ marginBottom: 4 }}>{opp?.professor_name}</h1>
          <div className="meta" style={{ marginBottom: 28 }}>{[opp?.lab_name, opp?.department].filter(Boolean).join(' · ')}</div>

          {error ? <div className="alert" role="alert">{error}</div> : null}
          {match.explanation ? <p className="lead" style={{ marginBottom: 32 }}>{match.explanation}</p> : null}

          {match.suggested_questions?.length ? (
            <section className="measure" style={{ marginBottom: 32 }}>
              <h2 className="label" style={{ margin: '0 0 6px', fontWeight: 400 }}>Questions to ask</h2>
              <ol className="rows" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {match.suggested_questions.map((q: string, i: number) => (
                  <li key={i} className="row row-tight numbered"><span className="num">{i + 1}</span>{q}</li>
                ))}
              </ol>
            </section>
          ) : null}

          <section className="measure">
            <DraftEditor
              label="Outreach draft"
              text={match.outreach_draft ?? ''}
              idName="match_id"
              idValue={match.id}
              save={saveOutreachDraft}
              rewrite={rewriteOutreachDraft}
            />
          </section>
        </main>

        <aside className="aside">
          <div className="label" style={{ marginBottom: 8 }}>Quick facts</div>
          <div className="rows" style={{ marginBottom: 32 }}>
            {opp?.time_commitment_hours ? <Fact label="Time commitment">{opp.time_commitment_hours} hours a week</Fact> : null}
            {opp?.prerequisites ? <Fact label="Prerequisites">{opp.prerequisites}</Fact> : null}
            {opp?.preferred_contact_method ? <Fact label="Preferred contact">{opp.preferred_contact_method}</Fact> : null}
            <Fact label="Availability" accent={!!opp?.is_available}>{opp?.is_available ? 'Taking students' : 'Ask to confirm'}</Fact>
          </div>

          <form action={logMatchInteraction} className="form" style={{ gap: 14 }}>
            <input type="hidden" name="match_id" value={match.id} />
            <div className="label">Reached out?</div>
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

          <form action={toggleSaved} style={{ textAlign: 'center', marginTop: 20 }}>
            <input type="hidden" name="match_id" value={match.id} />
            <button type="submit" className="link">{match.saved_at ? 'Saved · remove' : 'Save for later'}</button>
          </form>
        </aside>
      </div>
    </>
  )
}
