# Agent App Piece 1: Brain Dump → Plans Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A student types a messy brain dump at `/capture`; Links turns it into career plans and ideas with small steps scheduled to fit each day's real free time, tied to saved contacts, folds later dumps into existing plans, and logs every change with Undo at `/activity`.

**Architecture:** New Supabase tables (captures, plans, steps, tradeoffs, activity, settings, calendar tokens) with owner-only RLS. Pure, unit-tested logic in `lib/agent/` (dates, capacity, scheduler, prompt + response validation, contact picking, undo rules). The scheduler is plain code that runs after every change and on Plans page load, so the AI never decides what fits in a day. Groq writes the plan JSON; Google Calendar (optional) supplies free/busy only.

**Tech Stack:** Next.js 16.3 App Router (server components, server actions, route handlers), Supabase (Postgres + RLS, `@supabase/supabase-js` for a server-only admin client), Groq `openai/gpt-oss-120b`, local embeddings (`lib/embeddings.ts`), Google Calendar FreeBusy API via plain `fetch`.

**Spec:** `docs/superpowers/specs/2026-10-20-agent-brain-dump-design.md`

## Global Constraints

- **No git.** Do not branch, commit or push. Leave all changes uncommitted, and never commit this plan or the spec. The owner handles git.
- Read the relevant guide in `node_modules/next/dist/docs/` before using any Next API (route handlers, `redirect`, `cookies`, `searchParams` as a Promise, `after`). Next 16 differs from training data.
- New routes `/capture`, `/plans`, `/activity`, `/calendar` go in **both** `proxy.ts` `matcher` and `protectedPaths` in `utils/supabase/middleware.ts`.
- Migration: one file, run by hand in the Supabase SQL editor, safe to re-run (`create table if not exists`, `drop policy if exists`). Every table except `agent_calendar_connections` gets owner-only select/insert/update/delete policies for `authenticated` (`user_id = auth.uid()`).
- `agent_calendar_connections`: RLS on, **no policies**. Read and written only through `utils/supabase/admin.ts` (service role), always filtered by the signed-in user's id. Tokens never reach a client component.
- Files in `lib/agent/` that are unit-tested must not import from `@/…`. Use relative imports with `.ts` extensions, like `lib/dashboard.ts`.
- All dates are Pacific (`America/Los_Angeles`) calendar days as `'YYYY-MM-DD'` strings.
- The schedule window is 14 days starting today. Waking window is 08:00–22:00 Pacific. Calendar capacity = `floor(free minutes × 0.25)`, capped at 180 minutes a day.
- Step length: 10–60 minutes (the AI is asked for 20–45; anything else is clamped).
- At most one step per plan per day. Steps within a plan are scheduled in order.
- Links never deletes a plan or step. The AI response format has no delete operation, and the apply code has no delete path except Undo of something Links itself created.
- The free/busy scope is `https://www.googleapis.com/auth/calendar.freebusy`. If Google rejects that scope, **stop and ask the owner**. Never fall back to a broader calendar scope.
- One `spendCredit(supabase)` per brain dump, before calling Groq (`lib/credits.ts`; free while credits are paused).
- Copy, verbatim:
  - Capture heading "What's on your mind?", label "Everything you're juggling. Messy is fine.", button "Make my plan".
  - Hours question "About how many hours a day do you have for this?".
  - Undo blocked: "You've changed this since".
  - Overfull day: "This day is over your time".
  - Unscheduled steps: "Later".
  - Trade-off buttons "Pause it" / "Keep both".
- Trust rules panel on `/activity`, verbatim:
  - **Links can do on its own:** "Read your plans and people", "Create and edit plans and steps", "Suggest a pause".
  - **Never:** "Send a message for you", "Read your calendar's events or your email (it only sees when you're busy)", "Invent a person or a deadline".
- Style: existing classes in `app/globals.css` (`page`, `title`, `eyebrow`, `rows`, `row`, `btn`, `btn-outline`, `btn-sm`, `field`, `input`, `alert`, `notice`, `meta`, `accent`, `aside`, `dialog`). Match the comment density and naming of surrounding files.

## Review Focus

