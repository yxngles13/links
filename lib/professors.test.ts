// lib/professors.test.ts — run with `npm test`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { departmentsOf, DRAFT_FAILED, draftRedirect, filterProfessors, pickedContent, type ProfessorRow } from './professors.ts'

const row = (id: string, professor_name: string, extra: Partial<ProfessorRow> = {}): ProfessorRow => ({
  id,
  professor_name,
  department: 'Computer Science',
  lab_name: null,
  research_areas: [],
  is_available: false,
  ...extra,
})

const sun = row('1', 'Dr. Yu Sun', { research_areas: ['software engineering'] })
const amamra = row('2', 'Dr. Abdelfattah Amamra', { research_areas: ['Android security', 'malware analysis and detection'] })
const chen = row('3', 'Dr. Tingting Chen', { lab_name: 'SoftSec Lab' })

test('blank search returns everyone, A–Z ignoring Dr.', () => {
  assert.deepEqual(filterProfessors([sun, amamra, chen], { q: '   ' }).map((r) => r.id), ['2', '3', '1'])
})

test('search is case-insensitive and covers research areas', () => {
  assert.deepEqual(filterProfessors([sun, amamra, chen], { q: 'MALWARE' }).map((r) => r.id), ['2'])
})

test('search covers name and lab', () => {
  assert.deepEqual(filterProfessors([sun, amamra, chen], { q: 'chen' }).map((r) => r.id), ['3'])
  assert.deepEqual(filterProfessors([sun, amamra, chen], { q: 'softsec' }).map((r) => r.id), ['3'])
})

test('department filter is exact', () => {
  const omar = row('4', 'Dr. Tamer Omar', { department: 'Electrical & Computer Engineering' })
  assert.deepEqual(filterProfessors([sun, omar], { dept: 'Computer Science' }).map((r) => r.id), ['1'])
  assert.equal(filterProfessors([sun, omar], { dept: '' }).length, 2)
})

test('departments are distinct and sorted, nulls dropped', () => {
  const omar = row('4', 'Dr. Tamer Omar', { department: 'Electrical & Computer Engineering' })
  const none = row('5', 'Dr. X', { department: null })
  assert.deepEqual(departmentsOf([omar, sun, chen, none]), ['Computer Science', 'Electrical & Computer Engineering'])
})

const kept = { explanation: 'old why', suggested_questions: ['q'], outreach_draft: 'my edited draft' }
const fresh = { explanation: 'new why', suggested_questions: ['q2'], outreach_draft: 'new draft' }
const blank = { explanation: '', suggested_questions: [], outreach_draft: '' }

test('a failed or skipped generation keeps what the match already had', () => {
  assert.deepEqual(pickedContent(null, kept), { content: kept, wrote: false })
  assert.deepEqual(pickedContent(blank, kept), { content: kept, wrote: false })
  assert.deepEqual(pickedContent(null, null), { content: blank, wrote: false })
})

test('a real generation replaces the old text', () => {
  assert.deepEqual(pickedContent(fresh, kept), { content: fresh, wrote: true })
})

test('after a pick the student always lands on the match, with a reason when there is no draft', () => {
  assert.equal(draftRedirect('m1', { spent: true, wrote: true }, 'OUT'), '/matches/m1')
  assert.equal(draftRedirect('m1', { spent: false, wrote: false }, 'OUT'), '/matches/m1?error=OUT')
  assert.equal(draftRedirect('m1', { spent: true, wrote: false }, 'OUT'), `/matches/m1?error=${encodeURIComponent(DRAFT_FAILED)}`)
})
