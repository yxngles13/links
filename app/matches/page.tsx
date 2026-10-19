// app/matches/page.tsx
import Link from 'next/link'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import AppNav from '@/components/AppNav'
import { initials } from '@/lib/format'

const LABEL_TEXT = { strong: 'Strong fit', moderate: 'Good fit', exploratory: 'Worth exploring' } as const

// Card colour by fit, matching the canvas: strongest match tinted, others
// soft or plain.
const CARD_CLASS = { strong: 'l-card-tint', moderate: 'l-card-soft', exploratory: '' } as const

export default async function MatchesPage() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const {
    data: { user },
  } = await supabase.auth.getUser()

  let body: React.ReactNode
  let networkCount = 0

  if (!user) {
    body = <div className="l-card l-card-soft">Please <Link href="/login" style={{ fontWeight: 800 }}>sign in</Link> to see your matches.</div>
  } else {
    const { data: studentProfile } = await supabase
      .from('student_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single()

    const { count } = await supabase.from('network_contacts').select('id', { count: 'exact', head: true })
    networkCount = count ?? 0

    if (!studentProfile) {
      body = (
        <div className="l-card l-card-soft">
          <p className="l-body" style={{ margin: '0 0 14px' }}>You need a profile before we can find matches.</p>
          <Link href="/onboarding" className="l-btn l-btn-primary">Start onboarding</Link>
        </div>
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
        body = <div className="l-card l-card-soft">Could not load matches: {error.message}</div>
      } else if (!matches || matches.length === 0) {
        body = <div className="l-card l-card-soft">No matches yet. <Link href="/onboarding" style={{ fontWeight: 800 }}>Update your profile</Link> to generate some.</div>
      } else {
        const strong = matches.filter((m) => m.compatibility_label === 'strong').length
        body = (
          <>
            <div>
              <h1 className="l-page-title" style={{ margin: '0 0 12px' }}>Your matches</h1>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <span className="l-chip l-chip-strong">{matches.length} professors</span>
                <span className="l-chip">{strong} strong</span>
                <span className="l-chip l-chip-neutral">{contactedIds.size} contacted</span>
              </div>
            </div>

            {matches.map((m) => {
              const opp = m.opportunities as { professor_name: string; department: string | null; lab_name: string | null; research_areas: string[] | null } | null
              const fit = (m.compatibility_label ?? 'exploratory') as keyof typeof LABEL_TEXT
              const scoreColor = fit === 'strong' ? 'var(--links-secondary)' : fit === 'moderate' ? 'var(--links-primary-hover)' : 'rgba(19,19,22,0.45)'
              return (
                <Link key={m.id} href={`/matches/${m.id}`} className={`l-card ${CARD_CLASS[fit] ?? ''}`} style={{ display: 'block', border: fit === 'exploratory' ? '1.5px solid var(--links-tint-3)' : undefined }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', gap: 14 }}>
                      <div className="l-avatar">{initials(opp?.professor_name)}</div>
                      <div>
                        <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--links-secondary)' }}>{opp?.professor_name}</div>
                        <div style={{ fontSize: 13.5, fontWeight: 600, color: 'rgba(19,19,22,0.55)' }}>
                          {opp?.department}{opp?.lab_name ? ` · ${opp.lab_name}` : ''}
                        </div>
                      </div>
                    </div>
                    <div style={{ flexShrink: 0, textAlign: 'right', color: scoreColor }}>
                      {/* Raw cosine similarity as a 0–100 number. Not calibrated:
                          see the note in the sidebar. */}
                      <div className="l-score">{Math.round((m.similarity_score ?? 0) * 100)}</div>
                      <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{LABEL_TEXT[fit] ?? 'match score'}</div>
                    </div>
                  </div>

                  {m.explanation ? (
                    <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start', marginTop: 16 }}>
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={scoreColor} strokeWidth="3" aria-hidden="true" style={{ flexShrink: 0, marginTop: 3 }}>
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                      <p className="l-clamp-3" style={{ margin: 0, fontSize: 14.5, fontWeight: 500, lineHeight: 1.6, color: 'rgba(19,19,22,0.8)' }}>{m.explanation}</p>
                    </div>
                  ) : null}

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
                    {(opp?.research_areas ?? []).slice(0, 3).map((a) => (
                      <span key={a} className="l-chip" style={{ background: 'rgba(255,255,255,0.65)', color: 'var(--links-secondary)' }}>{a}</span>
                    ))}
                    {contactedIds.has(m.opportunity_id) ? <span className="l-chip l-chip-neutral">Contacted</span> : null}
                    {m.saved_at ? <span className="l-chip l-chip-neutral">Saved</span> : null}
                  </div>
                </Link>
              )
            })}
          </>
        )
      }
    }
  }

  return (
    <div className="l-page">
      <AppNav active="research" />
      <div className="l-layout">
        <div className="l-main">{body}</div>
        <aside className="l-side">
          <div className="l-card l-card-dark" style={{ borderRadius: 22, padding: 20 }}>
            <div className="l-eyebrow" style={{ marginBottom: 10 }}>A note on scores</div>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: 'var(--links-on-dark-muted)' }}>
              Scores reflect overlap between your interests and skills and each lab&apos;s work. They are not a prediction of acceptance.
            </p>
          </div>
          <Link href="/network" className="l-card" style={{ borderRadius: 22, padding: 20, background: 'var(--links-tint-3)', display: 'block' }}>
            <div className="l-eyebrow" style={{ color: '#4b5578', marginBottom: 10 }}>Your network</div>
            <div className="l-display" style={{ fontSize: 26, color: '#4b5578' }}>{networkCount}</div>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: 'rgba(19,19,22,0.55)' }}>connection{networkCount === 1 ? '' : 's'} started</div>
          </Link>
        </aside>
      </div>
    </div>
  )
}