1. **Groq returns junk, times out, or the server action fails mid-way.** The capture text is already saved (`status 'failed'`). The student sees "Couldn't make your plan. Your text is saved; try again." with a retry button that resubmits that capture. No partial changes are applied: parse fully before writing. Test in Task 3.
2. **Migration not run yet.** `/capture`, `/plans` and `/activity` show a "Setup needed" notice naming `supabase/migrations/20261023000000_agent_plans.sql` (use `isMissingTable`), not a crash. Covered in Tasks 7–9.
3. **A step longer than any day's capacity, or 0 hours a day.** It's never placed and shows "Later". It never lands on a day that can't hold it. Test in Task 2.
4. **Late-night dump and the DST change.** A dump at 11:30 PM Pacific counts as that Pacific day, not UTC tomorrow. Capacity on 2026-11-01 (the clocks go back) is still computed over 08:00–22:00 local. Test in Task 1.
5. **Revoked or expired Google connection.** Token refresh fails, so Links falls back to `daily_minutes` if it's set, otherwise asks the hours question, and shows "Reconnect Google Calendar". It never errors the page. Test in Task 6 (`capacityFor` with a failing busy fetcher).

---

### Task 1: Schema, admin client, dates and capacity

**Files:**
- Create: `supabase/migrations/20261023000000_agent_plans.sql`
- Create: `utils/supabase/admin.ts`
- Create: `lib/agent/dates.ts`, `lib/agent/capacity.ts`, `lib/agent/capacity.test.ts`

**Interfaces — Produces:**
- Tables (all with `user_id uuid not null references auth.users(id) on delete cascade`, `created_at timestamptz default now()`):
  - `agent_settings(user_id pk, daily_minutes int null check (daily_minutes between 0 and 720), updated_at)`
  - `agent_calendar_connections(user_id pk, refresh_token text not null, access_token text, expires_at timestamptz, needs_reconnect boolean not null default false, connected_at)`. RLS on, no policies.
  - `agent_captures(id uuid pk default gen_random_uuid(), user_id, text text not null check (char_length(text) <= 5000), status text not null default 'pending' check (status in ('pending','done','failed')), created_at)`
  - `agent_plans(id pk, user_id, kind text check (kind in ('career','idea')), title text not null, done_looks_like text, deadline date, deadline_suggested boolean not null default false, paused boolean not null default false, paused_until date, position int not null default 0, created_by text not null check (created_by in ('links','student')), student_edited_at timestamptz, created_at, updated_at)`
  - `agent_steps(id pk, user_id, plan_id uuid not null references agent_plans(id) on delete cascade, title text not null, minutes int not null check (minutes between 10 and 240), day date, pinned boolean not null default false, done_at timestamptz, contact_id uuid, needs_person text, position int not null default 0, created_by text check (created_by in ('links','student')), student_edited_at timestamptz, created_at, updated_at)`. `contact_id` has no FK, because `network_contacts` isn't defined in the repo. Reads join it manually, and a missing contact shows as no contact.
  - `agent_tradeoffs(id pk, user_id, plan_id uuid references agent_plans(id) on delete cascade, suggestion text not null, pause_until date, status text not null default 'open' check (status in ('open','paused','kept')), created_at)`
  - `agent_activity(id pk, user_id, capture_id uuid references agent_captures(id) on delete set null, action text not null check (action in ('created_plan','added_step','updated_plan','updated_step','marked_done','suggested_pause')), plan_id uuid, step_id uuid, summary text not null, before jsonb, undone_at timestamptz, created_at)`. No FKs on `plan_id` and `step_id`, so log rows outlive deletes.
- `createAdminClient(): SupabaseClient` in `utils/supabase/admin.ts`. Uses `createClient` from `@supabase/supabase-js` with `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`, `auth: { persistSession: false }`. Header comment: server-only, bypasses RLS, always filter by user id.
- `lib/agent/dates.ts`:
  - `pacificToday(now?: Date): string`
  - `addDays(day: string, n: number): string`
  - `windowDays(today: string, n = 14): string[]`
  - `pacificInstant(day: string, hhmm: string): Date` (the UTC instant of that Pacific wall-clock time; DST-correct)
- `lib/agent/capacity.ts`:
  - `export type Capacity = Record<string, number>`
  - `FREE_TIME_SHARE = 0.25`, `MAX_DAILY_MINUTES = 180`
  - `capacityFromDailyMinutes(dailyMinutes: number, today: string): Capacity` (every day in the window = `dailyMinutes`)
  - `capacityFromBusy(busy: { start: string; end: string }[], today: string): Capacity` (per day: free = 840 minus busy overlap with 08:00–22:00 Pacific, merging overlapping busy blocks; value = `min(180, floor(free × 0.25))`)

- [ ] **Step 1: Write `lib/agent/capacity.test.ts`**

