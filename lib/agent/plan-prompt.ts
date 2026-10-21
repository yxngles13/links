// lib/agent/plan-prompt.ts — builds the Groq prompt for a brain dump and
// strictly validates the JSON that comes back. Pure: no `@/` imports, so it
// runs under `npm test`.

export type PromptPlan = {
  id: string
  kind: 'career' | 'idea'
  title: string
  done_looks_like: string | null
  deadline: string | null
  paused: boolean
  steps: { id: string; title: string; minutes: number; done: boolean }[]
}

export type PromptContact = {
  id: string
  full_name: string
  role: string | null
  company: string | null
  met_context: string | null
}

// `role: null` means "No idea yet".
export type Starter = {
  role: string | null
  when: string
  profile: {
    major: string | null
    research_interests: string[] | null
    technical_skills: string[] | null
    career_goals: string | null
  } | null
}

export type PlanChanges = {
  newPlans: {
    ref: string
    kind: 'career' | 'idea'
    title: string
    done_looks_like: string | null
    deadline: string | null
    deadline_suggested: boolean
  }[]
  planUpdates: {
    planId: string
    title?: string
    done_looks_like?: string | null
    deadline?: string | null
    deadline_suggested?: boolean
  }[]
  newSteps: { plan: string; title: string; minutes: number; contactId: string | null; needsPerson: string | null }[]
  stepUpdates: { stepId: string; title?: string; minutes?: number; done?: true }[]
  pauses: { plan: string; until: string; reason: string }[]
}

function cosine(a: number[], b: number[]): number {
  let dot = 0
  let na = 0
  let nb = 0
  const n = Math.min(a.length, b.length)
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0
}

