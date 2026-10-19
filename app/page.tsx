// app/page.tsx  (the landing page at "/")
import Link from 'next/link'

const FEATURES = [
  {
    n: '01',
    title: 'Research matching',
    body: 'Professors ranked by how closely their work overlaps with yours, each with a plain explanation of why.',
    rows: [
      { left: 'Dr. Maya Reyes', right: '92', accent: true },
      { left: 'Dr. Anita Patel', right: '88', dim: true },
    ],
    serifRight: true,
  },
  {
    n: '02',
    title: 'Network tracker',
    body: 'Log every conversation. Get questions to ask next time and a nudge when it is time to follow up.',
    rows: [
      { left: 'Priya Nair', right: 'LinkedIn' },
      { left: 'Marcus Webb', right: 'Career fair' },
    ],
  },
  {
    n: '03',
    title: 'Mentor matching',
    body: 'Alumni and seniors who have walked the path you are working out, matched on goals and background.',
    rows: [
      { left: 'Jordan Alvarez', right: "CPP '23" },
      { left: 'Sofia Tran', right: "CPP '24" },
    ],
  },
] as const

const STEPS = [
  ['Tell us about you', 'Major, skills, interests and goals. About two minutes.'],
  ['Read your matches', 'Each comes with questions to ask and a draft message.'],
  ['Reach out and keep track', 'Log each conversation and let Links remind you to follow up.'],
]

export default function LandingPage() {
  const chromeUrl = process.env.NEXT_PUBLIC_CHROME_EXTENSION_URL

  return (
    <main>
      <header className="topbar" style={{ minHeight: 88 }}>
        <span className="brand" style={{ fontSize: 30 }}>Links</span>
        <nav className="topnav" aria-label="Main">
          <Link href="/matches">Research</Link>
          <Link href="/network">Network</Link>
          <Link href="/mentors">Mentors</Link>
          <Link href="/login" style={{ color: 'var(--ink)' }}>Sign in</Link>
        </nav>
      </header>

      {/* Hero */}
      <section style={{ padding: 'clamp(64px, 10vw, 112px) var(--gutter) clamp(56px, 8vw, 96px)', borderBottom: '1px solid var(--line)' }}>
        <div className="eyebrow" style={{ marginBottom: 28 }}>For Cal Poly Pomona students</div>
        <h1 className="display" style={{ maxWidth: 980 }}>
          Find the people who can open <em className="accent">doors</em> for you.
        </h1>
        <p style={{ margin: '32px 0 44px', fontSize: 'clamp(17px, 1.6vw, 19px)', lineHeight: 1.6, color: 'var(--text-3)', maxWidth: 560 }}>
          Links matches you with professors, keeps track of the people you meet, and pairs you with alumni who have already done what you want to do.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 32 }}>
          <Link href="/login" className="btn btn-lg">Student login</Link>
          <Link href="/login?role=mentor" className="link" style={{ fontSize: 15 }}>Mentor login</Link>
        </div>
      </section>

      {/* Three features, divided by vertical lines */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', borderBottom: '1px solid var(--line)' }}>
        {FEATURES.map((f, i) => (
          <div
            key={f.n}
            style={{
              padding: `56px clamp(24px, 3vw, 40px) 64px ${i === 0 ? 'var(--gutter)' : 'clamp(24px, 3vw, 40px)'}`,
              borderLeft: i === 0 ? 'none' : '1px solid var(--line)',
            }}
          >
            <div className="num" style={{ marginBottom: 56 }}>{f.n}</div>
            <h2 className="serif" style={{ margin: '0 0 14px', fontSize: 36 }}>{f.title}</h2>
            <p className="body-copy" style={{ marginBottom: 32 }}>{f.body}</p>
            <div className="rows">
              {f.rows.map((r) => (
                <div key={r.left} className="row row-tight row-split" style={{ fontSize: 14, color: 'dim' in r && r.dim ? '#777' : undefined }}>
                  <span>{r.left}</span>
                  {'serifRight' in f ? (
                    <span className="serif" style={{ fontSize: 20, color: 'accent' in r && r.accent ? 'var(--accent)' : undefined }}>{r.right}</span>
                  ) : (
                    <span style={{ color: '#777' }}>{r.right}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>

      {/* How it works */}
      <section style={{ padding: 'clamp(64px, 8vw, 96px) var(--gutter)', display: 'flex', flexWrap: 'wrap', gap: 'clamp(32px, 7vw, 96px)', borderBottom: '1px solid var(--line)' }}>
        <h2 className="serif" style={{ margin: 0, fontSize: 'clamp(40px, 5vw, 56px)', lineHeight: 1.05, width: 380, maxWidth: '100%' }}>How it works</h2>
        <ol className="rows" style={{ flex: 1, minWidth: 'min(100%, 420px)', listStyle: 'none', margin: 0, padding: 0 }}>
          {STEPS.map(([t, d], i) => (
            <li key={t} className="row" style={{ display: 'flex', gap: 32, padding: '28px 0' }}>
              <span className="num" style={{ width: 32, paddingTop: 6 }}>{i + 1}</span>
              <div>
                <div className="serif" style={{ fontSize: 28, marginBottom: 6 }}>{t}</div>
                <div className="body-copy">{d}</div>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Closing call to action */}
      <section style={{ padding: 'clamp(72px, 9vw, 112px) var(--gutter)', textAlign: 'center' }}>
        <h2 className="serif" style={{ margin: '0 0 32px', fontSize: 'clamp(44px, 6vw, 64px)', lineHeight: 1.05 }}>
          Start with one <em className="accent">conversation</em>.
        </h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: 28 }}>
          <Link href="/login?mode=signup" className="btn btn-lg">Get started</Link>
          {/* Set NEXT_PUBLIC_CHROME_EXTENSION_URL to the Chrome Web Store
              listing once the extension is published. */}
          {chromeUrl ? (
            <a href={chromeUrl} target="_blank" rel="noreferrer" className="link" style={{ fontSize: 15 }}>Add to Chrome</a>
          ) : null}
        </div>
      </section>

      <footer className="topbar" style={{ borderBottom: 'none', borderTop: '1px solid var(--line)', fontSize: 13, color: 'var(--muted)' }}>
        <span className="brand" style={{ fontSize: 20, color: 'var(--ink)' }}>Links</span>
        <span>
          Built by a CPP student, for CPP students. · <Link href="/privacy" className="link-quiet" style={{ fontSize: 13, textDecoration: 'underline' }}>Privacy</Link>
        </span>
      </footer>
    </main>
  )
}
