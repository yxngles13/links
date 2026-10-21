// lib/agent/capacity.test.ts — run with `npm test`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pacificToday, windowDays, pacificInstant } from './dates.ts'
import { capacityFromDailyMinutes, capacityFromBusy, capacityFor } from './capacity.ts'

// 7:00am PDT on the test day, before the waking window: today is still whole.
const MORNING = new Date('2026-10-20T14:00:00Z')

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
  const c = capacityFromDailyMinutes(90, '2026-10-20', MORNING)
  assert.equal(Object.keys(c).length, 14); assert.equal(c['2026-10-27'], 90)
})
test('a free day gives the capped share', () => {
  assert.equal(capacityFromBusy([], '2026-10-20', MORNING)['2026-10-20'], 180) // 840*0.25=210 → cap 180
})
test('a 9-to-5 day leaves a quarter of the remaining waking time', () => {
  const busy = [{ start: '2026-10-20T16:00:00Z', end: '2026-10-21T00:00:00Z' }] // 9am–5pm PDT
  assert.equal(capacityFromBusy(busy, '2026-10-20', MORNING)['2026-10-20'], 90) // (840-480)*0.25
})
test('overlapping busy blocks are not double-counted', () => {
  const busy = [
    { start: '2026-10-20T16:00:00Z', end: '2026-10-20T20:00:00Z' },
    { start: '2026-10-20T18:00:00Z', end: '2026-10-20T22:00:00Z' },
  ] // 9am–3pm PDT total = 360
  assert.equal(capacityFromBusy(busy, '2026-10-20', MORNING)['2026-10-20'], 120)
})
test('capacity on the DST change day still uses 8am–10pm local', () => {
  assert.equal(capacityFromBusy([], '2026-10-20', MORNING)['2026-11-01'], 180)
  const busy = [{ start: '2026-11-01T16:00:00Z', end: '2026-11-02T06:00:00Z' }] // 8am–10pm PST
  assert.equal(capacityFromBusy(busy, '2026-10-20', MORNING)['2026-11-01'], 0)
})

test('capacityFor: calendar busy blocks win over daily minutes', () => {
  const busy = [{ start: '2026-10-20T16:00:00Z', end: '2026-10-21T00:00:00Z' }] // 9am–5pm PDT
  const r = capacityFor({ daily_minutes: 60 }, busy, '2026-10-20', MORNING)
  assert.equal(r.capacity?.['2026-10-20'], 90); assert.equal(r.capacity?.['2026-10-21'], 180)
  assert.equal(r.reconnect, false); assert.equal(r.unavailable, false)
})
test("capacityFor: 'none' falls back to daily minutes", () => {
  const r = capacityFor({ daily_minutes: 60 }, 'none', '2026-10-20', MORNING)
  assert.equal(r.capacity?.['2026-10-25'], 60); assert.equal(r.reconnect, false); assert.equal(r.unavailable, false)
})
test("capacityFor: 'reconnect' falls back to daily minutes and flags reconnect", () => {
  const r = capacityFor({ daily_minutes: 60 }, 'reconnect', '2026-10-20', MORNING)
  assert.equal(r.capacity?.['2026-10-20'], 60); assert.equal(r.reconnect, true); assert.equal(r.unavailable, false)
})
test("capacityFor: 'reconnect' with no settings asks the hours question", () => {
  const r = capacityFor(null, 'reconnect', '2026-10-20', MORNING)
  assert.equal(r.capacity, null); assert.equal(r.reconnect, true)
})
test("capacityFor: no settings and 'none' gives no capacity", () => {
  assert.equal(capacityFor(null, 'none', '2026-10-20', MORNING).capacity, null)
  assert.equal(capacityFor({ daily_minutes: null }, 'none', '2026-10-20', MORNING).capacity, null)
})
test("capacityFor: 'unavailable' falls back to daily minutes without reconnect", () => {
  const r = capacityFor({ daily_minutes: 45 }, 'unavailable', '2026-10-20', MORNING)
  assert.equal(r.capacity?.['2026-10-20'], 45); assert.equal(r.reconnect, false); assert.equal(r.unavailable, true)
})
test("capacityFor: 'unavailable' with no daily minutes gives no capacity", () => {
  const r = capacityFor(null, 'unavailable', '2026-10-20', MORNING)
  assert.equal(r.capacity, null); assert.equal(r.reconnect, false); assert.equal(r.unavailable, true)
})
test('capacityFor: 0 daily minutes is a real answer, not missing', () => {
  assert.equal(capacityFor({ daily_minutes: 0 }, 'none', '2026-10-20', MORNING).capacity?.['2026-10-20'], 0)
})

test('late in the day, daily minutes shrink to the waking time left', () => {
  const ninePm = new Date('2026-10-21T04:00:00Z') // 9pm PDT
  const c = capacityFromDailyMinutes(120, '2026-10-20', ninePm)
  assert.equal(c['2026-10-20'], 8) // floor(120 * 60 / 840)
  assert.equal(c['2026-10-21'], 120)
})
test('after 10pm today has no time left', () => {
  const late = new Date('2026-10-21T05:30:00Z') // 10:30pm PDT
  assert.equal(capacityFromDailyMinutes(120, '2026-10-20', late)['2026-10-20'], 0)
  assert.equal(capacityFromBusy([], '2026-10-20', late)['2026-10-20'], 0)
  assert.equal(capacityFor({ daily_minutes: 120 }, 'none', '2026-10-20', late).capacity?.['2026-10-20'], 0)
})
test('mid-day, past hours of a calendar day are not free', () => {
  const noon = new Date('2026-10-20T19:00:00Z') // 12pm PDT
  assert.equal(capacityFromBusy([], '2026-10-20', noon)['2026-10-20'], 150) // 600 * 0.25
  const busy = [{ start: '2026-10-20T16:00:00Z', end: '2026-10-21T00:00:00Z' }] // 9am–5pm PDT
  const c = capacityFor(null, busy, '2026-10-20', noon).capacity!
  assert.equal(c['2026-10-20'], 75) // (600 - 300 busy after noon) * 0.25
  assert.equal(c['2026-10-21'], 180)
})
