// app/matches/[id]/page.tsx
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import AppNav from '@/components/AppNav'
import CopyButton from '@/components/CopyButton'

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--links-on-dark-muted)', marginBottom: 3, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 14.5, fontWeight: 600 }}>{value}</div>
    </div>
  )
}

export default async function MatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  // Row Level Security already restricts this to the signed-in student's matches.
  const { data: match } = await supabase
    .from('match_recommendations')
    .select(
      `id, explanation, suggested_questions, outreach_draft,
       opportunities ( professor_name, department, lab_name, project_description,
                       time_commitment_hours, prerequisites, preferred_contact_method, is_available )`
    )
    .eq('id', id)
    .single()

  if (!match) notFound()
  const opp = match.opportunities as any

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

          {match.explanation ? (
            <div className="l-card l-card-tint" style={{ borderRadius: 22 }}>
              <div className="l-eyebrow" style={{ color: 'var(--links-secondary)', marginBottom: 10 }}>Why this match</div>
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
        </aside>
      </div>
    </div>
  )
}