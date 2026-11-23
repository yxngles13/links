# Agent app, piece 1: brain dump → plans — design

Date: 2026-10-20

## Intent

Links is growing from a set of tools (research matches, network tracker,
mentors) into an agent that runs a student's internship search with them.
The mockups for the whole agent app live on the "Links — Mockups" design
canvas, https://claude.ai/artifact/DzptFEj6op8AEkx4DeDTRT (artboards 16–20:
Capture, Plans, Today, Activity, Main flow; files
`project/AgentCapture.dc.html`, `AgentPlans`, `AgentToday`,
`AgentActivity`, `AgentFlow`).

The full agent app is three pieces, built one at a time:

1. **Brain dump → plans** (this document).
2. Today: the daily screen, check-ins (Done / Move it / Too big), approvals.
3. The overnight agent run that reviews plans and drafts what's due.

This piece comes first because Today and the overnight run both need plans
and steps to exist.

A student types everything on their plate, messy, and Links turns it into
plans with small, scheduled steps, tied to real people in their network. The
student's biggest fear is a plan that looks impressive but is **unrealistic
for one day**: six steps due tomorrow while they're interning and taking
three classes. Realism is the main quality bar, more than clever advice.

## Goals

- **Capture page** (`/capture`): "What's on your mind?", one big textarea
  ("Everything you're juggling. Messy is fine."), a **Make my plan** button.
  Typing only.
- **Plans** (`/plans`): the dump sorted into two groups, **Career** and
  **Ideas** (personal projects), as in the Plans mockup. Left column lists
  plans with progress ("2 of 6 steps"); the main area shows the selected
  plan: title, optional deadline, a "done looks like" line, any trade-off
  suggestion, and the numbered step list.
- **Steps** are small (about 20–45 minutes each), each with an estimated
  duration and a scheduled day. A step may name a person from the student's
  saved contacts ("Ask Jordan for a resume review · Jordan Alvarez,
  Datadog"); if a step needs someone and nobody fits, it says so ("Find one
  person at Figma · nobody saved yet").
- **Realistic by construction:** each day's scheduled steps fit inside that
  day's available time, and work is spread across days instead of
  front-loaded. This is enforced in code after the AI responds (see
  Decided), never trusted to the AI alone.
- **Available time** comes from one of two sources:
  - **Google Calendar, optional, free/busy only.** Links sees busy blocks
    ("busy 9–5"), never event titles, attendees, descriptions or locations.
  - **Otherwise one question:** about how many hours a day the student has
    for this. Asked the first time they make a plan without a calendar;
    changeable later.
- **Trade-offs:** when the plans don't fit the available time, Links
  suggests pausing something ("Pause the coffee shop website until Nov 15?")
  with **Pause it** / **Keep both**, as in the mockup.
- **Second and later dumps fold into existing plans:** "got the Datadog
  referral, also want to start running" updates the internship plan and adds
  a "Start running" idea. Changes **apply right away**; each one can be
  undone.
- **Starting from nothing:** a student with nothing to dump gets a "Not
  sure where to start?" link on `/capture`. It asks three quick questions:
  what kind of role they're curious about ("No idea yet" is a valid
  answer), when they'd like to land something, and their hours a day
  (skipped if already known). Links also uses the profile's matching
  answers (major, interests, skills, career goals) when they exist, so the
  student doesn't repeat themselves. Links then makes a **starter career
  plan** of small beginner steps (look at postings, add people you already
  know, update the resume, book a mentor chat). With "No idea yet", the
  plan starts with exploring roles rather than applying. The same realism
  rules apply. After that it's an ordinary plan: later dumps fold into it,
  and Undo works the same.
