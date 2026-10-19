// app/profile/page.tsx
// Your own profile. The top half is what other signed-in users see (see
// /profile/[id]); the "What you want to work on" section is the old
// onboarding form and stays private.
import AppNav from '@/components/AppNav'
import ProfileHeader from '@/components/ProfileHeader'
import ProfileReminder from '@/components/ProfileReminder'
import SubmitButton from '@/components/SubmitButton'
import { displayName, requireUser } from '@/lib/auth'
import { MAX_ANSWER_LENGTH, MAX_HEADLINE_LENGTH, MAX_PROMPTS, PROFILE_PROMPTS } from '@/lib/profile'
import { getPublicProfile, PROFILE_MIGRATION, signedFileUrls } from '@/lib/student-profile'
import { saveAbout, saveMatchingAnswers } from './actions'

const HOURS = [
  { value: 2, label: '1–3' },
  { value: 5, label: '4–6' },
  { value: 8, label: '7+' },
]
const YEARS = ['Freshman', 'Sophomore', 'Junior', 'Senior']

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  const { error, saved } = await searchParams
  const { supabase, user } = await requireUser()

  const [{ profile, missing }, { data: answers }] = await Promise.all([
    getPublicProfile(supabase, user.id),
    supabase
      .from('student_profiles')
      .select('major, academic_year, research_interests, technical_skills, coursework, career_goals, weekly_availability_hours')
      .eq('user_id', user.id)
      .maybeSingle(),
  ])
  const { photoUrl, resumeUrl } = await signedFileUrls(supabase, profile)
  const name = profile?.full_name || displayName(user)
  // Always three rows; empty ones are ignored on save.
  const promptRows = Array.from({ length: MAX_PROMPTS }, (_, i) => profile?.prompts[i] ?? { key: '', answer: '' })

  return (
    <>
      <AppNav active="profile" />
      <ProfileReminder />
      <main className="page" style={{ maxWidth: 960 }}>
        {error ? <div className="alert" role="alert">{error}</div> : null}
        {missing ? (
          <div className="notice" style={{ marginBottom: 32 }}>
            <div className="label" style={{ marginBottom: 8 }}>Setup needed</div>
            <p className="body-copy">
              Profiles need their database table. Run <code>{PROFILE_MIGRATION}</code> in the Supabase SQL Editor, then reload
              this page. Your matching answers below still work.
            </p>
          </div>
        ) : null}

        <ProfileHeader
          name={name}
          headline={profile?.headline ?? null}
          photoUrl={photoUrl}
          resumeUrl={resumeUrl}
          linkedin={profile?.linkedin_url ?? null}
          github={profile?.github_url ?? null}
        />

        <section aria-labelledby="about-title" style={{ padding: '40px 0', borderBottom: '1px solid var(--line)' }}>
          <div className="head-row" style={{ alignItems: 'baseline' }}>
            <h2 id="about-title" className="name" style={{ margin: 0 }}>About you</h2>
            <span className="meta">Anyone signed in to Links can see this part.</span>
          </div>
          {saved === 'about' ? <p className="meta accent" role="status" style={{ marginTop: -12, marginBottom: 20 }}>Saved.</p> : null}

          <form action={saveAbout} className="form">
            <div className="form-row">
              <div className="field">
                <label htmlFor="full_name">Name</label>
                <input id="full_name" name="full_name" required defaultValue={name} className="input" />
              </div>
              <div className="field">
                <label htmlFor="headline">Headline</label>
                <input id="headline" name="headline" maxLength={MAX_HEADLINE_LENGTH} placeholder="CS junior into ML for healthcare" defaultValue={profile?.headline ?? ''} className="input" />
              </div>
            </div>

            <fieldset className="field">
              <legend>Pick {MAX_PROMPTS} questions and answer in a line</legend>
              <div className="rows">
                {promptRows.map((p, i) => (
                  <div key={i} className="row form-row" style={{ gap: '12px 32px' }}>
                    <select name="prompt_key" aria-label={`Question ${i + 1}`} defaultValue={p.key} className="input">
                      <option value="">Choose a question…</option>
                      {PROFILE_PROMPTS.map((q) => <option key={q.key} value={q.key}>{q.text}</option>)}
                    </select>
                    <input name="prompt_answer" aria-label={`Answer ${i + 1}`} maxLength={MAX_ANSWER_LENGTH} defaultValue={p.answer} placeholder="Your answer" className="input" />
                  </div>
                ))}
              </div>
            </fieldset>

            <div className="form-row">
              <div className="field">
                <label htmlFor="linkedin_url">LinkedIn</label>
                <input id="linkedin_url" name="linkedin_url" type="url" placeholder="https://www.linkedin.com/in/…" defaultValue={profile?.linkedin_url ?? ''} className="input" />
              </div>
              <div className="field">
                <label htmlFor="github_url">GitHub</label>
                <input id="github_url" name="github_url" type="url" placeholder="https://github.com/…" defaultValue={profile?.github_url ?? ''} className="input" />
              </div>
            </div>

            <div className="form-row">
              <div className="field">
                <label htmlFor="photo">Photo {profile?.photo_path ? '(choose a file to replace it)' : ''}</label>
                <input id="photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp" className="input" />
                <p className="hint">JPEG, PNG or WebP, up to 2 MB.</p>
              </div>
              <div className="field">
                <label htmlFor="resume">Resume {profile?.resume_path ? '(choose a file to replace it)' : ''}</label>
                <input id="resume" name="resume" type="file" accept="application/pdf" className="input" />
                <p className="hint">PDF, up to 3 MB. Anyone signed in to Links can see this, so leave off your phone number and home address.</p>
              </div>
            </div>

            <div>
              <SubmitButton pendingText="Saving…">Save profile</SubmitButton>
            </div>
          </form>
        </section>

        <section id="matching" aria-labelledby="matching-title" style={{ padding: '40px 0', scrollMarginTop: 24 }}>
          <div className="head-row" style={{ alignItems: 'baseline' }}>
            <h2 id="matching-title" className="name" style={{ margin: 0 }}>
              What you want to <em className="accent">work on</em>
            </h2>
            <span className="meta">Only you see this. We use it to find professors whose work overlaps with yours.</span>
          </div>
          {saved === 'matching' ? (
            <p className="meta accent" role="status" style={{ marginTop: -12, marginBottom: 20 }}>Saved. Your matches are refreshing in the background.</p>
          ) : null}

          <form action={saveMatchingAnswers} className="form">
            <div className="form-row">
              <div className="field">
                <label htmlFor="major">Major</label>
                <input id="major" name="major" type="text" required defaultValue={answers?.major ?? ''} placeholder="Computer Science" className="input" />
              </div>
              <div className="field">
                <label htmlFor="academic_year">Academic year</label>
                <select id="academic_year" name="academic_year" required defaultValue={answers?.academic_year ?? 'Freshman'} className="input">
                  {YEARS.map((y) => <option key={y}>{y}</option>)}
                </select>
              </div>
            </div>

            <div className="field">
              <label htmlFor="research_interests">Research interests</label>
              <input id="research_interests" name="research_interests" type="text" placeholder="Machine learning, computer vision" defaultValue={answers?.research_interests?.join(', ') ?? ''} className="input" />
              <p className="hint">Separate with commas.</p>
            </div>

            <div className="field">
              <label htmlFor="technical_skills">Technical skills</label>
              <input id="technical_skills" name="technical_skills" type="text" placeholder="Python, PyTorch, SQL" defaultValue={answers?.technical_skills?.join(', ') ?? ''} className="input" />
            </div>

            <div className="field">
              <label htmlFor="coursework">Relevant coursework</label>
              <input id="coursework" name="coursework" type="text" placeholder="CS 3110, CS 4200" defaultValue={answers?.coursework?.join(', ') ?? ''} className="input" />
            </div>

            <div className="field">
              <label htmlFor="career_goals">Career goals</label>
              <textarea id="career_goals" name="career_goals" rows={2} placeholder="What do you want out of research experience?" defaultValue={answers?.career_goals ?? ''} className="input" />
            </div>

            <fieldset className="field">
              <legend>Hours a week</legend>
              <div className="choices">
                {HOURS.map((h) => (
                  <label key={h.value} className="choice">
                    <input type="radio" name="weekly_availability_hours" value={h.value} defaultChecked={h.value === (answers?.weekly_availability_hours ?? 5)} />
                    <span style={{ minWidth: 56, justifyContent: 'center' }}>{h.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div>
              {answers ? (
                <SubmitButton pendingText="Saving…">Save answers</SubmitButton>
              ) : (
                <SubmitButton pendingText="Finding your matches… about a minute">See my matches →</SubmitButton>
              )}
            </div>
          </form>
        </section>
      </main>
    </>
  )
}
