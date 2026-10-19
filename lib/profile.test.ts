// lib/profile.test.ts — run with `npm test`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { githubUrl, linkedinUrl, parsePromptAnswers, staleMatchIds, validateUpload } from './profile.ts'

test('keeps at most 3 answers', () => {
  const out = parsePromptAnswers(['problem', 'rabbit_hole', 'ask_me', 'learning'], ['a', 'b', 'c', 'd'])
  assert.deepEqual(out.map((p) => p.key), ['problem', 'rabbit_hole', 'ask_me'])
})

test('drops unknown keys, duplicates and blank answers', () => {
  const out = parsePromptAnswers(['nope', 'problem', 'problem', 'learning'], ['x', 'first', 'second', '   '])
  assert.deepEqual(out, [{ key: 'problem', answer: 'first' }])
})

test('trims and cuts answers to 150 characters', () => {
  const [p] = parsePromptAnswers(['learning'], ['  ' + 'a'.repeat(200)])
  assert.equal(p.answer.length, 150)
  assert.equal(p.answer[0], 'a')
})

test('github and linkedin links are checked', () => {
  assert.equal(githubUrl('javascript:alert(1)'), null)
  assert.equal(githubUrl('https://gitlab.com/x'), null)
  assert.equal(githubUrl('https://github.com/octocat'), 'https://github.com/octocat')
  assert.equal(linkedinUrl('https://www.linkedin.com/in/a'), 'https://www.linkedin.com/in/a')
  assert.equal(linkedinUrl('https://evil.com/linkedin.com'), null)
  assert.equal(linkedinUrl(''), null)
})

test('stale matches exclude saved rows and kept opportunities', () => {
  const rows = [
    { id: '1', opportunity_id: 'a', saved_at: null },
    { id: '2', opportunity_id: 'b', saved_at: '2026-10-01' },
    { id: '3', opportunity_id: 'c', saved_at: null },
  ]
  assert.deepEqual(staleMatchIds(rows, new Set(['a'])), ['3'])
})

const file = (size: number, type: string) => new File([new Uint8Array(size)], 'f', { type })

test('uploads are size and type checked', () => {
  assert.equal(validateUpload(null, 'resume'), null)
  assert.equal(validateUpload(file(0, 'application/pdf'), 'resume'), null)
  assert.equal(validateUpload(file(4 * 1024 * 1024, 'application/pdf'), 'resume')?.ok, false)
  assert.equal(validateUpload(file(1000, 'image/png'), 'resume')?.ok, false)
  assert.deepEqual(validateUpload(file(1000, 'application/pdf'), 'resume'), { ok: true, ext: 'pdf', type: 'application/pdf' })
  assert.deepEqual(validateUpload(file(1000, 'image/png'), 'photo'), { ok: true, ext: 'png', type: 'image/png' })
  assert.equal(validateUpload(file(3 * 1024 * 1024, 'image/png'), 'photo')?.ok, false)
})
