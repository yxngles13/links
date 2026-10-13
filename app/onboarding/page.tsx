// app/onboarding/page.tsx
//
// Styled onboarding. Field names are unchanged, so actions.ts needs no edits.
// Comma-separated fields are still plain text inputs; swap in a tag picker later
// as long as it keeps sending the same field names.

import { submitOnboarding } from './actions'
import SubmitButton from '@/components/SubmitButton'

const HOURS = [
  { value: 2, label: '1–3 hrs' },
  { value: 5, label: '4–6 hrs' },
  { value: 8, label: '7+ hrs' },
]

export default function OnboardingPage() {
  return (
    <div className="l-page">
      <nav className="l-nav">
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <svg width="22" height="22" viewBox="0 0 26 26" fill="none" aria-hidden="true">
            <rect x="2" y="9" width="14" height="8" rx="4" transform="rotate(-30 9 13)" stroke="#6C93FF" strokeWidth="2.6" />
            <rect x="10" y="9" width="14" height="8" rx="4" transform="rotate(-30 17 13)" stroke="#ffffff" strokeWidth="2.6" />
          </svg>
          <span className="l-display" style={{ fontSize: 19 }}>Links</span>
        </div>
        <span style={{ fontSize: 13.5, fontWeight: 700, opacity: 0.65 }}>Set up your profile</span>
      </nav>

      <div className="l-onboard">
        {/* Intro column */}
        <div className="l-onboard-intro">
          <h1 className="l-h1" style={{ margin: '0 0 16px', fontSize: 'clamp(32px, 4.4vw, 52px)' }}>
            Hey there, let&apos;s find your match
          </h1>
          <p className="l-body" style={{ margin: '0 0 24px', fontSize: 17 }}>
            Two minutes of questions. We rank real CPP professors by how closely their work overlaps with yours, not by keyword.
          </p>
          <div className="l-card l-card-soft" style={{ display: 'flex', gap: 12, alignItems: 'flex-start', borderRadius: 18, padding: 16 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2B3A9E" strokeWidth="2.2" aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }}>
              <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
            </svg>
            <span style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.5, color: 'var(--links-text-muted)' }}>
              Your answers are only used for matching. Professors never see them.
            </span>
          </div>
        </div>

        {/* Form card */}
        <form action={submitOnboarding} className="l-card l-card-soft" style={{ borderRadius: 28, padding: 'clamp(20px, 3vw, 36px)', display: 'flex', flexDirection: 'column', gap: 22 }}>
          <div className="l-form-row">
            <div className="l-field">
              <label htmlFor="major" className="l-label">Major</label>
              <input id="major" name="major" type="text" required defaultValue="Computer Science" className="l-input" style={{ background: '#fff' }} />
            </div>
            <div className="l-field">
              <label htmlFor="academic_year" className="l-label">Academic year</label>
              <select id="academic_year" name="academic_year" required defaultValue="Junior" className="l-input" style={{ background: '#fff' }}>
                <option>Freshman</option>
                <option>Sophomore</option>
                <option>Junior</option>
                <option>Senior</option>
              </select>
            </div>
          </div>

          <div className="l-field">
            <label htmlFor="research_interests" className="l-label">Research interests</label>
            <input id="research_interests" name="research_interests" type="text" placeholder="Machine learning, computer vision, cybersecurity" className="l-input" style={{ background: '#fff' }} />
            <p className="l-hint">Separate multiple interests with commas.</p>
          </div>

          <div className="l-field">
            <label htmlFor="technical_skills" className="l-label">Technical skills</label>
            <textarea id="technical_skills" name="technical_skills" rows={2} placeholder="Python, PyTorch, SQL, data pipelines" className="l-textarea" style={{ background: '#fff', resize: 'vertical' }} />
          </div>

          <div className="l-field">
            <label htmlFor="coursework" className="l-label">Relevant coursework</label>
            <input id="coursework" name="coursework" type="text" placeholder="CS 3110, CS 4200" className="l-input" style={{ background: '#fff' }} />
          </div>

          <div className="l-field">
            <label htmlFor="career_goals" className="l-label">Career goals</label>
            <textarea id="career_goals" name="career_goals" rows={3} placeholder="What are you hoping to get out of research experience?" className="l-textarea" style={{ background: '#fff', resize: 'vertical' }} />
          </div>

          <fieldset style={{ border: 'none', padding: 0, margin: 0 }} className="l-field">
            <legend className="l-label" style={{ marginBottom: 8 }}>Weekly availability</legend>
            <div className="l-choices">
              {HOURS.map((h) => (
                <label key={h.value} className="l-choice">
                  <input type="radio" name="weekly_availability_hours" value={h.value} defaultChecked={h.value === 5} />
                  <span style={{ background: '#fff' }}>{h.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <SubmitButton pendingText="Finding your matches… this takes about a minute">See my matches →</SubmitButton>
        </form>
      </div>
    </div>
  )
}