# Student Profile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `/onboarding` with a real student profile (photo, name, headline, 3 personality prompts, resume, LinkedIn, GitHub) visible to signed-in users, with the matching questions as a private section and a pop-up + banner reminder until they're answered.

**Architecture:** Public profile data lives in a new table `student_public_profiles` (any signed-in user can read; owner writes), separate from `student_profiles` (matching answers, untouched RLS). Files go in a private Storage bucket `profile-files` served through short-lived signed URLs. Pure logic (prompt list, validation, URL checks, stale-match pruning) lives in `lib/profile.ts` and is unit-tested with `node --test`.

**Tech Stack:** Next.js 16.3 App Router (server components + server actions), Supabase (Postgres RLS, Storage), Groq, local embeddings.

**Spec:** `docs/superpowers/specs/2026-10-19-student-profile-design.md`

## Global Constraints

- Read `node_modules/next/dist/docs/` for any Next API you touch (Next 16 differs from training data).
- Migrations are run by hand in the Supabase SQL editor and must be safe to re-run (`if not exists`, `drop policy if exists`, `on conflict do nothing`).
- Only `http(s)` links are stored/rendered (`httpUrl` in `lib/format.ts`).
- Personality answers: exactly the keys in `PROFILE_PROMPTS`, at most 3, each ≤150 characters, no duplicate keys.
- Resume: PDF only, ≤3 MB. Photo: JPEG/PNG/WebP, ≤2 MB. `serverActions.bodySizeLimit` = `'4mb'` (Vercel caps request bodies at 4.5 MB).
- Resume field copy, verbatim: "Anyone signed in to Links can see this, so leave off your phone number and home address."
- Matching answers are never read on `/profile/[id]`.
- Match code style: existing editorial CSS classes in `app/globals.css`; comment density like surrounding files.

## Review Focus

1. **Migration not run yet** → profile pages show a "Setup needed" notice naming the migration file instead of crashing (`isMissingTable`).
2. **Oversized or wrong-type upload** (a 10 MB PNG as resume) → redirect back to `/profile?error=…` with a readable message; nothing stored.
3. **Hand-crafted form posts** (4 prompts, unknown key, 500-char answer, `javascript:` GitHub URL) → rejected/trimmed by `parsePromptAnswers` / `httpUrl`; tests in Task 1.
4. **Viewing your own id at `/profile/[id]`, or a nonexistent id** → own id redirects to `/profile`; unknown id → `notFound()`.
5. **Regeneration removing a saved or contacted match** → `staleMatchIds` never returns those; tests in Task 1.

---

### Task 1: Schema, storage, and pure profile helpers

**Files:**
- Create: `supabase/migrations/20261020000000_student_public_profiles.sql`
- Create: `lib/profile.ts`, `lib/profile.test.ts`
- Modify: `package.json` (add `"test": "node --test lib/"`), `next.config.ts` (bodySizeLimit)

**Interfaces — Produces:**
- `PROFILE_PROMPTS: readonly { key: string; text: string }[]` — the 10 prompts from the spec, keys `problem, rabbit_hole, ask_me, summer_project, lab_vibe, working_on, learning, best_class, outside_school, lets_talk`.
- `type PromptAnswer = { key: string; answer: string }`
- `parsePromptAnswers(keys: string[], answers: string[]): PromptAnswer[]` — pairs index-wise, drops empty answers, unknown keys and duplicate keys, trims, cuts to 150 chars, keeps first 3.
- `promptText(key: string): string | null`
- `githubUrl(v: unknown): string | null` / `linkedinUrl(v: unknown): string | null` — `httpUrl` plus host must be `github.com` / `*.linkedin.com`.
- `staleMatchIds(rows: { id: string; opportunity_id: string; saved_at: string | null }[], keepOpportunityIds: Set<string>): string[]` — ids whose opportunity isn't kept and that aren't saved.
- `validateUpload(file: File | null, kind: 'photo' | 'resume'): { ok: true; ext: string } | { ok: false; error: string } | null` (null = no file chosen).
- Table `student_public_profiles(user_id uuid pk → profiles.id, full_name text, headline text, prompts jsonb default '[]', linkedin_url text, github_url text, photo_path text, resume_path text, reminder_seen_at timestamptz, updated_at timestamptz)`; RLS select to authenticated using true; insert/update own.
- Bucket `profile-files` (private); object paths `{user_id}/photo.{ext}`, `{user_id}/resume.pdf`; authenticated select; owner insert/update/delete where `(storage.foldername(name))[1] = auth.uid()::text`.
- Migration header comment records the live `student_profiles` columns (read via the REST schema on 2026-10-19). RLS policies on `student_profiles` could not be read without SQL access, so this migration does not touch that table.

`lib/profile.ts` must not import from `@/…` (keeps it runnable under `node --test`); duplicate the `httpUrl` regex there and have `lib/format.ts` keep its own.

- [ ] Write `lib/profile.test.ts` (`node:test`, `node:assert/strict`) covering: 4 valid answers → 3 kept; unknown key dropped; duplicate key keeps first; 200-char answer → 150; blank answer dropped; `githubUrl('javascript:alert(1)')` → null; `githubUrl('https://gitlab.com/x')` → null; `linkedinUrl('https://www.linkedin.com/in/a')` passes; `staleMatchIds` keeps saved rows and kept opportunities; `validateUpload` rejects 4 MB PDF, rejects PNG as resume, accepts small PDF, returns null for zero-size file.
- [ ] Run `npm test` — FAIL (module missing).
- [ ] Implement `lib/profile.ts`, migration, config, script.
- [ ] Run `npm test` — PASS.
- [ ] Commit `feat(profile): schema, storage and profile helpers`.