// Contacts worth showing the model: anyone named in the dump (full name, or a
// first name of 3+ letters), then the closest by meaning, up to `limit`.
export function pickContacts(
  dump: string,
  dumpVector: number[] | null,
  contacts: (PromptContact & { vector: number[] | null })[],
  limit = 8,
  minScore = 0.2,
): PromptContact[] {
  const text = dump.toLowerCase()
  const picked = new Map<string, PromptContact>()
  const strip = (c: PromptContact & { vector: number[] | null }): PromptContact => ({
    id: c.id,
    full_name: c.full_name,
    role: c.role,
    company: c.company,
    met_context: c.met_context,
  })

  for (const c of contacts) {
    const full = c.full_name.trim().toLowerCase()
    const first = full.split(/\s+/)[0] ?? ''
    const firstRe = new RegExp(`\\b${first.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
    if ((full && text.includes(full)) || (first.length >= 3 && firstRe.test(text))) {
      picked.set(c.id, strip(c))
    }
  }

  if (dumpVector) {
    const scored = contacts
      .filter((c) => c.vector && !picked.has(c.id))
      .map((c) => ({ c, score: cosine(dumpVector, c.vector as number[]) }))
      .filter((x) => x.score >= minScore)
      .sort((a, b) => b.score - a.score)
    for (const { c } of scored) picked.set(c.id, strip(c))
  }

  return [...picked.values()].slice(0, limit)
}

const SHAPE = `{"new_plans":[{"ref":"p1","kind":"career","title":"","done_looks_like":"","deadline":null,"deadline_suggested":false}],
 "plan_updates":[{"plan_id":"<existing id>","title":"only fields you are changing"}],
 "new_steps":[{"plan":"p1 or <existing id>","title":"","minutes":30,"contact_id":null,"needs_person":null}],
 "step_updates":[{"step_id":"<existing id>","done":true}],
 "pause_suggestions":[{"plan":"p1 or <existing id>","until":"YYYY-MM-DD","reason":""}]}`

function starterBlock(s: Starter): string {
  const p = s.profile
  const lines = [
    `The student has no brain dump. Instead they want a career starter plan.`,
    s.role ? `Target role: ${s.role}` : `Target role: not decided yet.`,
    `Timing: ${s.when}`,
  ]
  if (p?.major) lines.push(`Major: ${p.major}`)
  if (p?.research_interests?.length) lines.push(`Research interests: ${p.research_interests.join(', ')}`)
  if (p?.technical_skills?.length) lines.push(`Technical skills: ${p.technical_skills.join(', ')}`)
  if (p?.career_goals) lines.push(`Career goals: ${p.career_goals}`)
  lines.push(
    `Return exactly one new career plan made of beginner steps: look at postings, add people they already know, update the resume, book a mentor chat.`,
  )
  if (!s.role) {
    lines.push(`Since they have no role in mind, the first steps explore roles (read about options, compare them) rather than apply.`)
  }
  return lines.join('\n')
}

export function buildPlanPrompt(input: {
  dump: string
  today: string
  dailyMinutes: number | null
  plans: PromptPlan[]
  contacts: PromptContact[]
  starter?: Starter
}): string {
  const plans = input.plans.length
    ? input.plans
        .map((p) => {
          const head = `- plan ${p.id} [${p.kind}] "${p.title}"` +
            (p.done_looks_like ? ` done looks like: ${p.done_looks_like}` : '') +
            (p.deadline ? ` deadline ${p.deadline}` : '') +
            (p.paused ? ' (paused)' : '')
          const steps = p.steps.map((s) => `    - step ${s.id} "${s.title}" ${s.minutes}min${s.done ? ' (done)' : ''}`)
          return [head, ...steps].join('\n')
        })
        .join('\n')
    : '(none yet)'
  const contacts = input.contacts.length
    ? input.contacts
        .map((c) => `- contact ${c.id}: ${c.full_name}` +
          [c.role, c.company].filter(Boolean).map((x) => `, ${x}`).join('') +
          (c.met_context ? ` (met: ${c.met_context})` : ''))
        .join('\n')
    : '(none)'

  return `You turn a student's brain dump into a small plan of steps. Today is ${input.today} (Pacific time).
${input.dailyMinutes ? `They have about ${input.dailyMinutes} minutes a day for this.` : 'They have not said how much time they have per day.'}

${input.starter ? starterBlock(input.starter) : `Brain dump:\n"""\n${input.dump}\n"""`}

Existing plans and steps:
${plans}

People they know (the only contacts you may reference):
${contacts}

Rules:
- Return JSON only, no prose, in exactly this shape:
${SHAPE}
- Make each step 20 to 45 minutes of concrete work.
- Reference only the contact ids listed above. If nobody listed fits a step that needs a person, set contact_id to null and describe the kind of person in needs_person.
- Never invent deadlines. Only use a date the student gave. If you infer one, set deadline_suggested to true.
- Fold new work into existing plans by their id when it fits. Never delete or remove a plan or step; to finish a step set done to true.
- Suggest at most one pause, and only when the student seems overloaded.
- In plan_updates and step_updates, include only the fields you are changing (title, done_looks_like, deadline, minutes, done). Never send null or empty values to clear a field.
- Omit any array you have nothing for (use []).`
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

// A real calendar day on or after `today`, else null.
function validDate(v: unknown, today: string): string | null {
  if (typeof v !== 'string' || !DATE_RE.test(v)) return null
  const d = new Date(`${v}T00:00:00Z`)
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v) return null
  return v >= today ? v : null
}

function title(v: unknown): string {
  return typeof v === 'string' ? v.trim().slice(0, 140) : ''
}

function optText(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim().slice(0, 500) : null
}

function minutes(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.min(60, Math.max(10, Math.round(v))) : 30
}

function list(v: unknown): Record<string, unknown>[] {
  return Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object') : []
}

const KEYS = ['new_plans', 'plan_updates', 'new_steps', 'step_updates', 'pause_suggestions']

// The most of each kind of change one answer may make; extras are dropped.
export const LIMITS = { newPlans: 8, planUpdates: 20, newSteps: 40, stepUpdates: 40 }

// Parses and validates the model's answer. Returns null when it isn't usable
// JSON or has none of the expected keys; never throws. A starter run has no
// student-given dates, so any deadline in it is marked suggested.
export function parsePlanResponse(
  raw: string,
  ctx: { today: string; planIds: Set<string>; stepIds: Set<string>; contactIds: Set<string>; starter?: boolean },
): PlanChanges | null {
  let parsed: Record<string, unknown>
  try {
    const v = JSON.parse(raw.trim().replace(/^```(?:json)?\s*|\s*```$/gi, '').trim())
    if (!v || typeof v !== 'object' || Array.isArray(v)) return null
    parsed = v
  } catch {
    return null
  }
  if (!KEYS.some((k) => k in parsed)) return null

  const out: PlanChanges = { newPlans: [], planUpdates: [], newSteps: [], stepUpdates: [], pauses: [] }
  const refs = new Set<string>()

  // A repeated ref keeps the first plan; steps naming it land there.
  for (const p of list(parsed.new_plans)) {
    if (out.newPlans.length >= LIMITS.newPlans) break
    const t = title(p.title)
    const ref = typeof p.ref === 'string' ? p.ref : ''
    if (!t || !ref || refs.has(ref)) continue
    refs.add(ref)
    const deadline = validDate(p.deadline, ctx.today)
    out.newPlans.push({
      ref,
      kind: p.kind === 'career' ? 'career' : 'idea',
      title: t,
      done_looks_like: optText(p.done_looks_like),
      deadline,
      deadline_suggested: deadline !== null && (ctx.starter === true || p.deadline_suggested === true),
    })
  }

  for (const p of list(parsed.plan_updates)) {
    if (out.planUpdates.length >= LIMITS.planUpdates) break
    if (typeof p.plan_id !== 'string' || !ctx.planIds.has(p.plan_id)) continue
    // Updates never clear a field: only non-empty, valid values are applied.
    const u: PlanChanges['planUpdates'][number] = { planId: p.plan_id }
    if (title(p.title)) u.title = title(p.title)
    const dlk = optText(p.done_looks_like)
    if (dlk) u.done_looks_like = dlk
    // The student didn't type this date here, so it reads as a suggestion
    // until they save it themselves.
    const dl = validDate(p.deadline, ctx.today)
    if (dl) {
      u.deadline = dl
      u.deadline_suggested = true
    }
    if (Object.keys(u).length > 1) out.planUpdates.push(u)
  }

  for (const s of list(parsed.new_steps)) {
    if (out.newSteps.length >= LIMITS.newSteps) break
    const t = title(s.title)
    const plan = typeof s.plan === 'string' ? s.plan : ''
    if (!t || !(refs.has(plan) || ctx.planIds.has(plan))) continue
    out.newSteps.push({
      plan,
      title: t,
      minutes: minutes(s.minutes),
      contactId: typeof s.contact_id === 'string' && ctx.contactIds.has(s.contact_id) ? s.contact_id : null,
      needsPerson: optText(s.needs_person),
    })
  }

  for (const s of list(parsed.step_updates)) {
    if (out.stepUpdates.length >= LIMITS.stepUpdates) break
    if (typeof s.step_id !== 'string' || !ctx.stepIds.has(s.step_id)) continue
    const u: PlanChanges['stepUpdates'][number] = { stepId: s.step_id }
    if (title(s.title)) u.title = title(s.title)
    if (typeof s.minutes === 'number' && Number.isFinite(s.minutes)) u.minutes = minutes(s.minutes)
    if (s.done === true) u.done = true
    if (Object.keys(u).length > 1) out.stepUpdates.push(u)
  }

  for (const s of list(parsed.pause_suggestions)) {
    const plan = typeof s.plan === 'string' ? s.plan : ''
    const until = validDate(s.until, ctx.today)
    if (!until || !(refs.has(plan) || ctx.planIds.has(plan))) continue
    out.pauses.push({ plan, until, reason: optText(s.reason) ?? '' })
    break
  }

  return out
}
