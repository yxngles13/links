// lib/agent/undo.ts — decides if an activity-log change can still be undone,
// and what Undo writes back. Pure; no I/O.

export type ActivityEntry = {
  id: string
  action: 'created_plan' | 'added_step' | 'updated_plan' | 'updated_step' | 'marked_done' | 'suggested_pause'
  created_at: string
  undone_at: string | null
  before: Record<string, unknown> | null
}

export const UNDO_EDITED = "You've changed this since"

export function undoState(
  entry: ActivityEntry,
  target: { student_edited_at: string | null } | null,
): 'available' | 'edited' | 'gone' | 'done' | 'none' {
  // Precedence: done, none, gone, edited, available
  if (entry.undone_at != null) return 'done'
  if (entry.action === 'suggested_pause') return 'none'
  if (target === null) return 'gone'
  if (target.student_edited_at != null && Date.parse(target.student_edited_at) > Date.parse(entry.created_at)) {
    return 'edited'
  }
  return 'available'
}

// Columns Undo may restore. Anything else in `before` is ignored.
export const PLAN_COLUMNS = ['kind', 'title', 'done_looks_like', 'deadline', 'deadline_suggested', 'paused', 'paused_until', 'position']
export const STEP_COLUMNS = ['title', 'minutes', 'day', 'pinned', 'done_at', 'contact_id', 'needs_person', 'position']

// Only the keys of `before` that are real columns.
export function restorable(before: Record<string, unknown> | null, columns: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const key of columns) if (before && Object.hasOwn(before, key)) out[key] = before[key]
  return out
}

// What an update-style Undo writes. Undoing a mark-done always clears
// done_at, and also puts back anything else the same change overwrote.
export function undoValues(
  action: ActivityEntry['action'],
  before: Record<string, unknown> | null,
  columns: string[],
): Record<string, unknown> {
  const values = restorable(before, columns)
  return action === 'marked_done' ? { ...values, done_at: null } : values
}

// Undoing a created plan deletes its steps too, so it's blocked once the
// student has put work into any of them.
export function stepHasStudentWork(step: {
  created_by: string | null
  student_edited_at: string | null
  done_at: string | null
}): boolean {
  return step.created_by === 'student' || step.student_edited_at != null || step.done_at != null
}

// Pick `fields` out of `row`, for an activity row's `before`. A field the row
// doesn't have is saved as null.
export function previous(row: Record<string, unknown>, fields: string[]): Record<string, unknown> {
  return Object.fromEntries(fields.map((f) => [f, row[f] ?? null]))
}
