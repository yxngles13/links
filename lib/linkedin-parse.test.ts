// lib/linkedin-parse.test.ts — run with `npm test`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { canonicalProfileUrl, isLinkedInProfileUrl, parseModelOutput, profileKey } from './linkedin-parse.ts'

test('profile URLs are recognised', () => {
  assert.equal(isLinkedInProfileUrl('https://www.linkedin.com/in/priya-nair/'), true)
  assert.equal(isLinkedInProfileUrl('https://linkedin.com/in/priya?trk=x'), true)
  assert.equal(isLinkedInProfileUrl('https://www.linkedin.com/feed/'), false)
  assert.equal(isLinkedInProfileUrl('https://www.linkedin.com/in/'), false)
  assert.equal(isLinkedInProfileUrl('https://evil.com/linkedin.com/in/x'), false)
  assert.equal(isLinkedInProfileUrl('http://www.linkedin.com/in/x'), false)
  assert.equal(isLinkedInProfileUrl('not a url'), false)
})

test('cache key ignores query, hash and trailing slash', () => {
  assert.equal(profileKey('https://www.linkedin.com/in/Priya/?trk=1#x'), 'https://www.linkedin.com/in/priya')
})

test('builds labeled notes from the parts it has', () => {
  const p = parseModelOutput(
    JSON.stringify({
      full_name: 'Priya Nair',
      school: 'Cal Poly Pomona',
      major: 'Computer Science',
      grad_year: 2024,
      location: 'Pomona, CA',
      past_roles: ['SWE Intern, Google', 'TA, CPP'],
      about_summary: 'Builds ML tools.',
    })
  )
  assert.equal(p?.notes, "School: Cal Poly Pomona, Computer Science '24\nLocation: Pomona, CA\nBefore: SWE Intern, Google; TA, CPP\nAbout: Builds ML tools.")
})

test('skips empty and placeholder parts', () => {
  const p = parseModelOutput(JSON.stringify({ full_name: 'X', school: 'N/A', location: '', about_summary: 'Unknown', role: '-' }))
  assert.equal(p?.notes, '')
  assert.equal(p?.role, '')
})

test('clamps tags and long fields', () => {
  const p = parseModelOutput(JSON.stringify({ role: 'r'.repeat(400), tags: ['ml', 'ML', 'Product', 'Alumni', 'AI', 'Data', 'Web'] }))
  assert.deepEqual(p?.tags, ['ml', 'Product', 'Alumni'])
  assert.equal(p?.role.length, 200)
})

test('fenced JSON still parses; junk returns null', () => {
  assert.equal(parseModelOutput('```json\n{"full_name":"Priya Nair"}\n```')?.full_name, 'Priya Nair')
  assert.equal(parseModelOutput('Sorry, I cannot help'), null)
  assert.equal(parseModelOutput('[]'), null)
})

test('profile sub-pages resolve to the profile itself', () => {
  assert.equal(canonicalProfileUrl('https://www.linkedin.com/in/priya-nair/overlay/contact-info/'), 'https://www.linkedin.com/in/priya-nair')
  assert.equal(canonicalProfileUrl('https://www.linkedin.com/in/priya-nair/details/experience/?x=1'), 'https://www.linkedin.com/in/priya-nair')
  assert.equal(canonicalProfileUrl('https://www.linkedin.com/in/priya-nair'), 'https://www.linkedin.com/in/priya-nair')
  assert.equal(canonicalProfileUrl('https://www.linkedin.com/feed/'), null)
  assert.equal(canonicalProfileUrl('https://evil.com/in/x'), null)
})
