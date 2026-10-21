// lib/agent/plan-prompt.test.ts — run with `npm test`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildPlanPrompt, parsePlanResponse, pickContacts } from './plan-prompt.ts'

const ctx = {
  today: '2026-10-20',
  planIds: new Set(['plan-1']),
  stepIds: new Set(['step-1']),
  contactIds: new Set(['c1']),
}

test('junk returns null', () => {
  assert.equal(parsePlanResponse('sorry, I cannot', ctx), null)
  assert.equal(parsePlanResponse('{"foo":1}', ctx), null)
})

test('fenced JSON parses', () => {
  const raw = '```json\n{"new_plans":[{"ref":"p1","kind":"career","title":" Land an internship ","done_looks_like":"offer","deadline":null,"deadline_suggested":false}],"new_steps":[{"plan":"p1","title":"Browse postings","minutes":30,"contact_id":null,"needs_person":null}]}\n```'
  const out = parsePlanResponse(raw, ctx)
  assert.ok(out)
  assert.equal(out.newPlans[0].title, 'Land an internship')
  assert.equal(out.newPlans[0].kind, 'career')
  assert.equal(out.newSteps[0].plan, 'p1')
})

test('invented contact ids are dropped, step kept', () => {
  const raw = JSON.stringify({
    new_steps: [
      { plan: 'plan-1', title: 'Email Sam', minutes: 30, contact_id: 'ghost', needs_person: null },
      { plan: 'plan-1', title: 'Email Ann', minutes: 30, contact_id: 'c1', needs_person: null },
    ],
  })
  const out = parsePlanResponse(raw, ctx)!
  assert.equal(out.newSteps.length, 2)
  assert.equal(out.newSteps[0].contactId, null)
  assert.equal(out.newSteps[1].contactId, 'c1')
})

test('updates to unknown ids are dropped', () => {
  const raw = JSON.stringify({
    plan_updates: [{ plan_id: 'nope', title: 'x' }, { plan_id: 'plan-1', title: 'New title' }],
    step_updates: [{ step_id: 'nope', done: true }, { step_id: 'step-1', done: true }],
    new_steps: [{ plan: 'unknown', title: 'Orphan', minutes: 30 }],
  })
  const out = parsePlanResponse(raw, ctx)!
  assert.equal(out.planUpdates.length, 1)
  assert.equal(out.planUpdates[0].planId, 'plan-1')
  assert.equal(out.stepUpdates.length, 1)
  assert.equal(out.stepUpdates[0].stepId, 'step-1')
  assert.equal(out.newSteps.length, 0)
})

test('minutes are clamped', () => {
  const raw = JSON.stringify({
    new_steps: [
      { plan: 'plan-1', title: 'a', minutes: 5 },
      { plan: 'plan-1', title: 'b', minutes: 120 },
      { plan: 'plan-1', title: 'c', minutes: 'x' },
    ],
  })
  const out = parsePlanResponse(raw, ctx)!
  assert.deepEqual(out.newSteps.map((s) => s.minutes), [10, 60, 30])
})

test('past and malformed deadlines become null', () => {
  const raw = JSON.stringify({
    new_plans: [
      { ref: 'a', title: 'past', deadline: '2026-10-01' },
      { ref: 'b', title: 'bad', deadline: '2026-13-45' },
      { ref: 'c', title: 'text', deadline: 'next friday' },
      { ref: 'd', title: 'ok', deadline: '2026-11-05', deadline_suggested: true },
    ],
  })
  const out = parsePlanResponse(raw, ctx)!
  assert.deepEqual(out.newPlans.map((p) => p.deadline), [null, null, null, '2026-11-05'])
  assert.equal(out.newPlans[3].deadline_suggested, true)
  assert.equal(out.newPlans[0].kind, 'idea')
})

test('at most one pause', () => {
  const raw = JSON.stringify({
    pause_suggestions: [
      { plan: 'plan-1', until: 'garbage', reason: 'bad date' },
      { plan: 'plan-1', until: '2026-11-01', reason: 'busy' },
      { plan: 'plan-1', until: '2026-11-02', reason: 'also busy' },
    ],
  })
  const out = parsePlanResponse(raw, ctx)!
  assert.equal(out.pauses.length, 1)
  assert.equal(out.pauses[0].until, '2026-11-01')
})

