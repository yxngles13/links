# Student profile — design

Date: 2026-10-19

## Intent

Today "Profile" in the student nav points at `/onboarding`, a form of matching
questions. The student wants a real profile instead: a page about *who you are*
that other people on Links can look at, with some personality in it, and with
the matching questions living inside it as their own section. Students who
haven't answered the matching questions get nudged to do so, because without
those answers there are no matches.

Typing in a work history isn't fun, so the profile skips it. A resume, LinkedIn
and GitHub cover the "what I've done" part; a few short personality prompts
cover "who I am". This also lays groundwork for peer-to-peer networking later.

## Goals

- A student profile page with: photo, name, headline, **3 personality prompts**
  (short answers), resume (PDF upload), LinkedIn URL, GitHub URL.
- **Personality prompts:** the student picks 3 questions from a list of about
  10 and answers each in one short line (max ~150 characters). The list lives
  in code so it's easy to change. Starter list:
  1. A problem I can't stop thinking about…
  2. The rabbit hole I went down most recently…
  3. I'm the person you'd ask about…
  4. A project I'd build if I had a free summer…
  5. My ideal lab vibe is…
  6. Something I'm bad at but working on…
  7. Currently learning…
  8. Best class I've taken and why…
  9. Outside of school you'll find me…
  10. Let's talk about…
- The current onboarding questions (major, academic year, research interests,
  technical skills, coursework, career goals, hours/week) become a section of
  the profile, answerable and editable any time.
- Reminder to finish the matching questions:
  - a **pop-up once**, the first time a signed-in student lands in the app
    without answers (in practice: right after signup);
  - after that, a **slim banner** at the top of student pages until the
    questions are answered.
- Profiles are **visible to anyone signed in to Links** (students and mentors).
  Not public on the internet.
- **Matching:** the headline is added to the match embedding. Personality
  answers are passed to the AI-written match content (explanation, outreach
  draft) as icebreaker material, but are **not** part of the match score.

## Non-goals (this round)

- Experience entries / work history (dropped: tedious to fill in).
- Importing from LinkedIn (API doesn't expose experience; scraping is brittle).
  The LinkedIn and GitHub URLs are typed in by hand.
- Reading the resume's contents for matching. The resume is stored and shown,
  not parsed. (Possible later, to make up for having no experience entries.)
- A browse/search directory of students, and peer-to-peer connections
  between students. These are a separate project, planned after the dashboard.
- Changes to mentor profiles (`/mentor/profile` stays as is).

## Anti-goals

- Leaking the matching answers. Onboarding promises "Professors never see your
  answers". **Other viewers see only the public part** (photo, name, headline,
  personality prompts, resume, LinkedIn, GitHub). The matching answers are
  visible only to the owner.
- Personality answers changing who you're matched with. "My ideal lab vibe is
  chaotic" must not move a professor up or down the list.
- Re-running matching on every small edit. Regeneration takes ~a minute and
  spends Groq quota.
- Breaking existing links/flows that point at `/onboarding`.

## Decided

- **Routes**
  - `/profile` — your own profile, editable. Replaces `/onboarding` as the
    "Profile" nav target.
  - `/profile/[id]` (or equivalent) — someone else's profile, read-only, only
    the public part. Requires sign-in.
  - `/onboarding` redirects to `/profile` (keep the URL working; email
    confirmation links for existing signups point at it).
  - Signup's post-confirm destination becomes `/profile`.
- **Who sees what (decided by the student):** every signed-in user (students
  and mentors) sees the public part, resume included. Sign-up isn't restricted
  to a school domain, so this is close to public. The resume upload field says
  so ("Anyone signed in to Links can see this, so leave off your phone number
  and home address").
- **Matching**
  - `toEmbeddingText` in `lib/matching.ts` gains the headline.
  - The prompt in `lib/generate-match-content.ts` gets the headline and the
    personality prompts + answers, so outreach drafts can open with something
    personal.
  - Saving the matching questions re-runs `generateMatchesForStudent`. Saving
    anything else does not; headline and personality changes are picked up on
    the next regeneration.
- **Student-only.** Mentor accounts keep their existing profile page.
- **Files** (photo, resume) live in Supabase Storage.
- **Visual style** follows the existing editorial design in `app/globals.css`
  (serif headings, hairlines, one accent). Layout reference: header row with
  photo + name + headline + links (LinkedIn, GitHub, resume); personality
  prompts below; matching answers as a separate section only the owner sees.

## Calls I made (Claude) — check these

- Photo stays on the profile.
- Mentors get a link from a request on their dashboard to the student's
  profile — that's the main way someone else will reach a student profile in
  this round.
- The reminder pop-up shows once per account (remembered server-side, so it
  doesn't reappear on another device); "Later" dismisses it and the banner
  takes over.
- **Re-matching replaces stale matches.** When regeneration runs, professors
  that fell out of the new top 5 are removed from `match_recommendations`,
  except ones the student saved (`saved_at`) or contacted (`interactions`).
  Today's code only upserts, which was fine when matching ran once.
- **Regeneration after an edit runs in the background** (the `after()` pattern
  already used in `app/api/contacts/route.ts`) so saving doesn't block for a
  minute. The first-ever save of the matching questions still waits, so the
  student lands on matches that already exist, as today.
- **Don't trust the current `student_profiles` RLS.** It isn't in the repo.
  The first build step records the live table definition and policies (for
  `student_profiles` and `match_recommendations`) in a catch-up migration.
  The public profile fields go somewhere whose read policy is separate from
  the matching answers, so a broad policy on one can't expose the other.

## Constraints

- Next.js 16 (`next@16.3.6`) — breaking changes from older versions; read
  `node_modules/next/dist/docs/` before writing code. Route protection lives
  in `proxy.ts` + `utils/supabase/middleware.ts`; `/profile` must be added to
  both protected-path lists.
- Supabase with RLS. Existing migrations live in `supabase/migrations/` and are
  run by hand in the SQL editor; new migrations must be safe to re-run
  (`if not exists` / `drop policy if exists`), like the existing ones.
- Matching uses local embeddings (`@xenova/transformers`, 384-dim) and Groq's
  free tier (30 req/min) — keep regeneration sequential as today.

## Left to the builder

- Table layout (new columns vs a separate public profile table), chosen so
  other users can read the public fields without reading the private ones.
- How personality answers are stored (e.g. question key + answer), and what
  happens to an answer if its question is later removed from the list.
- Where name comes from (`profiles` table / auth `full_name` metadata) and
  whether it's editable here.
- Storage bucket names, policies, size limits, accepted file types; URL
  validation for LinkedIn/GitHub.
- Exact edit UX, empty states, and how the matching section looks before vs
  after it's answered.
- Which pages show the banner (at minimum: profile, matches, mentors).
