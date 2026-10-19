// app/mentor/profile/page.tsx
// Mentor sign-up, and later "My profile" for editing it. Same form both ways.
import AppNav, { BrandBar } from '@/components/AppNav'
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
    <>
      {existing ? <AppNav active="mentor-profile" /> : <BrandBar right="Mentor sign-up" />}
      <div className="shell">
        <div style={{ width: 460, maxWidth: '100%', flexShrink: 0, padding: '64px 48px 48px var(--gutter)' }}>
          <div className="eyebrow" style={{ marginBottom: 20 }}>{existing ? 'Your mentor profile' : 'For CPP alumni and seniors'}</div>
          <h1 className="title-sm" style={{ marginBottom: 20 }}>
            Help a freshman skip a few years of <em className="accent">figuring it out</em>.
          </h1>
          <p className="body-copy" style={{ marginBottom: 28 }}>
            Five minutes to set up. We match you with students whose goals line up with what you know, not a random assignment.
          </p>
          <p className="body-copy" style={{ borderTop: '1px solid var(--line)', paddingTop: 14, fontSize: 13.5 }}>
            A student requests a chat and you accept on your own schedule. No ongoing commitment, and you can pause requests any time.
          </p>
        </div>

        <form action={saveMentorProfile} className="main form" style={{ borderLeft: '1px solid var(--line)', maxWidth: 760 }}>
          {error ? <div className="alert" role="alert">{error}</div> : null}

          <div className="form-row">
            <div className="field" style={{ gridColumn: 'span 1' }}>
              <label htmlFor="full_name">Full name</label>
              <input id="full_name" name="full_name" required defaultValue={existing?.full_name ?? displayName(user)} className="input" />
            </div>
            <div className="field">
              <label htmlFor="grad_year">CPP grad year</label>
              <input id="grad_year" name="grad_year" type="number" min={1950} max={2040} placeholder="2023" defaultValue={existing?.grad_year ?? undefined} className="input" />
            </div>
          </div>

          <div className="form-row">
            <div className="field">
              <label htmlFor="job_title">Current role</label>
              <input id="job_title" name="job_title" placeholder="Software Engineer" defaultValue={existing?.job_title ?? ''} className="input" />
            </div>
            <div className="field">
              <label htmlFor="company">Company</label>
              <input id="company" name="company" placeholder="Datadog" defaultValue={existing?.company ?? ''} className="input" />
            </div>
          </div>

          <div className="field">
            <label htmlFor="linkedin_url">LinkedIn profile</label>
            <input id="linkedin_url" name="linkedin_url" type="url" placeholder="https://www.linkedin.com/in/…" defaultValue={existing?.linkedin_url ?? ''} className="input" />
            <p className="hint">Students see this next to your name so they can look you up before a chat.</p>
          </div>

          <fieldset className="field">
            <legend>What you can mentor on</legend>
            <div className="choices">
              {MENTOR_TOPICS.map((t) => (
                <label key={t} className="choice">
                  <input type="checkbox" name="mentor_topics" value={t} defaultChecked={existing?.mentor_topics.includes(t)} />
                  <span>{t}</span>
                </label>
              ))}
            </div>
            <input name="other_topics" aria-label="Other topics, comma separated" placeholder="Other topics, comma separated" defaultValue={otherTopics.join(', ')} className="input" style={{ marginTop: 12, fontSize: 15 }} />
          </fieldset>

          <div className="field">
            <label htmlFor="bio">Short bio</label>
            <textarea id="bio" name="bio" rows={2} placeholder="What should a freshman know about you before reaching out?" defaultValue={existing?.bio ?? ''} className="input" />
          </div>

          <div className="form-row">
            <div className="field">
              <label htmlFor="availability">Availability</label>
              <select id="availability" name="availability" defaultValue={existing?.availability ?? AVAILABILITY[0]} className="input">
                {AVAILABILITY.map((a) => <option key={a}>{a}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="preferred_format">Preferred format</label>
              <select id="preferred_format" name="preferred_format" defaultValue={existing?.preferred_format ?? FORMATS[0]} className="input">
                {FORMATS.map((f) => <option key={f}>{f}</option>)}
              </select>
            </div>
          </div>

          <div style={{ marginTop: 8 }}>
            <SubmitButton pendingText="Saving…">{existing ? 'Save profile' : 'Create mentor profile →'}</SubmitButton>
          </div>
        </form>
      </div>
    </>
  )
}