test('a delete field does nothing', () => {
  const raw = JSON.stringify({
    delete: ['plan-1'],
    plan_updates: [{ plan_id: 'plan-1', title: 'Kept', delete: true }],
  })
  const out = parsePlanResponse(raw, ctx)!
  assert.equal(out.planUpdates.length, 1)
  assert.equal(out.planUpdates[0].title, 'Kept')
  assert.equal('delete' in out, false)
  assert.equal('delete' in out.planUpdates[0], false)
})

const contacts = [
  { id: 'c1', full_name: 'Priya Natarajan', role: 'PM', company: 'Acme', met_context: null, vector: null },
  { id: 'c2', full_name: 'Jordan Lee', role: null, company: null, met_context: null, vector: [1, 0] },
  { id: 'c3', full_name: 'Sam Ortiz', role: null, company: null, met_context: null, vector: [0, 1] },
]

test('pickContacts includes contacts named in the dump even without a vector', () => {
  const out = pickContacts('coffee with priya next week', [0, 1], contacts)
  const ids = out.map((c) => c.id)
  assert.ok(ids.includes('c1'))
  assert.ok(ids.includes('c3')) // cosine 1 with the dump vector
  assert.ok(!ids.includes('c2')) // cosine 0, below minScore
  assert.equal('vector' in out[0], false)
})

test('pickContacts with no contacts returns []', () => {
  assert.deepEqual(pickContacts('anything', [1, 0], []), [])
})

const plans = [{
  id: 'plan-1', kind: 'career' as const, title: 'Internship', done_looks_like: null, deadline: null, paused: false,
  steps: [{ id: 'step-1', title: 'Update resume', minutes: 30, done: false }],
}]
const pcontacts = [{ id: 'c1', full_name: 'Priya Natarajan', role: 'PM', company: 'Acme', met_context: 'career fair' }]

test('buildPlanPrompt lists contact ids and existing plan and step ids', () => {
  const p = buildPlanPrompt({ dump: 'finish my essay', today: '2026-10-20', dailyMinutes: 60, plans, contacts: pcontacts })
  for (const s of ['c1', 'plan-1', 'step-1', 'finish my essay', '2026-10-20', 'JSON', '20', '45', 'needs_person', 'deadline_suggested']) {
    assert.ok(p.includes(s), `missing ${s}`)
  }
})

test('starter prompt includes the role, timing and profile career goals', () => {
  const p = buildPlanPrompt({
    dump: '', today: '2026-10-20', dailyMinutes: null, plans: [], contacts: [],
    starter: {
      role: 'Product Manager', when: 'summer 2027',
      profile: { major: 'CS', research_interests: ['HCI'], technical_skills: ['Python'], career_goals: 'Lead a product team' },
    },
  })
  for (const s of ['Product Manager', 'summer 2027', 'Lead a product team', 'new_plans']) {
    assert.ok(p.includes(s), `missing ${s}`)
  }
})

test('starter with no role asks for exploring first, and works with an empty dump and no profile', () => {
  const p = buildPlanPrompt({
    dump: '', today: '2026-10-20', dailyMinutes: null, plans: [], contacts: [],
    starter: { role: null, when: 'next year', profile: null },
  })
  assert.match(p, /explor/i)
  assert.ok(p.includes('next year'))
})

test('updates never clear or default a field, and empty updates are dropped', () => {
  const raw = JSON.stringify({
    plan_updates: [{ plan_id: 'plan-1', title: '', done_looks_like: '', deadline: null }],
    step_updates: [{ step_id: 'step-1', title: '', minutes: null }, { step_id: 'step-1', minutes: 'x' }],
  })
  const out = parsePlanResponse(raw, ctx)!
  assert.equal(out.planUpdates.length, 0)
  assert.equal(out.stepUpdates.length, 0)
  const ok = parsePlanResponse(JSON.stringify({
    plan_updates: [{ plan_id: 'plan-1', deadline: '2026-12-01', done_looks_like: 'shipped' }],
    step_updates: [{ step_id: 'step-1', minutes: 90 }],
  }), ctx)!
  assert.deepEqual(ok.planUpdates, [{ planId: 'plan-1', done_looks_like: 'shipped', deadline: '2026-12-01', deadline_suggested: true }])
  assert.deepEqual(ok.stepUpdates, [{ stepId: 'step-1', minutes: 60 }])
})