```ts
test('pacificToday uses the Pacific day late at night', () => {
  assert.equal(pacificToday(new Date('2026-10-21T06:30:00Z')), '2026-10-20') // 11:30pm PDT
})
test('windowDays spans 14 days from today', () => {
  const days = windowDays('2026-10-20')
  assert.equal(days.length, 14); assert.equal(days[0], '2026-10-20'); assert.equal(days[13], '2026-11-02')
})
test('pacificInstant is DST-correct', () => {
  assert.equal(pacificInstant('2026-10-20', '08:00').toISOString(), '2026-10-20T15:00:00.000Z') // PDT
  assert.equal(pacificInstant('2026-11-02', '08:00').toISOString(), '2026-11-02T16:00:00.000Z') // PST
})
test('daily minutes fill every day of the window', () => {
  const c = capacityFromDailyMinutes(90, '2026-10-20')
  assert.equal(Object.keys(c).length, 14); assert.equal(c['2026-10-27'], 90)
})
test('a free day gives the capped share', () => {
  assert.equal(capacityFromBusy([], '2026-10-20')['2026-10-20'], 180) // 840*0.25=210 → cap 180
})
test('a 9-to-5 day leaves a quarter of the remaining waking time', () => {
  const busy = [{ start: '2026-10-20T16:00:00Z', end: '2026-10-21T00:00:00Z' }] // 9am–5pm PDT
  assert.equal(capacityFromBusy(busy, '2026-10-20')['2026-10-20'], 90) // (840-480)*0.25
})
test('overlapping busy blocks are not double-counted', () => {
  const busy = [
    { start: '2026-10-20T16:00:00Z', end: '2026-10-20T20:00:00Z' },
    { start: '2026-10-20T18:00:00Z', end: '2026-10-20T22:00:00Z' },
  ] // 9am–3pm PDT total = 360
  assert.equal(capacityFromBusy(busy, '2026-10-20')['2026-10-20'], 120)
})
test('capacity on the DST change day still uses 8am–10pm local', () => {
  assert.equal(capacityFromBusy([], '2026-10-20')['2026-11-01'], 180)
  const busy = [{ start: '2026-11-01T16:00:00Z', end: '2026-11-02T06:00:00Z' }] // 8am–10pm PST
  assert.equal(capacityFromBusy(busy, '2026-10-20')['2026-11-01'], 0)
})
```

- [ ] **Step 2: Run `npm test`.** Expected: FAIL, because the module isn't found.
- [ ] **Step 3: Implement `lib/agent/dates.ts` and `lib/agent/capacity.ts`.** For `pacificInstant`, get the Pacific offset for that date via `Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', timeZoneName: 'shortOffset' })` and build the instant from it.
- [ ] **Step 4: Run `npm test`.** Expected: all tests PASS.
- [ ] **Step 5: Write the migration and `utils/supabase/admin.ts`.** Match the header style of `20261022000000_feedback.sql`: purpose, "Run once in the Supabase dashboard…", "Safe to re-run". The header also notes that `agent_calendar_connections` deliberately has no policies.
- [ ] **Step 6: Run `npx tsc --noEmit`.** Expected: no output.

### Task 2: The scheduler

**Files:**
- Create: `lib/agent/schedule.ts`, `lib/agent/schedule.test.ts`

**Interfaces:**
- Consumes: `Capacity` and `windowDays` from Task 1.
- Produces:
  - `export type SchedStep = { id: string; planId: string; planOrder: number; order: number; minutes: number; day: string | null; pinned: boolean; done: boolean; planActive: boolean }`
  - `schedule(steps: SchedStep[], capacity: Capacity, today: string): { days: Record<string, string | null>; overloaded: string[] }`. `days` has an entry for every not-done step id. `overloaded` lists days whose pinned (not done) minutes exceed capacity.
  - `isPlanActive(plan: { paused: boolean; paused_until: string | null }, today: string): boolean`. True if not paused, or if `paused_until` is set and `<= today`.

Rules, in this order:
1. Done steps are ignored.
2. Pinned steps keep their day, even a past one, and use up that day's capacity.
3. Unpinned steps of inactive plans get `null`.
4. Remaining unpinned steps are processed by `(planOrder, order)`. A step **keeps** its current day if that day is in the window, has room, has no other step of the same plan, and comes after the plan's previous step's day. Otherwise it goes to the earliest day meeting those conditions. If no day qualifies, it gets `null` ("Later").

