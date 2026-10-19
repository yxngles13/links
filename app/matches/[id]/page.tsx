// app/matches/[id]/page.tsx
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import AppNav from '@/components/AppNav'
import CopyButton from '@/components/CopyButton'
import SubmitButton from '@/components/SubmitButton'
import { logMatchInteraction, toggleSaved } from '../actions'

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--links-on-dark-muted)', marginBottom: 3, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 14.5, fontWeight: 600 }}>{value}</div>
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
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  // Row Level Security already restricts this to the signed-in student's matches.
  // `*` so this keeps working whether or not the saved_at migration has run.
  const { data: match } = await supabase
    .from('match_recommendations')
    .select(
      `*,
       opportunities ( professor_name, department, lab_name, project_description,
                       time_commitment_hours, prerequisites, preferred_contact_method, is_available )`
    )
    .eq('id', id)
    .single()

  if (!match) notFound()
  const opp = match.opportunities as {
    professor_name: string
    department: string | null
    lab_name: string | null
    project_description: string | null
    time_commitment_hours: number | null
    prerequisites: string | null
    preferred_contact_method: string | null
    is_available: boolean | null
  } | null

  return (
    <div className="l-page">
      <AppNav active="research" />
      <div className="l-layout">
        <div className="l-main">
          <div>
            <Link href="/matches" style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--links-text-faint)' }}>← All matches</Link>
            <h1 className="l-page-title" style={{ margin: '10px 0 4px' }}>{opp?.professor_name}</h1>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--links-text-faint)' }}>
              {opp?.department}{opp?.lab_name ? ` · ${opp.lab_name}` : ''}
            </div>
          </div>

          {error ? <div className="l-card l-card-soft" style={{ color: '#a01818', fontWeight: 600 }}>{error}</div> : null}

          {match.explanation ? (
            <div className="l-card l-card-tint" style={{ borderRadius: 22 }}>
              <div className="l-eyebrow" style={{ color: 'var(--links-secondary)', marginBottom: 10 }}>Briefing</div>
              <p style={{ margin: 0, fontSize: 15.5, lineHeight: 1.7 }}>{match.explanation}</p>
            </div>
          ) : null}

          {match.suggested_questions?.length ? (
            <div>
              <div className="l-eyebrow" style={{ marginBottom: 10 }}>Questions to ask</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {match.suggested_questions.map((q: string, i: number) => (
                  <div key={i} className="l-card l-card-soft" style={{ borderRadius: 16, padding: '15px 18px', fontSize: 14.5, fontWeight: 600, lineHeight: 1.5 }}>{q}</div>
                ))}
              </div>
            </div>
          ) : null}

          {match.outreach_draft ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div className="l-eyebrow">Outreach draft</div>
                <CopyButton text={match.outreach_draft} />
              </div>
              <div className="l-card l-card-soft" style={{ borderRadius: 20, padding: 20, fontSize: 14.5, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                {match.outreach_draft}
              </div>
            </div>
          ) : null}
        </div>

        <aside className="l-side">
          <div className="l-card l-card-dark" style={{ borderRadius: 22, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="l-eyebrow">Quick facts</div>
            <Fact label="Department" value={opp?.department ?? 'n/a'} />
            {opp?.time_commitment_hours ? <Fact label="Time commitment" value={`${opp.time_commitment_hours} hrs / week`} /> : null}
            {opp?.prerequisites ? <Fact label="Prerequisites" value={opp.prerequisites} /> : null}
            {opp?.preferred_contact_method ? <Fact label="Preferred contact" value={opp.preferred_contact_method} /> : null}
            <Fact label="Available" value={opp?.is_available ? 'Yes' : 'Not currently'} />
          </div>

          <form action={logMatchInteraction} className="l-card l-card-soft" style={{ borderRadius: 22, padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input type="hidden" name="match_id" value={match.id} />
            <label htmlFor="log-notes" className="l-label">Reached out?</label>
            <select name="interaction_type" aria-label="How you reached out" className="l-input l-input-sm" style={{ background: '#fff' }} defaultValue="Email">
              <option>Email</option>
              <option>Office hours</option>
              <option>Meeting</option>
              <option>Reply received</option>
            </select>
            <textarea id="log-notes" name="notes" rows={3} required placeholder="Sent the outreach email, asked about the fall project…" className="l-textarea l-input-sm" style={{ background: '#fff', resize: 'vertical' }} />
            <SubmitButton pendingText="Logging…">Log this interaction</SubmitButton>
            <p className="l-hint" style={{ fontSize: 12 }}>Adds {opp?.professor_name} to your network with a follow-up draft.</p>
          </form>

          <form action={toggleSaved}>
            <input type="hidden" name="match_id" value={match.id} />
            <button type="submit" className="l-btn l-btn-white" style={{ width: '100%', height: 50, border: '1.5px solid var(--links-tint-3)' }}>
              {match.saved_at ? 'Saved · remove' : 'Save for later'}
            </button>
          </form>
        </aside>
      </div>
    </div>
  )
}