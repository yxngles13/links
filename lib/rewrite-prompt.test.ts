// lib/rewrite-prompt.test.ts — run with `npm test`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildRewritePrompt, cleanRewrite, MAX_DRAFT_LENGTH } from './rewrite-prompt.ts'

test('prompt carries the draft, the request and the context', () => {
  const p = buildRewritePrompt({ draft: 'Hi Dr. Chen,', instruction: 'shorter', context: 'Email to Dr. Chen' })
  assert.match(p, /Hi Dr\. Chen,/)
  assert.match(p, /THE STUDENT'S REQUEST: shorter/)
  assert.match(p, /WHAT THIS IS: Email to Dr\. Chen/)
})

test('empty draft asks for one from scratch; empty request gets a default', () => {
  const p = buildRewritePrompt({ draft: '  ', instruction: '', context: 'x' })
  assert.match(p, /write one from scratch/)
  assert.match(p, /Make it clearer/)
})

test('long inputs are cut', () => {
  const p = buildRewritePrompt({ draft: 'a'.repeat(9000), instruction: 'b'.repeat(900), context: 'x' })
  assert.ok(!p.includes('a'.repeat(MAX_DRAFT_LENGTH + 1)))
  assert.ok(!p.includes('b'.repeat(301)))
})

test('cleanup strips fences and wrapping quotes', () => {
  assert.equal(cleanRewrite('```\nHello\n```'), 'Hello')
  assert.equal(cleanRewrite('"Hello there"'), 'Hello there')
  assert.equal(cleanRewrite('  Hi,\n\nThanks  '), 'Hi,\n\nThanks')
})
