// lib/dashboard.test.ts — run with `npm test`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { gettingStartedSteps, greeting } from './dashboard.ts'

const none = { hasAbout: false, hasAnswers: false, hasActedOnMatch: false, contacts: 0, mentorRequests: 0 }

test('a brand-new student has every step left, answers first', () => {
  const steps = gettingStartedSteps(none)
  assert.equal(steps.length, 5)
  assert.equal(steps[0].key, 'answers')
  assert.ok(steps.every((s) => !s.done))
})

test('steps tick off from what the student has done', () => {
  const steps = gettingStartedSteps({ ...none, hasAnswers: true, contacts: 2 })
  assert.deepEqual(steps.filter((s) => s.done).map((s) => s.key), ['answers', 'network'])
})

test('greeting follows Pacific time', () => {
  assert.equal(greeting(new Date('2026-10-19T16:00:00Z')), 'Good morning') // 9am PDT
  assert.equal(greeting(new Date('2026-10-19T22:00:00Z')), 'Good afternoon') // 3pm
  assert.equal(greeting(new Date('2026-10-20T03:00:00Z')), 'Good evening') // 8pm
  assert.equal(greeting(new Date('2026-10-20T09:00:00Z')), 'Up late') // 2am
})
