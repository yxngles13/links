// app/page.tsx  (the landing page at "/")
import Link from 'next/link'

function Logo({ size = 28 }: { size?: number }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <span style={{ width: size + 16, height: size + 16, borderRadius: '50%', background: '#EEF2FD', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width={size - 4} height={size - 4} viewBox="0 0 26 26" fill="none" aria-hidden="true">
          <rect x="2" y="9" width="14" height="8" rx="4" transform="rotate(-30 9 13)" stroke="#4F7BF7" strokeWidth="2.6" />
          <rect x="10" y="9" width="14" height="8" rx="4" transform="rotate(-30 17 13)" stroke="#2B3A9E" strokeWidth="2.6" />
        </svg>
      </span>
      <span className="l-display" style={{ fontSize: size }}>Links</span>
    </span>
  )
}

const row = { background: '#fff', borderRadius: 14, padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 } as const
const avatar = { width: 34, height: 34, borderRadius: 11, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, fontFamily: 'var(--links-font-display)' } as const
const preview = { flexGrow: 1, minHeight: 190, borderRadius: 18, background: '#F1F4FD', padding: 18, display: 'flex', flexDirection: 'column', gap: 10, justifyContent: 'center' } as const

export default function LandingPage() {
  return (
    <main>
      {/* Hero */}
      <div className="l-hero" style={{ padding: 'clamp(12px, 2.5vw, 40px) clamp(12px, 4vw, 56px) clamp(40px, 6vw, 72px)' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <nav className="l-nav l-nav-light" style={{ padding: '10px clamp(16px, 2.5vw, 32px)' }}>
            <Logo />
            <div style={{ display: 'flex', gap: 'clamp(16px, 3vw, 48px)', alignItems: 'center' }}>
              <a href="#features">Research</a>
              <a href="#features">Network</a>
              <a href="#features">Mentors</a>
              <Link href="/login" className="l-btn l-btn-dark" style={{ height: 40, padding: '0 20px' }}>Sign in</Link>
            </div>
          </nav>

          <div className="l-center" style={{ paddingTop: 'clamp(40px, 7vw, 88px)' }}>
            <span className="l-eyebrow-pill">Networking Simplified</span>
            <h1 className="l-hero-title" style={{ marginBottom: 'clamp(24px, 3vw, 36px)' }}>
              Career Copilot for <span className="l-accent">Research</span>, <span className="l-accent">Networking</span>, and <span className="l-accent">Mentors</span>.
            </h1>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 14, flexWrap: 'wrap' }}>
              {/* Mentor sign-in goes to the same page until mentor accounts exist */}
              <Link href="/login" className="l-btn l-btn-dark" style={{ borderRadius: 16, height: 52 }}>Mentor Login</Link>
              <Link href="/login?mode=signup" className="l-btn l-btn-white" style={{ borderRadius: 16, height: 52 }}>Student Login</Link>
            </div>
          </div>

          {/* Feature cards */}
          <div id="features" className="l-grid" style={{ marginTop: 'clamp(40px, 6vw, 72px)' }}>
            <div className="l-card" style={{ borderRadius: 28, display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div style={preview}>
                <div style={row}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ ...avatar, background: '#2B3A9E', color: '#fff' }}>MR</span>
                    <span><div style={{ fontSize: 13, fontWeight: 700 }}>Dr. Maya Reyes</div><div style={{ fontSize: 11, fontWeight: 600, color: 'var(--links-text-faint)' }}>Applied Perception Lab</div></span>
                  </span>
                  <span className="l-chip l-chip-strong">Strong fit</span>
                </div>
                <div style={{ ...row, opacity: 0.8 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ ...avatar, background: '#DCE6FF', color: '#2B3A9E' }}>AP</span>
                    <span><div style={{ fontSize: 13, fontWeight: 700 }}>Dr. Anita Patel</div><div style={{ fontSize: 11, fontWeight: 600, color: 'var(--links-text-faint)' }}>Human-Centered AI Lab</div></span>
                  </span>
                  <span className="l-chip">Good fit</span>
                </div>
              </div>
              <div>
                <div className="l-h3" style={{ marginBottom: 6 }}>Research matching</div>
                <div className="l-body">Ranks real CPP professors by overlap with your interests, with a clear explanation for each.</div>
              </div>
            </div>

            <div className="l-card" style={{ borderRadius: 28, display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div style={preview}>
                {[['Priya Nair', 'LinkedIn', 'Active', 'l-chip-strong'], ['Marcus Webb', 'Career fair', 'Follow up', 'l-chip-neutral'], ['Elena Ruiz', 'Club event', 'New', '']].map(([n, s, st, c]) => (
                  <div key={n} style={row}>
                    <span style={{ fontSize: 13, fontWeight: 700, flex: 1 }}>{n}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--links-text-faint)', flex: 1 }}>{s}</span>
                    <span className={`l-chip ${c}`} style={{ height: 24, padding: '0 10px', fontSize: 11 }}>{st}</span>
                  </div>
                ))}
              </div>
              <div>
                <div className="l-h3" style={{ marginBottom: 6 }}>Network tracker</div>
                <div className="l-body">Log every conversation, get prep questions, and never miss a follow-up.</div>
              </div>
            </div>

            <div className="l-card" style={{ borderRadius: 28, display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div style={preview}>
                <div style={{ background: '#2B3A9E', borderRadius: 16, padding: 16, color: '#fff' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ ...avatar, background: '#fff', color: '#2B3A9E' }}>JA</span>
                      <span><div style={{ fontSize: 13, fontWeight: 700 }}>Jordan Alvarez</div><div style={{ fontSize: 11, opacity: 0.7 }}>CPP &apos;23 · Datadog</div></span>
                    </span>
                    <span className="l-chip" style={{ background: '#fff', color: '#2B3A9E', height: 24, fontSize: 10.5 }}>Great fit</span>
                  </div>
                  <div style={{ fontSize: 12, lineHeight: 1.5, opacity: 0.85 }}>Started in CS wanting research, ended up in backend infra.</div>
                </div>
              </div>
              <div>
                <div className="l-h3" style={{ marginBottom: 6 }}>Mentor matching</div>
                <div className="l-body">Get paired with alumni and seniors who have walked the path you are figuring out.</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* How it works */}
      <section className="l-section l-center">
        <span className="l-chip" style={{ height: 32, padding: '0 16px', marginBottom: 18 }}>How it works</span>
        <h2 className="l-section-title" style={{ margin: '0 0 12px' }}>Get started in 3 simple steps</h2>
        <p className="l-body" style={{ margin: '0 0 44px', fontSize: 16 }}>From first profile to first conversation in one sitting.</p>
        <div className="l-grid" style={{ textAlign: 'left' }}>
          {[
            ['1', 'Tell us about you', 'Your major, skills, interests and goals. Takes about two minutes.'],
            ['2', 'Get your matches', 'See professors ranked for you, each with questions to ask and a draft message.'],
            ['3', 'Reach out and track it', 'Log each conversation and let Links remind you when it is time to follow up.'],
          ].map(([n, t, d]) => (
            <div key={n} className="l-card l-card-soft" style={{ borderRadius: 24, padding: 28 }}>
              <div className="l-avatar" style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--links-primary)', marginBottom: 18 }}>{n}</div>
              <div className="l-h3" style={{ marginBottom: 8 }}>{t}</div>
              <div className="l-body">{d}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <div style={{ padding: '0 clamp(12px, 4vw, 56px)' }}>
        <div className="l-center" style={{ maxWidth: 1168, margin: '0 auto', background: 'var(--links-primary)', color: '#fff', borderRadius: 32, padding: 'clamp(36px, 6vw, 64px) 24px' }}>
          <h2 className="l-section-title" style={{ margin: '0 0 10px' }}>Ready to build your network?</h2>
          <p style={{ margin: '0 0 22px', fontSize: 15, opacity: 0.88 }}>Free for Cal Poly Pomona students and alumni.</p>
          <Link href="/login?mode=signup" className="l-btn l-btn-white" style={{ color: 'var(--links-secondary)', borderRadius: 14 }}>Get started</Link>
        </div>
      </div>

      <footer style={{ maxWidth: 1280, margin: '0 auto', padding: '40px clamp(16px, 4vw, 56px)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, fontSize: 13, fontWeight: 600, color: 'var(--links-text-faint)' }}>
        <Logo size={20} />
        <span>Built by a CPP student, for CPP students.</span>
      </footer>
    </main>
  )
}