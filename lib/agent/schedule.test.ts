// lib/agent/schedule.test.ts — run with `npm test`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { addDays, windowDays } from './dates.ts'
import { capacityFromDailyMinutes } from './capacity.ts'
import { schedule, isPlanActive, pinAfterEdit, type SchedStep } from './schedule.ts'

const TODAY = '2026-10-20'
// 7:00am PDT on TODAY, before the waking window: today is still whole.
const MORNING = new Date('2026-10-20T14:00:00Z')
const daily = (m: number) => capacityFromDailyMinutes(m, TODAY, MORNING)
let n = 0
function step(o: Partial<SchedStep> = {}): SchedStep {
  n++
  return { id: `s${n}`, planId: 'p1', planOrder: 0, order: n, minutes: 30, day: null, pinned: false, done: false, planActive: true, ...o }
}

test('never puts more on a day than it holds', () => {
  const steps = [0, 1, 2, 3, 4].map(i => step({ planId: `p${i}`, planOrder: i, order: 0 }))
  const { days } = schedule(steps, daily(60), TODAY)
  const count: Record<string, number> = {}
  for (const d of Object.values(days)) if (d) count[d] = (count[d] ?? 0) + 1
  for (const c of Object.values(count)) assert.ok(c * 30 <= 60)
  assert.equal(count[TODAY], 2); assert.equal(count[addDays(TODAY, 1)], 2); assert.equal(count[addDays(TODAY, 2)], 1)
})
test('one step per plan per day, in order', () => {
  const steps = [step({ order: 0 }), step({ order: 1 }), step({ order: 2 })]
  const { days } = schedule(steps, daily(180), TODAY)
  assert.deepEqual(steps.map(s => days[s.id]), [TODAY, addDays(TODAY, 1), addDays(TODAY, 2)])
})
test('a step bigger than any day is Later', () => {
  const big = step({ minutes: 60 })
  assert.equal(schedule([big], daily(30), TODAY).days[big.id], null)
  const a = step(), b = step()
  const { days } = schedule([a, b], daily(0), TODAY)
  assert.equal(days[a.id], null); assert.equal(days[b.id], null)
})
test('pinned steps stay put and use up the day', () => {
  const pin = step({ planId: 'a', minutes: 60, day: TODAY, pinned: true })
  const other = step({ planId: 'b', planOrder: 1, minutes: 30 })
  const { days } = schedule([pin, other], daily(60), TODAY)
  assert.equal(days[pin.id], TODAY); assert.equal(days[other.id], addDays(TODAY, 1))
})
test('pinned overfill is reported, not fixed', () => {
  const a = step({ planId: 'a', minutes: 45, day: TODAY, pinned: true })
  const b = step({ planId: 'b', minutes: 45, day: TODAY, pinned: true })
  const r = schedule([a, b], daily(60), TODAY)
  assert.equal(r.days[a.id], TODAY); assert.equal(r.days[b.id], TODAY)
  assert.deepEqual(r.overloaded, [TODAY])
})
test('overdue unpinned steps move forward', () => {
  const s = step({ day: addDays(TODAY, -1) })
  assert.equal(schedule([s], daily(60), TODAY).days[s.id], TODAY)
})
test('pinned overdue steps stay overdue', () => {
  const s = step({ day: addDays(TODAY, -1), pinned: true })
  const r = schedule([s], daily(60), TODAY)
  assert.equal(r.days[s.id], addDays(TODAY, -1))
  assert.deepEqual(r.overloaded, [])
})
test('done steps on other days are ignored', () => {
  const done = step({ minutes: 60, day: addDays(TODAY, 1), pinned: true, done: true })
  const s = step({ planId: 'p2', minutes: 60, order: 0 })
  const t = step({ planId: 'p3', planOrder: 1, minutes: 60, order: 0 })
  const r = schedule([done, s, t], daily(60), TODAY)
  assert.ok(!(done.id in r.days)); assert.equal(r.days[s.id], TODAY); assert.equal(r.days[t.id], addDays(TODAY, 1))
})
test('steps done today use up today', () => {
  const done = step({ planId: 'a', minutes: 45, day: TODAY, done: true })
  const s = step({ planId: 'b', planOrder: 1, minutes: 30 })
  const r = schedule([done, s], daily(60), TODAY)
  assert.ok(!(done.id in r.days)); assert.equal(r.days[s.id], addDays(TODAY, 1))
  const small = step({ planId: 'c', planOrder: 2, minutes: 15 })
  assert.equal(schedule([done, small], daily(60), TODAY).days[small.id], TODAY)
})
test('already placed steps are not reshuffled', () => {
  const steps = [0, 1, 2, 3].map(i => step({ planId: `p${i % 2}`, planOrder: i % 2, order: i }))
  const cap = daily(60)
  const first = schedule(steps, cap, TODAY)
  const again = schedule(steps.map(s => ({ ...s, day: first.days[s.id] })), cap, TODAY)
  assert.deepEqual(again, first)
})
test('paused plans get nothing; resumed plans come back', () => {
  const p = { paused: true, paused_until: '2026-11-15' }
  assert.equal(isPlanActive(p, '2026-11-14'), false)
  assert.equal(isPlanActive(p, '2026-11-15'), true)
  assert.equal(isPlanActive({ paused: false, paused_until: null }, TODAY), true)
  assert.equal(isPlanActive({ paused: true, paused_until: null }, TODAY), false)
  const s = step({ planActive: false })
  assert.equal(schedule([s], daily(60), TODAY).days[s.id], null)
})
test('past the 14-day window is Later', () => {
  const steps = Array.from({ length: 20 }, (_, i) => step({ order: i }))
  const { days } = schedule(steps, daily(180), TODAY)
  const w = windowDays(TODAY)
  steps.forEach((s, i) => assert.equal(days[s.id], i < 14 ? w[i] : null))
})

test('editing a step pins it only when its day changes', () => {
  const stored = { day: TODAY, pinned: false }
  assert.equal(pinAfterEdit(stored, TODAY), false) // same day: unchanged
  assert.equal(pinAfterEdit({ day: TODAY, pinned: true }, TODAY), true)
  assert.equal(pinAfterEdit(stored, addDays(TODAY, 2)), true) // a new day pins
  assert.equal(pinAfterEdit({ day: null, pinned: false }, TODAY), true)
  assert.equal(pinAfterEdit({ day: TODAY, pinned: true }, null), false) // cleared: unpinned
})
test('finished work today never makes a pinned step look over time', () => {
  // 60/day: 45 min done this morning, then a 30-min step pinned to today.
  // Together they pass 60, but the pinned step alone fits, so no warning.
  const steps = [
    step({ minutes: 45, day: TODAY, done: true }),
    step({ planId: 'p2', minutes: 30, day: TODAY, pinned: true }),
  ]
  assert.deepEqual(schedule(steps, daily(60), TODAY).overloaded, [])
})
