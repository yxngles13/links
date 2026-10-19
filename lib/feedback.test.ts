// lib/feedback.test.ts — run with `npm test`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseFeedback, PROMPT_EVERY_MS, shouldPromptOnExit } from './feedback.ts'

const form = (entries: [string, string][]) => {
  const fd = new FormData()
  for (const [k, v] of entries) fd.append(k, v)
  return fd
}

test('exit prompt waits 30 seconds and then once a week', () => {
  const now = 1_000_000_000_000
  assert.equal(shouldPromptOnExit(null, 10_000, now), false)
  assert.equal(shouldPromptOnExit(null, 40_000, now), true)
  assert.equal(shouldPromptOnExit(now - 1000, 40_000, now), false)
  assert.equal(shouldPromptOnExit(now - PROMPT_EVERY_MS, 40_000, now), true)
})

test('parses a full answer', () => {
  const fb = parseFeedback(form([['rating', '4'], ['features', 'Network'], ['features', 'Mentors'], ['reason', 'Done for now'], ['comment', ' nice '], ['page', '/dashboard']]))
  assert.deepEqual(fb, { rating: 4, features: ['Network', 'Mentors'], reason: 'Done for now', comment: 'nice', page: '/dashboard' })
})

test('drops made-up choices and bad values', () => {
  const fb = parseFeedback(form([['rating', '9'], ['features', 'Hacking'], ['reason', 'because'], ['comment', 'hi'], ['page', 'https://evil.com']]))
  assert.deepEqual(fb, { rating: null, features: [], reason: null, comment: 'hi', page: null })
})

test('an empty submission is not feedback', () => {
  assert.equal(parseFeedback(form([['page', '/matches']])), null)
})
