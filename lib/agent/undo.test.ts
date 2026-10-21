// lib/agent/undo.test.ts — run with `npm test`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  PLAN_COLUMNS, STEP_COLUMNS, previous, restorable, stepHasStudentWork, undoState, undoValues, type ActivityEntry,
} from './undo.ts'

function entry(o: Partial<ActivityEntry> = {}): ActivityEntry {
  return {
    id: 'e1',
    action: 'created_plan',
    created_at: '2026-10-20T15:30:00Z',
    undone_at: null,
    before: null,
    ...o,
  }
}

test("'done' when already undone", () => {
  assert.equal(undoState(entry({ undone_at: '2026-10-20T16:00:00Z' }), { student_edited_at: null }), 'done')
})

test("'none' for suggested_pause action", () => {
  assert.equal(undoState(entry({ action: 'suggested_pause' }), { student_edited_at: null }), 'none')
})

test("'gone' when target is null", () => {
  assert.equal(undoState(entry(), null), 'gone')
})

test("'edited' when student edited after Links' change", () => {
  const e = entry({ created_at: '2026-10-20T15:00:00Z' })
  assert.equal(
    undoState(e, { student_edited_at: '2026-10-20T16:00:00Z' }),
    'edited',
  )
})

test("'available' when student edited before Links' change", () => {
  const e = entry({ created_at: '2026-10-20T16:00:00Z' })
  assert.equal(
    undoState(e, { student_edited_at: '2026-10-20T15:00:00Z' }),
    'available',
  )
})

test("'available' when no student edits yet", () => {
  assert.equal(undoState(entry(), { student_edited_at: null }), 'available')
})

test("precedence: done before none", () => {
  assert.equal(
    undoState(entry({ action: 'suggested_pause', undone_at: '2026-10-20T16:00:00Z' }), { student_edited_at: null }),
    'done',
  )
})

test("precedence: none before gone", () => {
  assert.equal(
    undoState(entry({ action: 'suggested_pause' }), null),
    'none',
  )
})

test("precedence: gone before edited", () => {
  const e = entry({ created_at: '2026-10-20T15:00:00Z' })
  assert.equal(
    undoState(e, null),
    'gone',
  )
})

test("precedence: edited before available", () => {
  const e = entry({ created_at: '2026-10-20T15:00:00Z' })
  assert.equal(
    undoState(e, { student_edited_at: '2026-10-20T16:00:00Z' }),
    'edited',
  )
})

test("timestamp comparison treats created_at as UTC instant", () => {
  const e = entry({ created_at: '2026-10-20T22:59:59Z' })
  assert.equal(
    undoState(e, { student_edited_at: '2026-10-20T23:00:00Z' }),
    'edited',
  )
})

test('restorable keeps only real columns that are in before', () => {
  assert.deepEqual(restorable({ title: 'Old', deadline: null, bogus: 1 }, PLAN_COLUMNS), { title: 'Old', deadline: null })
  assert.deepEqual(restorable(null, PLAN_COLUMNS), {})
  assert.ok(PLAN_COLUMNS.includes('deadline_suggested'))
  assert.deepEqual(restorable({ day: '2026-10-20', user_id: 'x' }, STEP_COLUMNS), { day: '2026-10-20' })
})

test('restorable ignores inherited keys', () => {
  const before = Object.create({ title: 'inherited' }) as Record<string, unknown>
  assert.deepEqual(restorable(before, PLAN_COLUMNS), {})
})

test('undoValues: marked_done clears done_at and restores other fields too', () => {
  assert.deepEqual(undoValues('marked_done', { done_at: null }, STEP_COLUMNS), { done_at: null })
  assert.deepEqual(undoValues('marked_done', { done_at: null, title: 'Old' }, STEP_COLUMNS), { done_at: null, title: 'Old' })
  assert.deepEqual(undoValues('marked_done', null, STEP_COLUMNS), { done_at: null })
})

test('undoValues: updates restore exactly the before fields', () => {
  assert.deepEqual(
    undoValues('updated_plan', { deadline: null, deadline_suggested: false }, PLAN_COLUMNS),
    { deadline: null, deadline_suggested: false },
  )
  assert.deepEqual(undoValues('updated_step', {}, STEP_COLUMNS), {})
})

test('stepHasStudentWork: student-made, student-edited, or done steps count', () => {
  const base = { created_by: 'links', student_edited_at: null, done_at: null }
  assert.equal(stepHasStudentWork(base), false)
  assert.equal(stepHasStudentWork({ ...base, created_by: 'student' }), true)
  assert.equal(stepHasStudentWork({ ...base, student_edited_at: '2026-10-20T16:00:00Z' }), true)
  assert.equal(stepHasStudentWork({ ...base, done_at: '2026-10-20T16:00:00Z' }), true)
  assert.equal(stepHasStudentWork({ ...base, created_by: null }), false)
})

test('previous snapshots the given fields, missing ones as null', () => {
  const row = { id: 's1', title: 'Old', minutes: 30, done_at: undefined }
  assert.deepEqual(previous(row, ['title', 'done_at', 'deadline_suggested']), {
    title: 'Old', done_at: null, deadline_suggested: null,
  })
  assert.deepEqual(previous(row, []), {})
  assert.deepEqual(previous({ deadline_suggested: false }, ['deadline_suggested']), { deadline_suggested: false })
})
