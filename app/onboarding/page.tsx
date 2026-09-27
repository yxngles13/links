// app/onboarding/page.tsx
//
// Real, functional version of the Onboarding screen from the mockups.
// Visual polish (matching the mockup's exact layout/colors) can come later —
// this focuses on getting every field correctly wired to submitOnboarding.
// Comma-separated fields (research interests, skills, coursework) are a
// placeholder input style; swap for a real tag-picker component later if
// you want the interactive chips from the mockup — just keep sending the
// same field names so actions.ts doesn't need to change.

import { submitOnboarding } from './actions'

export default function OnboardingPage() {
  return (
    <main style={{ maxWidth: 640, margin: '0 auto', padding: '48px 24px' }}>
      <h1 style={{ fontSize: 32, marginBottom: 8 }}>Tell us about your research interests</h1>
      <p style={{ color: '#666', marginBottom: 32 }}>
        This takes about two minutes. We use it to find professors and labs whose work genuinely
        overlaps with yours.
      </p>

      <form action={submitOnboarding} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <label htmlFor="major" style={{ display: 'block', marginBottom: 6, fontSize: 14, fontWeight: 500 }}>
            Major
          </label>
          <input
            id="major"
            name="major"
            type="text"
            required
            defaultValue="Computer Science"
            style={{ width: '100%', padding: '10px 12px', border: '1px solid #ccc', borderRadius: 8 }}
          />
        </div>

        <div>
          <label htmlFor="academic_year" style={{ display: 'block', marginBottom: 6, fontSize: 14, fontWeight: 500 }}>
            Academic year
          </label>
          <select
            id="academic_year"
            name="academic_year"
            required
            style={{ width: '100%', padding: '10px 12px', border: '1px solid #ccc', borderRadius: 8 }}
          >
            <option value="Freshman">Freshman</option>
            <option value="Sophomore">Sophomore</option>
            <option value="Junior">Junior</option>
            <option value="Senior">Senior</option>
          </select>
        </div>

        <div>
          <label htmlFor="research_interests" style={{ display: 'block', marginBottom: 6, fontSize: 14, fontWeight: 500 }}>
            Research interests
          </label>
          <input
            id="research_interests"
            name="research_interests"
            type="text"
            placeholder="Machine learning, computer vision, cybersecurity"
            style={{ width: '100%', padding: '10px 12px', border: '1px solid #ccc', borderRadius: 8 }}
          />
          <p style={{ fontSize: 12, color: '#888', marginTop: 4 }}>Separate multiple interests with commas.</p>
        </div>

        <div>
          <label htmlFor="technical_skills" style={{ display: 'block', marginBottom: 6, fontSize: 14, fontWeight: 500 }}>
            Technical skills
          </label>
          <textarea
            id="technical_skills"
            name="technical_skills"
            rows={2}
            placeholder="Python, PyTorch, SQL, data pipelines"
            style={{ width: '100%', padding: '10px 12px', border: '1px solid #ccc', borderRadius: 8, resize: 'vertical' }}
          />
        </div>

        <div>
          <label htmlFor="coursework" style={{ display: 'block', marginBottom: 6, fontSize: 14, fontWeight: 500 }}>
            Relevant coursework
          </label>
          <input
            id="coursework"
            name="coursework"
            type="text"
            placeholder="CS 3110, CS 4200"
            style={{ width: '100%', padding: '10px 12px', border: '1px solid #ccc', borderRadius: 8 }}
          />
        </div>

        <div>
          <label htmlFor="career_goals" style={{ display: 'block', marginBottom: 6, fontSize: 14, fontWeight: 500 }}>
            Career goals
          </label>
          <textarea
            id="career_goals"
            name="career_goals"
            rows={3}
            placeholder="What are you hoping to get out of research experience?"
            style={{ width: '100%', padding: '10px 12px', border: '1px solid #ccc', borderRadius: 8, resize: 'vertical' }}
          />
        </div>

        <div>
          <label htmlFor="weekly_availability_hours" style={{ display: 'block', marginBottom: 6, fontSize: 14, fontWeight: 500 }}>
            Weekly availability (hours)
          </label>
          <input
            id="weekly_availability_hours"
            name="weekly_availability_hours"
            type="number"
            min={1}
            max={40}
            defaultValue={5}
            style={{ width: '100%', padding: '10px 12px', border: '1px solid #ccc', borderRadius: 8 }}
          />
        </div>

        <button
          type="submit"
          style={{
            marginTop: 12,
            padding: '12px 20px',
            background: '#B5793B',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            fontSize: 15,
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          See my matches
        </button>
      </form>
    </main>
  )
}