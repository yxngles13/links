// app/page.tsx  (the landing page at "/")
import Link from 'next/link'
import { Brand } from '@/components/AppNav'

const FEATURES = [
  {
    n: '01',
    title: 'Research matching',
    body: 'Professors ranked by how closely their work overlaps with yours, each with a plain explanation of why.',
    tint: 'card-lilac',
    rows: [
      { left: 'Dr. Maya Reyes', right: '92', accent: true },
      { left: 'Dr. Anita Patel', right: '88' },
    ],
    scores: true,
  },
  {
    n: '02',
    title: 'Network tracker',
    body: 'Log every conversation. Get questions to ask next time and a nudge when it is time to follow up.',
    tint: 'card-mint',
    rows: [
      { left: 'Priya Nair', right: 'LinkedIn' },
      { left: 'Marcus Webb', right: 'Career fair' },
    ],
    scores: false,
  },
] as const

const STEPS = [
  ['Tell us about you', 'Major, skills, interests and goals. About two minutes.', 'card-peach'],
  ['Read your matches', 'Each comes with questions to ask and a draft message.', 'card-butter'],
  ['Reach out and keep track', 'Log each conversation and let Links remind you to follow up.', 'card-lilac'],
] as const

export default function LandingPage() {
  const chromeUrl = process.env.NEXT_PUBLIC_CHROME_EXTENSION_URL

  return (
    <main>
      <header className="topbar">
        <Brand href="/" />
        <nav className="topnav" aria-label="Main">
          <Link href="/matches" className="navpill">Research</Link>
          <Link href="/network" className="navpill">Network</Link>
          <Link href="/login" className="btn btn-sm">Sign in</Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="land-hero">
        <div className="eyebrow land-eyebrow">For Cal Poly Pomona students</div>
        <h1 className="display">
          Find the people who can open <em className="accent">doors</em> for you.
        </h1>
        <p className="land-lead">
          Links matches you with professors, and keeps track of the people you meet so you never forget to follow up.
        </p>
        <div className="land-actions">
          <Link href="/login" className="btn btn-lg">Sign in</Link>
          {chromeUrl ? (
            <a href={chromeUrl} target="_blank" rel="noreferrer" className="btn btn-lg btn-outline">Add to Chrome</a>
          ) : null}
        </div>
      </section>

      {/* Features */}
      <section className="land-grid">
        {FEATURES.map((f) => (
          <div key={f.n} className={`card ${f.tint} land-feature`}>
            <div className="num land-num">{f.n}</div>
            <h2 className="land-h2">{f.title}</h2>
            <p className="body-copy land-body">{f.body}</p>
            <div className="land-mini-list">
              {f.rows.map((r) => (
                <div key={r.left} className="land-mini">
                  <span>{r.left}</span>
                  {f.scores ? (
                    <span className="land-score">{r.right}</span>
                  ) : (
                    <span className="muted">{r.right}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>

      {/* How it works */}
      <section className="land-how">
        <h2 className="land-h2 land-h2-lg">How it works</h2>
        <ol className="land-steps">
          {STEPS.map(([t, d, tint], i) => (
            <li key={t} className={`card ${tint} land-step`}>
              <span className="q-num" aria-hidden="true">{i + 1}</span>
              <div>
                <div className="land-step-title">{t}</div>
                <div className="body-copy">{d}</div>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Closing call to action */}
      <section className="land-cta">
        <h2 className="land-h2 land-h2-lg">
          Start with one <em className="accent">conversation</em>.
        </h2>
        <div className="land-actions land-actions-center">
          <Link href="/login?mode=signup" className="btn btn-lg btn-accent">Get started</Link>
          {/* Set NEXT_PUBLIC_CHROME_EXTENSION_URL to the Chrome Web Store
              listing once the extension is published. */}
          {chromeUrl ? (
            <a href={chromeUrl} target="_blank" rel="noreferrer" className="btn btn-lg btn-outline">Add to Chrome</a>
          ) : null}
        </div>
      </section>

      <footer className="land-footer">
        <Brand href="/" />
        <span>
          Built by a CPP student, for CPP students. · <Link href="/privacy" className="link-quiet land-privacy">Privacy</Link>
        </span>
      </footer>
    </main>
  )
}
