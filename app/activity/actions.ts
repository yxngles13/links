// app/activity/actions.ts
// Undo for one activity-log entry. The server re-checks that it can still be
// undone, filters every write by user_id, and never marks the row as a
// student edit (Undo isn't one).
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth'
import { rescheduleUser } from '@/lib/agent/reschedule'
import { PLAN_COLUMNS, STEP_COLUMNS, undoState, undoValues, UNDO_EDITED } from '@/lib/agent/undo'
import { isPlanAction, loadTarget, type UndoEntry } from './target'

function fail(message: string): never {
  redirect(`/activity?error=${encodeURIComponent(message)}`)
}

export async function undoActivity(formData: FormData) {
  const { supabase, user } = await requireUser()
  const entryId = String(formData.get('entry_id') ?? '')

  const { data: row, error: loadError } = await supabase
    .from('agent_activity')
    .select('id, action, plan_id, step_id, created_at, undone_at, before')
    .eq('id', entryId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (loadError) {
    console.error('undoActivity: load failed', loadError.message)
    fail("Couldn't undo that. Try again.")
  }
  if (!row) fail('That change was not found')
  const entry = row as UndoEntry

  const onPlan = isPlanAction(entry.action)
  const table = onPlan ? 'agent_plans' : 'agent_steps'
  const targetId = onPlan ? entry.plan_id : entry.step_id
  const { target, error: targetError } = await loadTarget(supabase, user.id, entry)
  if (targetError) fail("Couldn't undo that. Try again.")
  const state = undoState(entry, target)
  if (state === 'edited') fail(UNDO_EDITED)
  if (state !== 'available' || !targetId) fail("That change can't be undone any more")

  // Claim the entry first so a second click can't run the undo twice.
  const { data: claimed, error: claimError } = await supabase
    .from('agent_activity')
    .update({ undone_at: new Date().toISOString() })
    .eq('id', entry.id)
    .eq('user_id', user.id)
    .is('undone_at', null)
    .select('id')
  if (claimError) fail("Couldn't undo that. Try again.")
  if (!claimed?.length) fail('That change was already undone')

  // Hand the entry back so it can be tried again. If that fails too, the
  // entry reads as undone; log it so it can be fixed by hand.
  const release = async () => {
    const { error } = await supabase.from('agent_activity').update({ undone_at: null }).eq('id', entry.id).eq('user_id', user.id)
    if (error) console.error('undoActivity: could not release entry', entry.id, error.message)
  }

  // Every write only lands if the student hasn't edited the row since.
  const untouched = `student_edited_at.is.null,student_edited_at.lte.${entry.created_at}`
  const base = () => supabase.from(table)
  let result: { data: { id: string }[] | null; error: { message: string } | null } | null = null
  if (entry.action === 'created_plan' || entry.action === 'added_step') {
    // Links made it, so Undo may remove it (a plan's steps cascade).
    result = await base().delete().eq('id', targetId).eq('user_id', user.id).or(untouched).select('id')
  } else {
    // A mark-done also puts back anything else the same change overwrote.
    const values = undoValues(entry.action, entry.before, onPlan ? PLAN_COLUMNS : STEP_COLUMNS)
    if (Object.keys(values).length) {
      result = await base().update(values).eq('id', targetId).eq('user_id', user.id).or(untouched).select('id')
    }
  }
  if (result?.error) {
    console.error('undoActivity: write failed', result.error.message)
    await release()
    fail("Couldn't undo that. Try again.")
  }
  if (result && !result.data?.length) {
    await release()
    fail(UNDO_EDITED)
  }

  await rescheduleUser(supabase, user.id)
  revalidatePath('/activity')
  revalidatePath('/plans')
  redirect('/activity')
}