### Task 2: Matching uses headline, personality, and prunes stale matches

**Files:** Modify `lib/matching.ts`, `lib/generate-match-content.ts`

**Interfaces:**
- Consumes: `staleMatchIds`, `promptText`, `PromptAnswer`.
- Produces: `generateMatchesForStudent(studentProfileId, supabase)` unchanged signature; it now also loads `student_public_profiles.headline, prompts` by the profile's `user_id`, tolerating a missing table/row.

- [ ] `toEmbeddingText` adds `Headline: …` when present. Prompts are not added.
- [ ] `StudentProfileForPrompt` gains `headline: string | null` and `prompts: PromptAnswer[]`; prompt adds a "PERSONALITY (use at most one light touch in the email, never in the explanation)" block with `promptText(key): answer` lines.
- [ ] After upserting the new top 5, load existing rows for the student, compute `staleMatchIds` with kept = new opportunity ids ∪ contacted ids from `interactions`, delete those ids.
- [ ] `npm run lint && npx tsc --noEmit` clean. Commit `feat(matching): headline, personality and stale-match pruning`.

### Task 3: Own profile page and actions

**Files:**
- Create: `app/profile/page.tsx`, `app/profile/actions.ts`, `lib/student-profile.ts`
- Modify: `app/onboarding/page.tsx` (→ `redirect('/profile')`), delete `app/onboarding/actions.ts`, `app/login/actions.ts` (signup `next` → `/profile`), `components/AppNav.tsx` (Profile → `/profile`), `utils/supabase/middleware.ts` + `proxy.ts` (protect `/profile`), links in `app/matches/page.tsx` and `app/mentors/find/page.tsx` (`/onboarding` → `/profile#matching`)

**Interfaces — Produces (`lib/student-profile.ts`):**
- `type PublicProfile = { user_id; full_name; headline; prompts: PromptAnswer[]; linkedin_url; github_url; photo_path; resume_path; reminder_seen_at }` (nullable strings).
- `getPublicProfile(supabase, userId): Promise<{ profile: PublicProfile | null; missing: boolean }>` — `missing` true when the table doesn't exist.
- `signedFileUrls(supabase, profile): Promise<{ photoUrl: string | null; resumeUrl: string | null }>` — 1-hour signed URLs.

**Actions (`app/profile/actions.ts`, all `requireUser()` first, redirect to `/profile?error=…` on failure, `revalidatePath('/profile')`):**
- `saveAbout(formData)` — full_name (required), headline (≤120), linkedin_url, github_url, prompts (`prompt_key`/`prompt_answer` lists via `parsePromptAnswers`), optional `photo` and `resume` files (validated, uploaded with `upsert: true`, path saved). Does not re-run matching.
- `saveMatchingAnswers(formData)` — the old onboarding upsert into `student_profiles`. First save (no row before) awaits `generateMatchesForStudent` then redirects to `/matches`; later saves run it inside `after()` and redirect to `/profile?saved=matching`.

**Page:** header (photo or initials, name, headline, LinkedIn/GitHub/resume links), "About you" edit form (3 prompt selects + answer inputs, `maxLength={150}`), resume field with the verbatim warning, and a `#matching` section ("Only you see this") with the former onboarding fields prefilled from `student_profiles`. Missing table → setup notice naming the migration.

- [ ] Implement; `npm run lint && npx tsc --noEmit` clean.
- [ ] Commit `feat(profile): own profile page replaces onboarding`.

### Task 4: Public profile view and mentor link

**Files:** Create `app/profile/[id]/page.tsx`; modify `app/mentor/page.tsx` (student name links to `/profile/${r.student_user_id}`).

- [ ] Own id → `redirect('/profile')`; no row → `notFound()`. Renders only public fields. Nav: mentor nav if viewer has a mentor profile, else student nav.
- [ ] Lint/tsc clean; commit `feat(profile): read-only profile view`.

### Task 5: Reminder pop-up and banner

**Files:** Create `components/ProfileReminder.tsx` (server: decides), `components/ReminderDialog.tsx` (client: `<dialog>` opened on mount); add `dismissReminder()` to `app/profile/actions.ts`; render `<ProfileReminder />` under `AppNav` in `app/matches/page.tsx`, `app/mentors/page.tsx`, `app/mentors/find/page.tsx`, `app/network/page.tsx`, `app/profile/page.tsx`.

- Shown only when the user has no `student_profiles` row. Pop-up when `reminder_seen_at` is null (copy: "Tell us what you want to work on." / "Two minutes, and we can start matching you with professors." / buttons "Answer questions" → `/profile#matching`, "Later"). Both buttons call `dismissReminder` (upserts `reminder_seen_at = now()`). Otherwise the slim banner: "Your matches are waiting. Answer a few questions →". Silent if the table is missing.

- [ ] Implement; lint/tsc clean; commit `feat(profile): onboarding reminder pop-up and banner`.

### Task 6: Privacy copy, full verification

- [ ] `app/privacy/page.tsx`: add that profile photo, name, headline, personality answers, resume, LinkedIn and GitHub are visible to signed-in Links users; matching answers are not.
- [ ] `npm test && npm run lint && npm run build` all pass.
- [ ] Run dev server, load `/profile` and `/profile/<id>` (expect setup notice until the migration is run).
- [ ] Commit `docs(privacy): profile visibility`.
