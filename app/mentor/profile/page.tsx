// app/mentor/profile/page.tsx
// Mentor sign-up, and later "My profile" for editing it. Same form both ways.
import AppNav, { Logo } from '@/components/AppNav'
import SubmitButton from '@/components/SubmitButton'
import { requireUser, displayName } from '@/lib/auth'
import { getOwnMentorProfile, MENTOR_TOPICS } from '@/lib/mentors'
import { saveMentorProfile } from '../actions'

const AVAILABILITY = ['1 chat / month', '2 chats / month', '1 chat / week']
const FORMATS = ['Video call', 'Phone call', 'Coffee on campus', 'Async messages']

export default async function MentorProfilePage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams
  const { supabase, user } = await requireUser()
  const existing = await getOwnMentorProfile(supabase, user.id)
  const otherTopics = (existing?.mentor_topics ?? []).filter((t) => !MENTOR_TOPICS.includes(t))

  return (
    <div className="l-page">
      {existing ? (
        <AppNav active="mentor-profile" />
      ) : (
        <nav className="l-nav">
          <Logo />
          <span style={{ fontSize: 13.5, fontWeight: 700, opacity: 0.65 }}>Mentor sign-up</span>
        </nav>
      )}

      <div className="l-onboard">
        <div className="l-onboard-intro">
          <h1 className="l-page-title" style={{ margin: '0 0 16px', fontSize: 'clamp(30px, 4vw, 44px)' }}>
            {existing ? 'Your mentor profile' : 'Help a freshman skip a few years of figuring it out'}
          </h1>
          <p className="l-body" style={{ margin: '0 0 24px', fontSize: 16 }}>
            Five minutes to set up your profile. We match you with students whose goals line up with what you know, not a random assignment.
          </p>
          <div className="l-card l-card-tint" style={{ borderRadius: 20, padding: 18 }}>
            <div className="l-eyebrow" style={{ color: 'var(--links-secondary)', marginBottom: 6 }}>What this looks like</div>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600, lineHeight: 1.5, color: 'var(--links-secondary)' }}>
              A student requests a chat, you accept on your own schedule. No ongoing commitment, and you can pause new requests any time.
            </p>
          </div>
        </div>

        <form action={saveMentorProfile} className="l-card l-card-soft" style={{ borderRadius: 28, padding: 'clamp(20px, 3vw, 36px)', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {error ? <div style={{ color: '#a01818', fontWeight: 600 }}>{error}</div> : null}

          <div className="l-form-row">
            <div className="l-field">
              <label htmlFor="full_name" className="l-label">Full name</label>
              <input id="full_name" name="full_name" required defaultValue={existing?.full_name ?? displayName(user)} className="l-input" style={{ background: '#fff' }} />
            </div>
            <div className="l-field">
              <label htmlFor="grad_year" className="l-label">CPP grad year</label>
              <input id="grad_year" name="grad_year" type="number" min={1950} max={2040} placeholder="2023" defaultValue={existing?.grad_year ?? undefined} className="l-input" style={{ background: '#fff' }} />
            </div>
          </div>

          <div className="l-form-row">
            <div className="l-field">
              <label htmlFor="job_title" className="l-label">Current role</label>
              <input id="job_title" name="job_title" placeholder="Software Engineer" defaultValue={existing?.job_title ?? ''} className="l-input" style={{ background: '#fff' }} />
            </div>
            <div className="l-field">
              <label htmlFor="company" className="l-label">Company</label>
              <input id="company" name="company" placeholder="Datadog" defaultValue={existing?.company ?? ''} className="l-input" style={{ background: '#fff' }} />
            </div>
          </div>

          <fieldset className="l-field" style={{ border: 'none', padding: 0, margin: 0 }}>
            <legend className="l-label" style={{ marginBottom: 8 }}>What you can mentor on</legend>
            <div className="l-choices">
              {MENTOR_TOPICS.map((t) => (
                <label key={t} className="l-choice l-choice-sm">
                  <input type="checkbox" name="mentor_topics" value={t} defaultChecked={existing?.mentor_topics.includes(t)} />
                  <span style={{ background: '#fff' }}>{t}</span>
                </label>
              ))}
            </div>
            <input name="other_topics" aria-label="Other topics, comma separated" placeholder="Other topics, comma separated" defaultValue={otherTopics.join(', ')} className="l-input l-input-sm" style={{ background: '#fff', marginTop: 10 }} />
          </fieldset>

          <div className="l-field">
            <label htmlFor="bio" className="l-label">Short bio</label>
            <textarea id="bio" name="bio" rows={3} placeholder="What should a freshman know about you before reaching out?" defaultValue={existing?.bio ?? ''} className="l-textarea" style={{ background: '#fff', resize: 'vertical' }} />
          </div>

          <div className="l-form-row">
            <div className="l-field">
              <label htmlFor="availability" className="l-label">Availability</label>
              <select id="availability" name="availability" defaultValue={existing?.availability ?? AVAILABILITY[0]} className="l-input" style={{ background: '#fff' }}>
                {AVAILABILITY.map((a) => <option key={a}>{a}</option>)}
              </select>
            </div>
            <div className="l-field">
              <label htmlFor="preferred_format" className="l-label">Preferred format</label>
              <select id="preferred_format" name="preferred_format" defaultValue={existing?.preferred_format ?? FORMATS[0]} className="l-input" style={{ background: '#fff' }}>
                {FORMATS.map((f) => <option key={f}>{f}</option>)}
              </select>
            </div>
          </div>

          <SubmitButton pendingText="Saving…">{existing ? 'Save profile' : 'Create mentor profile'}</SubmitButton>
        </form>
      </div>
    </div>
  )
}