- **Activity page** (`/activity`), a basic version of the Activity mockup:
  each brain-dump run listed newest first, with what Links did ("Created
  plans", "Added steps", "Updated a step", "Suggested a pause") and an
  **Undo** on each change. The side panel shows the trust rules (below).
- **Manual editing on the Plans page:**
  - steps: tick done, edit text / duration / day, delete, add your own;
  - plans: rename, change deadline or "done looks like", pause / resume,
    delete (with a confirm).

## Non-goals (this piece)

- Voice input ("Or just talk"). Comes later.
- The Today page, the Done / Move it / Too big check-ins, and approvals for
  messages or calendar items (piece 2).
- The overnight / morning agent run and "while you slept" (piece 3).
- Drafting outreach messages from plan steps (piece 2 or 3; the existing
  Groq drafting in the network tracker stays where it is).
- Writing anything to the student's calendar. Links only reads free/busy.
- Apple / Outlook calendars.
- Replacing `/dashboard` or `/onboarding`. The agent app sits **alongside**
  the current app; nothing existing changes behavior.
- AI credit limits. Credits are paused (`AI_CREDITS` unset, see
  `lib/credits.ts`); this piece should still call `spendCredit()` per brain
  dump so limits work again when credits are switched back on.

## Anti-goals

- **An unrealistic day.** If a generated schedule puts more on a day than
  the student has time for, the feature has failed even if everything else
  works.
- **Inventing people or deadlines.** A step may only name a person who
  exists in the student's `network_contacts`. A deadline only appears when
  the student wrote one or it's a widely known date they mentioned
  indirectly (e.g. "summer internships"), and in the latter case it's
  labelled as a suggestion, not a fact.
- **Silent loss.** When folding a new dump into existing plans, Links never
  deletes a plan or a step. It may add, update, mark done, or suggest
  removal or a pause, but a deletion only ever comes from the student.
- **Reading more of the calendar than free/busy.** No event details are
  requested, stored or sent to the AI.
- **Changing the existing app.** Current pages, nav and flows keep working
  exactly as now.

## Trust rules (shown on the Activity page)

- **Links can do on its own:** read your plans and people; create and edit
  plans and steps; split a step; suggest pauses.
- **Needs your OK:** nothing in this piece. (Later pieces: anything sent to
  a person, anything added to a calendar.)
- **Never:** send a message for you; read your calendar's events or your
  email (it only sees when you're busy); invent a person or a deadline.

The mockup's "Never: Read your calendar or email" line changes to reflect
free/busy.

## Decided

- **Alongside, not replacing.** New routes `/capture`, `/plans`,
  `/activity` (`/today` arrives in piece 2). Reuse the existing login
  (Supabase auth), contacts (`network_contacts`, shown as "People"), Groq
  client and editorial styles. Students reach the agent app from a single
  new entry point in the existing student nav (exact label left to the
  builder); `/dashboard` stays the home screen. Mentor accounts don't get
  it.
- **Calendar is optional and free/busy only.** Connected separately from
  sign-in (a "Connect Google Calendar" step), requesting the narrowest
  scope Google offers for free/busy. Google allows up to 100 test users
  before app verification, which is enough for testing.
- **Folding applies immediately, with Undo**, logged per change on the
  Activity page. Links never deletes.
- **Realism is enforced in code.** After the AI returns a plan, a
  deterministic step checks each day's total scheduled minutes against that
  day's available minutes and moves overflow to later days (or flags it as a
  trade-off) before anything is saved. This step is pure and unit-tested.
- **People come from retrieval over existing contacts.** The AI only sees,
  and may only reference, contacts retrieved from the student's own
  `network_contacts` (the existing `contact_embedding` vectors and
  `lib/similarity.ts` cover this). Any person reference the AI returns that
  isn't one of those contact ids is dropped before saving.
- **Realism wins over "Keep both"** (decided by the student). Keep both
  only means nothing gets paused: Links still never schedules a day past
  its available time, and pushes the extra steps later, past the 14-day
  window if needed (those stay unscheduled and are shown as "later").
  When the student puts steps on a full day by hand, the edit goes through
  (it's their call), the step is pinned, and the day shows a "this day is
  over your time" warning. Links itself never overfills a day.
- **Typing only** for capture.
- **Credits:** one `spendCredit()` per brain dump (free while paused).

## Calls I made (Claude) — check these

- The "hours a day" answer is one number used for every day, changeable on
  the Plans page. (Not per weekday.)
- With a calendar connected, a day's available time = its free time in a
  waking window (8 AM–10 PM Pacific), capped at a fixed share so Links
  doesn't fill every free minute. Exact cap left to the builder; it should
  be conservative.
- Steps are scheduled over the next 14 days at most; anything later stays
  unscheduled until a later dump or the overnight run.
- **The scheduler is pure code (no AI) and runs whenever plans change**
  (after a dump, after a manual edit, after Pause / Resume) and when the
  Plans page loads. So it needs no cron job.
- **What the scheduler may move:** only steps Links placed. A step whose
  day the student set by hand is **pinned** and never moved. Pinned steps
  still use up that day's time, so Links schedules around them.
- **Overdue steps:** an unfinished step whose day has passed is moved
  forward to the next day with room, unless it's pinned. A pinned overdue
  step stays put and is marked overdue, as in the mockup.
- **Pause until a date:** the plan resumes on its own once the date
  arrives. Because the scheduler runs on page load, its steps get scheduled
  then. Paused plans get no scheduled steps.
- Undo of a "created plan" removes the plan and its steps; undo of an
  update restores the previous values. Undo is offered only on changes
  Links made, not on the student's own manual edits.
- **Undo after the student has touched it:** once the student has edited
  something Links created or changed (ticked a step, edited a field), Undo
  for that change turns off and says "You've changed this since". Undo
  never throws away the student's own work.
- Every brain dump is stored as a capture and shown as "Recent captures"
  on the Capture page, as in the mockup.
- Timezone is Pacific, like the rest of the app.

## Constraints

- Next.js 16 (`next@16.3.6`), with breaking changes from older versions:
  read `node_modules/next/dist/docs/` before writing code. Protected routes
  are listed in both `proxy.ts` (`matcher`) and
  `utils/supabase/middleware.ts` (`protectedPaths`); the new routes go in
  both.
- Supabase with RLS. New tables go in a migration in `supabase/migrations/`,
  run by hand in the SQL editor, safe to re-run (`if not exists`,
  `drop policy if exists`), like the existing ones. Every new table is
  readable and writable only by its owner.
- `network_contacts` isn't defined in the repo's migrations (it was created
  directly in Supabase). Check the live definition before relying on its
  columns.
- Groq free tier (30 requests/min, model `openai/gpt-oss-120b`, as used in
  `lib/generate-network-content.ts`). The existing code parses JSON from the
  model's text and tolerates failures; the brain dump must not lose the
  student's text if generation fails (save the capture first).
- Google OAuth tokens are secrets: stored server-side only, never sent to
  the browser, and the student can disconnect (which deletes them). The
  token table has RLS on and **no** policies for `authenticated`, so the
  browser key can't read it. Server code reaches it with the existing
  server-only `SUPABASE_SERVICE_ROLE_KEY` (already in `.env.local`; it must
  also be set in Vercel), always filtered by the signed-in user's id.
- **Setup the owner does by hand** (the plan should list these as steps):
  create a Google Cloud project and OAuth client, enable the Calendar API,
  add test users, and register redirect URIs for `localhost:3000`, the
  production domain and Vercel previews. Then add `GOOGLE_CLIENT_ID` /
  `GOOGLE_CLIENT_SECRET` to `.env.local` and Vercel.
- Tests run with `node --test 'lib/**/*.test.ts'`. Pure logic (the realism
  step, contact-reference filtering, fold/undo bookkeeping) lives in `lib/`
  so it can be tested there.

## Left to the builder

- Table layout for captures, plans, steps, activity entries, availability
  settings and calendar tokens, including how Undo stores previous values.
- The AI prompt(s) and the JSON shape the model returns, including how
  existing plans are given to it when folding.
- How many contacts are retrieved for the prompt, and the similarity
  cutoff.
- Exact free-time cap, and how overflow is shown when even moving it can't
  fit within 14 days.
- Google OAuth details: library or plain fetch, callback route, token
  refresh, the exact free/busy scope.
- Loading state while the plan is generated, empty states, and error
  messages.
- Visual details, following the mockups and the existing editorial design
  in `app/globals.css`.