- [ ] **Step 1: Write `lib/agent/schedule.test.ts`.** Each test uses `capacityFromDailyMinutes` and a small `step()` builder.
  - `'never puts more on a day than it holds'`: 5 × 30-minute steps from 5 plans with 60/day. No day's sum exceeds 60, and days 1 and 2 hold 2 steps each.
  - `'one step per plan per day, in order'`: one plan with 3 steps, 180/day. They land on days 0, 1 and 2, in order.
  - `'a step bigger than any day is Later'`: a 60-minute step with 30/day comes back `null`. With `dailyMinutes` 0, every step is `null`.
  - `'pinned steps stay put and use up the day'`: a pinned 60-minute step on day 0 with 60/day pushes an unpinned step to day 1.
  - `'pinned overfill is reported, not fixed'`: two pinned 45-minute steps on day 0 with 60/day. Both stay on day 0, and `overloaded` deep-equals `[day0]`.
  - `'overdue unpinned steps move forward'`: a step with `day` yesterday lands today.
  - `'pinned overdue steps stay overdue'`: a pinned step with `day` yesterday stays yesterday.
  - `'already placed steps are not reshuffled'`: run `schedule` twice, feeding the first result back as `day`. Results are equal.
  - `'paused plans get nothing; resumed plans come back'`: `isPlanActive({paused:true, paused_until:'2026-11-15'}, '2026-11-14')` is false, and on `'2026-11-15'` it's true. A step of an inactive plan is `null`.
  - `'past the 14-day window is Later'`: a plan with 20 steps at 180/day. Steps 15 through 20 are `null`.
- [ ] **Step 2: Run `npm test`.** Expected: FAIL.
- [ ] **Step 3: Implement `schedule` and `isPlanActive` in `lib/agent/schedule.ts`.**
- [ ] **Step 4: Run `npm test`.** Expected: PASS.

### Task 3: Prompt, response validation and contact picking

**Files:**
- Create: `lib/agent/plan-prompt.ts`, `lib/agent/plan-prompt.test.ts`

**Interfaces:**
- Produces:
  - `export type PromptPlan = { id: string; kind: 'career' | 'idea'; title: string; done_looks_like: string | null; deadline: string | null; paused: boolean; steps: { id: string; title: string; minutes: number; done: boolean }[] }`
  - `export type PromptContact = { id: string; full_name: string; role: string | null; company: string | null; met_context: string | null }`
  - `pickContacts(dump: string, dumpVector: number[] | null, contacts: (PromptContact & { vector: number[] | null })[], limit = 8, minScore = 0.2): PromptContact[]`. Takes every contact whose `full_name` (or first name of 3+ letters) appears in the dump, case-insensitive, then the top cosine scores at or above `minScore`, deduplicated, up to `limit`. Contacts with a null vector can only come in by name. Cosine is computed inline (no `@/` import).
  - `export type Starter = { role: string | null; when: string; profile: { major: string | null; research_interests: string[] | null; technical_skills: string[] | null; career_goals: string | null } | null }`. `role: null` means "No idea yet".
  - `buildPlanPrompt(input: { dump: string; today: string; dailyMinutes: number | null; plans: PromptPlan[]; contacts: PromptContact[]; starter?: Starter }): string`. With `starter`, the dump may be empty, and the prompt asks for exactly one new career plan of beginner steps (look at postings, add people already known, update the resume, book a mentor chat). It uses the profile fields when present. With `role: null`, the first steps explore roles rather than apply. The JSON shape and every rule below still apply. Tells the model to:
    - return JSON only, in the shape below;
    - make steps of 20–45 minutes;
    - reference only the listed contact ids and set `needs_person` when nobody fits;
    - never invent deadlines, and mark inferred ones `deadline_suggested: true`;
    - fold into existing plans by id, never deleting;
    - suggest at most one pause.
  - `export type PlanChanges = { newPlans: { ref: string; kind: 'career'|'idea'; title: string; done_looks_like: string | null; deadline: string | null; deadline_suggested: boolean }[]; planUpdates: { planId: string; title?: string; done_looks_like?: string | null; deadline?: string | null }[]; newSteps: { plan: string; title: string; minutes: number; contactId: string | null; needsPerson: string | null }[]; stepUpdates: { stepId: string; title?: string; minutes?: number; done?: true }[]; pauses: { plan: string; until: string; reason: string }[] }`. Here `plan` is a new plan's `ref` or an existing plan id.
  - `parsePlanResponse(raw: string, ctx: { today: string; planIds: Set<string>; stepIds: Set<string>; contactIds: Set<string> }): PlanChanges | null`

Model JSON shape (in the prompt verbatim):
```json
{"new_plans":[{"ref":"p1","kind":"career","title":"","done_looks_like":"","deadline":null,"deadline_suggested":false}],
 "plan_updates":[{"plan_id":"<existing id>","title":"","done_looks_like":"","deadline":null}],
 "new_steps":[{"plan":"p1 or <existing id>","title":"","minutes":30,"contact_id":null,"needs_person":null}],
 "step_updates":[{"step_id":"<existing id>","title":"","minutes":30,"done":true}],
 "pause_suggestions":[{"plan":"p1 or <existing id>","until":"YYYY-MM-DD","reason":""}]}
```