test('leading whitespace and a ```JSON fence parse', () => {
  const out = parsePlanResponse('\n```JSON\n{"new_plans":[{"ref":"p1","title":"T"}]}\n```\n', ctx)
  assert.equal(out?.newPlans[0].title, 'T')
})

test('pickContacts first-name match respects word boundaries', () => {
  const cs = [{ id: 's', full_name: 'Sam Ortiz', role: null, company: null, met_context: null, vector: null }]
  assert.deepEqual(pickContacts('the same thing again', null, cs), [])
  assert.equal(pickContacts('lunch with Sam.', null, cs).length, 1)
})

test('a starter plan deadline is always marked suggested', () => {
  const raw = JSON.stringify({
    new_plans: [{ ref: 'p1', kind: 'career', title: 'Get an internship', deadline: '2027-05-01', deadline_suggested: false }],
  })
  assert.equal(parsePlanResponse(raw, { ...ctx, starter: true })!.newPlans[0].deadline_suggested, true)
  assert.equal(parsePlanResponse(raw, ctx)!.newPlans[0].deadline_suggested, false)
  const none = JSON.stringify({ new_plans: [{ ref: 'p1', title: 'No date', deadline: null }] })
  assert.equal(parsePlanResponse(none, { ...ctx, starter: true })!.newPlans[0].deadline_suggested, false)
})

test('a deadline set by a plan update is marked suggested', () => {
  const raw = JSON.stringify({ plan_updates: [{ plan_id: 'plan-1', deadline: '2026-12-01' }] })
  assert.deepEqual(parsePlanResponse(raw, ctx)!.planUpdates, [
    { planId: 'plan-1', deadline: '2026-12-01', deadline_suggested: true },
  ])
  const titleOnly = JSON.stringify({ plan_updates: [{ plan_id: 'plan-1', title: 'New name' }] })
  assert.deepEqual(parsePlanResponse(titleOnly, ctx)!.planUpdates, [{ planId: 'plan-1', title: 'New name' }])
})

test('model output is bounded', () => {
  const many = (n: number, f: (i: number) => object) => Array.from({ length: n }, (_, i) => f(i))
  const raw = JSON.stringify({
    new_plans: many(12, (i) => ({ ref: `p${i}`, title: `Plan ${i}` })),
    plan_updates: many(25, (i) => ({ plan_id: 'plan-1', title: `T${i}` })),
    new_steps: [
      ...many(45, (i) => ({ plan: 'plan-1', title: `S${i}`, minutes: 30 })),
    ],
    step_updates: many(45, (i) => ({ step_id: 'step-1', title: `U${i}` })),
  })
  const out = parsePlanResponse(raw, ctx)!
  assert.equal(out.newPlans.length, 8)
  assert.equal(out.planUpdates.length, 20)
  assert.equal(out.newSteps.length, 40)
  assert.equal(out.stepUpdates.length, 40)
})

test('steps of a plan past the plan limit are dropped', () => {
  const raw = JSON.stringify({
    new_plans: Array.from({ length: 9 }, (_, i) => ({ ref: `p${i}`, title: `Plan ${i}` })),
    new_steps: [{ plan: 'p8', title: 'Orphan', minutes: 30 }, { plan: 'p7', title: 'Kept', minutes: 30 }],
  })
  assert.deepEqual(parsePlanResponse(raw, ctx)!.newSteps.map((s) => s.title), ['Kept'])
})

test('duplicate new-plan refs keep the first plan', () => {
  const raw = JSON.stringify({
    new_plans: [{ ref: 'p1', title: 'First' }, { ref: 'p1', title: 'Second' }],
    new_steps: [{ plan: 'p1', title: 'Step', minutes: 30 }],
  })
  const out = parsePlanResponse(raw, ctx)!
  assert.deepEqual(out.newPlans.map((p) => p.title), ['First'])
  assert.equal(out.newSteps.length, 1); assert.equal(out.newSteps[0].plan, 'p1')
})
