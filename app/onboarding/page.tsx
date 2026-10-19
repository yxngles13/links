// app/onboarding/page.tsx
//
// Field names match actions.ts. Comma-separated fields stay plain text
// inputs; swap in a tag picker later as long as it sends the same names.

import { BrandBar } from '@/components/AppNav'
import SubmitButton from '@/components/SubmitButton'
import { submitOnboarding } from './actions'

const HOURS = [
  { value: 2, label: '1–3' },
  { value: 5, label: '4–6' },
  { value: 8, label: '7+' },
]

export default function OnboardingPage() {
  return (
    <main>
      <BrandBar />
      <div className="shell">
        <div style={{ width: 460, maxWidth: '100%', flexShrink: 0, padding: '72px 48px 48px var(--gutter)' }}>
          <div className="eyebrow" style={{ marginBottom: 20 }}>Your profile</div>
          <h1 className="title-sm" style={{ marginBottom: 20 }}>
            Tell us what you want to <em className="accent">work on</em>.
          </h1>
          <p className="body-copy">About two minutes. We use it to find professors whose work genuinely overlaps with yours. Professors never see your answers.</p>
        </div>

        <form action={submitOnboarding} className="main form" style={{ borderLeft: '1px solid var(--line)', maxWidth: 760 }}>
          <div className="form-row">
            <div className="field">
              <label htmlFor="major">Major</label>
              <input id="major" name="major" type="text" required defaultValue="Computer Science" className="input" />
            </div>
            <div className="field">
              <label htmlFor="academic_year">Academic year</label>
              <select id="academic_year" name="academic_year" required defaultValue="Junior" className="input">
                <option>Freshman</option>
                <option>Sophomore</option>
                <option>Junior</option>
                <option>Senior</option>
              </select>
            </div>
          </div>

          <div className="field">
            <label htmlFor="research_interests">Research interests</label>
            <input id="research_interests" name="research_interests" type="text" placeholder="Machine learning, computer vision" className="input" />
            <p className="hint">Separate with commas.</p>
          </div>

          <div className="field">
            <label htmlFor="technical_skills">Technical skills</label>
            <input id="technical_skills" name="technical_skills" type="text" placeholder="Python, PyTorch, SQL" className="input" />
          </div>

          <div className="field">
            <label htmlFor="coursework">Relevant coursework</label>
            <input id="coursework" name="coursework" type="text" placeholder="CS 3110, CS 4200" className="input" />
          </div>

          <div className="field">
            <label htmlFor="career_goals">Career goals</label>
            <textarea id="career_goals" name="career_goals" rows={2} placeholder="What do you want out of research experience?" className="input" />
          </div>

          <fieldset className="field">
            <legend>Hours a week</legend>
            <div className="choices">
              {HOURS.map((h) => (
                <label key={h.value} className="choice">
                  <input type="radio" name="weekly_availability_hours" value={h.value} defaultChecked={h.value === 5} />
                  <span style={{ minWidth: 56, justifyContent: 'center' }}>{h.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div style={{ marginTop: 8 }}>
            <SubmitButton pendingText="Finding your matches… about a minute">See my matches →</SubmitButton>
          </div>
        </form>
      </div>
    </main>
  )
}