`parsePlanResponse` rules:
- Strip ```` ```json ```` fences like `lib/generate-network-content.ts` does, then parse. Unparseable input, or input missing every key, returns `null`.
- Unknown keys are ignored. Any `delete` field is ignored.
- Updates to unknown plan or step ids are dropped. A new step pointing at an unknown plan is dropped.
- A `contact_id` that isn't in `contactIds` becomes `null`, and the step is kept.
- `minutes` is clamped to 10–60; non-numbers become 30.
- Titles are trimmed to 140 characters; empty titles drop the item.
- Dates must be valid `YYYY-MM-DD` and `>= today`, otherwise `null`. A pause date that's invalid drops the pause.
- `kind` defaults to `'idea'`.
- Pauses are limited to 1.

- [ ] **Step 1: Write `lib/agent/plan-prompt.test.ts`.**
  - `'junk returns null'`: `parsePlanResponse('sorry, I cannot', ctx)` returns `null`.
  - `'fenced JSON parses'`.
  - `'invented contact ids are dropped, step kept'`.
  - `'updates to unknown ids are dropped'`.
  - `'minutes are clamped'`: 5 becomes 10, 120 becomes 60, `"x"` becomes 30.
  - `'past and malformed deadlines become null'`.
  - `'at most one pause'`.
  - `'a delete field does nothing'`.
  - `'pickContacts includes contacts named in the dump even without a vector'`.
  - `'pickContacts with no contacts returns []'`.
  - `'buildPlanPrompt lists contact ids and existing plan and step ids'`.
  - `'starter prompt includes the role, timing and profile career goals'`.
  - `'starter with no role asks for exploring first, and works with an empty dump and no profile'`.
- [ ] **Step 2: Run `npm test`.** Expected: FAIL.
- [ ] **Step 3: Implement `lib/agent/plan-prompt.ts`.**
- [ ] **Step 4: Run `npm test`.** Expected: PASS.

### Task 4: Undo rules

**Files:**
- Create: `lib/agent/undo.ts`, `lib/agent/undo.test.ts`

**Interfaces:**
- Produces:
  - `export type ActivityEntry = { id: string; action: 'created_plan'|'added_step'|'updated_plan'|'updated_step'|'marked_done'|'suggested_pause'; created_at: string; undone_at: string | null; before: Record<string, unknown> | null }`
  - `undoState(entry: ActivityEntry, target: { student_edited_at: string | null } | null): 'available' | 'edited' | 'gone' | 'done' | 'none'`. Returns `'done'` if already undone, and `'none'` for `suggested_pause`. Returns `'gone'` if the target was deleted, and `'edited'` if `target.student_edited_at > entry.created_at`.
  - `UNDO_EDITED = "You've changed this since"`

- [ ] **Step 1: Write the tests.** Cover each of the five return values, plus a student edit made **before** Links' change, which still returns `'available'`.
- [ ] **Step 2: Run `npm test`.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run `npm test`.** Expected: PASS.

### Task 5: Google Calendar connection

**Files:**
- Create: `lib/agent/google.ts`
- Create: `app/calendar/connect/route.ts`, `app/calendar/callback/route.ts`
- Modify: `proxy.ts`, `utils/supabase/middleware.ts` (add `/capture`, `/plans`, `/activity`, `/calendar`)

**Interfaces:**
- Consumes: `createAdminClient` (Task 1), `requireUser` (`lib/auth.ts`).
- Produces:
  - `GOOGLE_SCOPE = 'https://www.googleapis.com/auth/calendar.freebusy'`
  - `authUrl(state: string, redirectUri: string): string`. Uses `access_type=offline` and `prompt=consent`.
  - `exchangeCode(code: string, redirectUri: string): Promise<{ refresh_token: string; access_token: string; expires_at: string }>`
  - `getBusy(userId: string, timeMin: Date, timeMax: Date): Promise<{ start: string; end: string }[] | 'none' | 'reconnect'>`:
    - loads the connection with the admin client and refreshes the access token if it expires within 60 seconds;
    - calls `POST https://www.googleapis.com/calendar/v3/freeBusy` with `items: [{ id: 'primary' }]`, `timeZone: 'America/Los_Angeles'`;
    - returns `'none'` when there's no connection;
    - on a refresh or 401 failure, sets `needs_reconnect = true` and returns `'reconnect'`;
    - stores only the token fields, never response bodies.
