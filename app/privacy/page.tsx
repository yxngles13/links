// app/privacy/page.tsx
// Privacy policy for the Links web app and Chrome extension. The Chrome Web
// Store requires one because the extension handles personal information.
// Keep it in sync with what the code actually does.
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Privacy policy · Links' }

const UPDATED = 'October 18, 2026'
const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <h2 className="l-h3" style={{ margin: 0 }}>{title}</h2>
      <div className="l-body" style={{ fontSize: 15.5, color: 'var(--links-text)', display: 'flex', flexDirection: 'column', gap: 10 }}>{children}</div>
    </section>
  )
}

export default function PrivacyPage() {
  return (
    <main style={{ maxWidth: 760, margin: '0 auto', padding: 'clamp(24px, 5vw, 64px) 16px', display: 'flex', flexDirection: 'column', gap: 28 }}>
      <div>
        <Link href="/" className="l-display" style={{ fontSize: 19, color: 'var(--links-secondary)' }}>Links</Link>
        <h1 className="l-page-title" style={{ margin: '16px 0 6px' }}>Privacy policy</h1>
        <p className="l-body" style={{ margin: 0 }}>Last updated {UPDATED}. Covers the Links website and the Links Chrome extension.</p>
      </div>

      <Section title="What Links stores">
        <p style={{ margin: 0 }}>Only what you give it, in your Links account:</p>
        <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <li>Your email, name and password (passwords are handled by our authentication provider and never visible to us).</li>
          <li>Your student profile: major, year, interests, skills, coursework, goals and availability.</li>
          <li>Contacts you add to your network: name, role, company, how you met, tags, notes, an optional LinkedIn URL, and the interactions you log.</li>
          <li>Mentor profiles and mentorship requests, if you use mentor matching.</li>
        </ul>
      </Section>

      <Section title="The Chrome extension">
        <p style={{ margin: 0 }}>
          The extension only does something when you click its icon. If the open tab is a LinkedIn profile (linkedin.com/in/…), it reads that
          page&apos;s name, headline and address to fill in the form for you. It doesn&apos;t read any other page, and it doesn&apos;t run in the background.
        </p>
        <p style={{ margin: 0 }}>
          Nothing is sent until you press Save. Then the form is sent to your Links account, using your existing Links sign-in in that browser.
          While you type, an unsaved draft is kept in the browser&apos;s temporary extension storage and cleared when you save or close the browser.
        </p>
      </Section>

      <Section title="Who processes your data">
        <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <li><strong>Supabase</strong> stores your account and everything above.</li>
          <li><strong>Vercel</strong> hosts the website and runs its server code.</li>
          <li>
            <strong>Groq</strong> generates match explanations, summaries, questions and draft messages. To do that, Links sends it the relevant
            profile details, contact details and notes. Matching itself runs on our own server.
          </li>
        </ul>
        <p style={{ margin: 0 }}>Links has no ads, no analytics trackers, and never sells or shares your data for marketing.</p>
      </Section>

      <Section title="Who can see what">
        <p style={{ margin: 0 }}>
          Your network, notes and matches are visible only to you. If you request a chat with a mentor, that mentor sees your name, your year and
          major, the topic and your message. Mentors&apos; profiles are visible to signed-in students.
        </p>
      </Section>

      <Section title="Deleting your data">
        <p style={{ margin: 0 }}>
          Delete any contact from its page in your network; its timeline and drafts go with it.
          {CONTACT_EMAIL ? (
            <> To delete your whole account, email <a href={`mailto:${CONTACT_EMAIL}`} style={{ fontWeight: 800, color: 'var(--links-secondary)' }}>{CONTACT_EMAIL}</a> from the address you signed up with.</>
          ) : (
            <> To delete your whole account, contact us through the email on the Links Chrome Web Store listing.</>
          )}
        </p>
      </Section>
    </main>
  )
}
