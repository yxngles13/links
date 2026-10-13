// app/matches/page.tsx
import Link from 'next/link'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import AppNav from '@/components/AppNav'

function initials(name: string) {
  return name
    .replace(/^Dr\.?\s+/i, '')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

const LABEL_TEXT = { strong: 'Strong fit', moderate: 'Good fit', exploratory: 'Worth exploring' } as const

export default async function MatchesPage() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const {
    data: { user },
  } = await supabase.auth.getUser()

  let body: React.ReactNode

  if (!user) {
    body = <div className="l-card l-card-soft">Please <Link href="/login" style={{ fontWeight: 800 }}>sign in</Link> to see your matches.</div>
  } else {
    const { data: studentProfile } = await supabase
      .from('student_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (!studentProfile) {
      body = (
        <div className="l-card l-card-soft">
          <p className="l-body" style={{ margin: '0 0 14px' }}>You need a profile before we can find matches.</p>
          <Link href="/onboarding" className="l-btn l-btn-primary">Start onboarding</Link>
        </div>
      )
    } else {
      const { data: matches, error } = await supabase
        .from('match_recommendations')
        .select(
          `id, similarity_score, compatibility_label, explanation,
           opportunities ( professor_name, department, lab_name, research_areas )`
        )
        .eq('student_profile_id', studentProfile.id)
        .order('similarity_score', { ascending: false })

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
              </div>
            </div>

            {matches.map((m, i) => {
              const opp = m.opportunities as any
              const label = LABEL_TEXT[m.compatibility_label as keyof typeof LABEL_TEXT] ?? m.compatibility_label
              return (
                <Link
                  key={m.id}
                  href={`/matches/${m.id}`}
                  className={`l-card ${i === 0 ? 'l-card-tint' : 'l-card-soft'}`}
                  style={{ display: 'block' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', gap: 14 }}>
                      <div className="l-avatar">{initials(opp?.professor_name ?? '?')}</div>
                      <div>
                        <div style={{ fontSize: 17, fontWeight: 700 }}>{opp?.professor_name}</div>
                        <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--links-text-faint)' }}>
                          {opp?.department}{opp?.lab_name ? ` · ${opp.lab_name}` : ''}
                        </div>
                      </div>
                    </div>
                    <span className={`l-chip ${i === 0 ? '' : 'l-chip-strong'}`} style={i === 0 ? { background: '#fff', color: 'var(--links-secondary)' } : undefined}>
                      {label}
                    </span>
                  </div>

                  {m.explanation ? (
                    <p className="l-body l-clamp-3" style={{ margin: '16px 0 0', color: 'var(--links-text)' }}>{m.explanation}</p>
                  ) : null}

                  {opp?.research_areas?.length ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
                      {opp.research_areas.slice(0, 4).map((a: string) => (
                        <span key={a} className="l-chip" style={{ background: 'rgba(255,255,255,0.7)' }}>{a}</span>
                      ))}
                    </div>
                  ) : null}
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
            <div className="l-eyebrow" style={{ marginBottom: 10 }}>A note on matches</div>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: 'var(--links-on-dark-muted)' }}>
              Matches reflect overlap between your interests and skills and each lab&apos;s work. They are not a prediction of acceptance.
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}