- Routes:
  - `GET /calendar/connect` sets an httpOnly `cal_state` cookie (random UUID, 10 minutes) and redirects to `authUrl`. The redirect URI is `${origin}/calendar/callback`.
  - `GET /calendar/callback` checks `state` against the cookie, exchanges the code, upserts the row (`needs_reconnect=false`), then redirects to `/capture?calendar=connected`. On any failure it redirects to `/capture?error=Couldn't connect Google Calendar`.
- Env: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.

- [ ] **Step 1: Owner setup, done by hand.** Print these instructions for the owner and wait for confirmation that the env vars exist:
  1. Create a Google Cloud project.
  2. Enable the Google Calendar API.
  3. Set up the OAuth consent screen in Testing mode, add test users, and add the scope `.../auth/calendar.freebusy`.
  4. Create a Web OAuth client with redirect URIs `http://localhost:3000/calendar/callback`, the production domain's `/calendar/callback`, and any preview domain to be tested.
  5. Add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` to `.env.local` and Vercel.
  6. Confirm `SUPABASE_SERVICE_ROLE_KEY` is set in Vercel.
- [ ] **Step 2: Implement `lib/agent/google.ts` and the two routes. Add the four paths to `proxy.ts` and the middleware.**
- [ ] **Step 3: Run `npx tsc --noEmit && npm run lint`.** Expected: clean.
- [ ] **Step 4: Manual check.** Visit `/calendar/connect`, approve, and land on `/capture?calendar=connected`. In the Supabase table editor, the row exists. A query with the browser key (`supabase.from('agent_calendar_connections').select()` in a client page or the REST URL) returns `[]`.

### Task 6: Brain dump run, apply, reschedule

**Files:**
- Create: `lib/agent/reschedule.ts`, `lib/agent/brain-dump.ts`, `lib/agent/apply.ts`
- Modify: `lib/agent/capacity.ts`, `lib/agent/capacity.test.ts` (add the pure `capacityFor`)

**Interfaces:**
- Consumes: Tasks 1–5, `embed` (`lib/embeddings.ts`), `parseVector` (`lib/similarity.ts`), `spendCredit` / `OUT_OF_CREDITS` (`lib/credits.ts`), Groq as in `lib/rewrite-draft.ts` (temperature 0.4).
- Produces:
  - `capacityFor(settings: { daily_minutes: number | null } | null, busy: { start: string; end: string }[] | 'none' | 'reconnect', today: string): { capacity: Capacity | null; reconnect: boolean }`. This is pure. Busy blocks win; `'none'` or `'reconnect'` falls back to `daily_minutes`; with neither, `capacity: null`, which means ask the hours question.
  - `rescheduleUser(supabase: SupabaseClient, userId: string): Promise<{ needsHours: boolean; reconnect: boolean; overloaded: string[] }>`. Loads settings, busy (`getBusy` over the window), plans and steps; runs `schedule`; updates `day` only on steps whose value changed. When the capacity is `null`, it leaves days untouched and returns `needsHours: true`.
  - `applyChanges(supabase, userId, captureId: string, changes: PlanChanges, before: { plans: Map<string, Row>; steps: Map<string, Row> }): Promise<void>`. Inserts and updates rows with `created_by: 'links'`, and writes one `agent_activity` row per change, with `before` holding the previous values of exactly the fields changed. Pauses become `agent_tradeoffs` rows (status `'open'`) plus a `suggested_pause` activity row, but only when `rescheduleUser` afterwards leaves at least one active-plan step `null`. Otherwise the tradeoff is dropped.
  - `runBrainDump(supabase, userId, text: string, opts?: { captureId?: string; starter?: Starter }): Promise<{ ok: true } | { ok: false; error: string; captureId: string }>`:
    1. Insert a capture (`status 'pending'`), or reuse `opts.captureId` on a retry. A starter run stores a readable capture text such as "Starter plan · role: No idea yet · by: this summer", so it shows in Recent captures and can be retried.
    2. Call `spendCredit`; if it's false, mark the capture failed and return `OUT_OF_CREDITS`.
    3. Load plans, steps and contacts (`network_contacts`: `id, full_name, role, company, met_context, contact_embedding`).
    4. `embed(text)`, then `pickContacts`.
    5. `buildPlanPrompt` (passing `opts.starter`), then Groq, then `parsePlanResponse`.
    6. `null` → mark the capture failed and return the Review Focus #1 message.
    7. `applyChanges`, then `rescheduleUser`, then mark the capture `'done'`.

- [ ] **Step 1: Add `capacityFor` tests to `lib/agent/capacity.test.ts`.**
  - Busy blocks win over `daily_minutes`.
  - `'none'` with 60 minutes gives 60 a day.
  - `'reconnect'` with 60 minutes gives 60 a day and `reconnect: true`.
  - `'reconnect'` with no settings gives `capacity: null` and `reconnect: true`.
  - No settings and `'none'` gives `capacity: null`.
- [ ] **Step 2: Run `npm test`.** Expected: FAIL.
- [ ] **Step 3: Implement `capacityFor` in `lib/agent/capacity.ts`.** It stays pure; `rescheduleUser` in `reschedule.ts` may use `@/` imports.
- [ ] **Step 4: Run `npm test`.** Expected: PASS.
- [ ] **Step 5: Implement `apply.ts` and `brain-dump.ts`.** All parsing happens before the first write, so a parse failure writes nothing but the capture status.
- [ ] **Step 6: Run `npx tsc --noEmit && npm run lint`.** Expected: clean.

### Task 7: Capture page

**Files:**
- Create: `app/capture/page.tsx`, `app/capture/actions.ts`, `app/calendar/actions.ts`, `components/AgentTabs.tsx`

**Interfaces:**
- Consumes: `runBrainDump`, `rescheduleUser`, `isMissingTable`, `SubmitButton`, `AppNav`.
- Produces:
  - `AgentTabs({ active }: { active: 'capture' | 'plans' | 'activity' })`: a secondary link row (Capture · Plans · Activity) under `AppNav`, shown on all three agent pages.
  - Server action `makePlan(formData)` takes `text`, optional `daily_hours`, and optional `capture_id` (for a retry). Steps:
    1. Validate text: trim it; empty fails with "Write something first"; over 5000 characters fails with "That's a lot. Keep it under 5,000 characters".
    2. If `daily_hours` is given, upsert `agent_settings.daily_minutes = round(hours × 60)`, clamped to 0–720.
    3. Call `runBrainDump`.
    4. On success, redirect to `/plans`. On failure, redirect to `/capture?error=…&retry=<captureId>`.
  - `makeStarterPlan(formData)` takes `role` (empty or an "No idea yet" checkbox gives `null`), `when` (select: "This summer", "Within 6 months", "Within a year", "Not sure") and optional `daily_hours`. It upserts hours like `makePlan`. It reads `student_profiles` (`major, research_interests, technical_skills, career_goals`, by `user_id`; missing table or row gives `profile: null`), calls `runBrainDump(supabase, userId, '', { starter })`, and redirects like `makePlan`. A retry of a starter capture re-runs it with the same starter answers parsed back from the capture text.
  - `setDailyHours(formData)`: a server action that upserts settings and calls `rescheduleUser`. Task 8 reuses it.
  - `disconnectCalendar()` in `app/calendar/actions.ts`: deletes the connection row with the admin client, then calls `rescheduleUser`.

The page:
- Uses the spec copy.
- When the student has neither `daily_minutes` nor a calendar connection, it shows the hours question as a required number field (step 0.5, 0–12) inside the form, with a "Connect Google Calendar" link to `/calendar/connect` beside it.
- Shows "Calendar connected · Disconnect" when connected, and "Reconnect Google Calendar" when `needs_reconnect` is set.
- Lists recent captures: the latest 5, first 60 characters and `timeAgo`.
- Under the textarea, a "Not sure where to start?" link to `/capture?start=1`. That view replaces the textarea with the three questions (role text + "No idea yet" checkbox, the `when` select, and the hours field only if hours aren't known yet) and a "Make my starter plan" button posting to `makeStarterPlan`.
- On `?retry=`, shows a "Try again" button that resubmits that capture's text and id.
- Shows the migration notice if the tables are missing.
- The submit button shows a pending label such as "Making your plan…" (check `components/SubmitButton.tsx` for how).

- [ ] **Step 1: Implement the page, actions and `AgentTabs`.**
- [ ] **Step 2: Run `npx tsc --noEmit && npm run lint`.** Expected: clean.
- [ ] **Step 3: Manual check with `npm run dev`:**
  - An empty submit shows the error.
  - The hours question appears for a new user.
  - The mockup's dump text ("Interning at the Chancellor's Office, three classes, LeetCode most days…") produces plans and lands on `/plans`.
  - With `GROQ_API_KEY` set to a bad value, the dump shows the retry message and the capture is listed.
  - A new user with no profile answers chooses "Not sure where to start?", ticks "No idea yet", picks "This summer", and gets one career plan whose first steps are about exploring roles.

### Task 8: Plans page and manual edits

**Files:**
- Create: `app/plans/page.tsx`, `app/plans/actions.ts`

**Interfaces:**
- Consumes: `rescheduleUser`, `isPlanActive`, `setDailyHours`, `AgentTabs`.
- Produces server actions. Each one sets `student_edited_at = now()` on the row it changes, calls `rescheduleUser`, then `revalidatePath('/plans')` and redirects to `/plans?plan=<id>`:
  - `toggleStepDone(stepId)`
  - `updateStep(formData: step_id, title, minutes, day)`. A non-empty day sets `pinned = true`; an empty day sets `pinned = false` and `day = null`.
  - `addStep(formData: plan_id, title, minutes, day?)`, with `created_by 'student'`.
  - `deleteStep(stepId)`
  - `updatePlan(formData: plan_id, title, done_looks_like, deadline)`. Clears `deadline_suggested` when the deadline is edited.
  - `pausePlan(formData: plan_id, until?)` and `resumePlan(planId)`
  - `deletePlan(formData: plan_id, confirm)`. This requires `confirm === 'delete'` from a confirm dialog that uses the existing `dialog` style.
  - `resolveTradeoff(formData: tradeoff_id, choice: 'pause' | 'keep')`. `'pause'` sets the plan to paused until `pause_until`; both choices set the tradeoff status.

The page:
- Runs `rescheduleUser` on load, before reading the steps.
- Left column: plans grouped **Career** / **Ideas**, each with "n of m steps". Paused plans are greyed and show "Paused until <date>".
- Main area: the selected plan (`?plan=`, defaulting to the first). Shows:
  - the deadline, with "(suggested)" if `deadline_suggested`;
  - "Done looks like";
  - an open tradeoff card with "Pause it" / "Keep both";
  - the numbered steps, each with its day (a weekday name if within 7 days, otherwise the date), "Later" when `null`, "Overdue" when the day is past, "This day is over your time" when the day is in `overloaded`, and the contact's name, role and company or `needs_person`.
- Inline edit forms use `details`/`summary`, like the existing pages.
- A small "Your time" line shows either "From Google Calendar" or "N hours a day · change" (which uses `setDailyHours`).
- The empty state links to `/capture`.

- [ ] **Step 1: Implement.**
- [ ] **Step 2: Run `npx tsc --noEmit && npm run lint`.** Expected: clean.
- [ ] **Step 3: Manual check:**
  - Pin a step onto a full day: the warning shows and the step doesn't move on reload.
  - Pause a plan: its steps become "Later".
  - "Keep both" leaves the extra steps as "Later".
  - Deleting a plan needs the confirm.

### Task 9: Activity page, Undo, and the nav entry

**Files:**
- Create: `app/activity/page.tsx`, `app/activity/actions.ts`
- Modify: `components/AppNav.tsx` (new `Tab` value `'plans'`; a "Plans" link to `/plans` after "Mentors")

**Interfaces:**
- Consumes: `undoState`, `UNDO_EDITED`, `rescheduleUser`, `AgentTabs`.
- Produces `undoActivity(entryId)`. It re-checks `undoState` on the server, then:
  - `created_plan` deletes the plan (its steps cascade);
  - `added_step` deletes the step;
  - `updated_*` restores `before`;
  - `marked_done` clears `done_at`.

  It then sets `undone_at`, calls `rescheduleUser`, and revalidates.

The page:
- Lists runs grouped by capture, newest first. Each group's header is "Brain dump", the Pacific date and time, and the change count.
- Each row shows the summary, and on the right one of: an "Undo" button (`available`), `UNDO_EDITED` (`edited`), "Undone" (`done`), or nothing (`gone` / `none`).
- The side panel holds the trust rules, verbatim from Global Constraints.
- Shows the migration notice if the tables are missing.

- [ ] **Step 1: Implement.**
- [ ] **Step 2: Run `npx tsc --noEmit && npm run lint`.** Expected: clean.
- [ ] **Step 3: Manual check:**
  - Undo a created plan: it disappears from `/plans`.
  - Edit a step Links added, then return to `/activity`: that row shows "You've changed this since".
  - A second dump ("got the Datadog referral, also want to start running") updates the existing internship plan rather than duplicating it, adds a running idea, and logs each change.

### Task 10: Final verification

- [ ] **Step 1: Run `npm run lint && npx tsc --noEmit && npm test && npm run build`.** Expected: all pass. The build ends with a route list that includes `/capture`, `/plans`, `/activity`, `/calendar/connect` and `/calendar/callback`.
- [ ] **Step 2: Confirm the existing app is unchanged.** `/dashboard`, `/matches`, `/network`, `/mentors` and `/profile` render as before. The only difference is the new "Plans" nav link.
- [ ] **Step 3: Report to the owner.** Include the migration file to run, the env vars to add in Vercel (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`), and that nothing is committed.
