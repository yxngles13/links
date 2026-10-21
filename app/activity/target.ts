// app/activity/target.ts
// What an activity entry would undo, as undoState wants it: the row's
// student_edited_at, or null when it's gone. The page and the Undo action both
// call this so they can't disagree.
import type { SupabaseClient } from '@supabase/supabase-js'
import { stepHasStudentWork, type ActivityEntry } from '@/lib/agent/undo'

export type UndoEntry = ActivityEntry & { plan_id: string | null; step_id: string | null }
export type Target = { student_edited_at: string | null } | null

export const isPlanAction = (action: ActivityEntry['action']) => action === 'created_plan' || action === 'updated_plan'

export async function loadTarget(
  supabase: SupabaseClient,
  userId: string,
  entry: UndoEntry,
): Promise<{ target: Target; error: boolean }> {
  const onPlan = isPlanAction(entry.action)
  const id = onPlan ? entry.plan_id : entry.step_id
  if (!id) return { target: null, error: false }
  const { data, error } = await supabase
    .from(onPlan ? 'agent_plans' : 'agent_steps')
    .select('student_edited_at')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle()
  if (error) return { target: null, error: true }
  if (!data) return { target: null, error: false }

  // Deleting a plan cascades to its steps, so work on any step counts too.
  if (entry.action === 'created_plan' && data.student_edited_at == null) {
    const { data: planSteps, error: stepsError } = await supabase
      .from('agent_steps')
      .select('created_by, student_edited_at, done_at')
      .eq('plan_id', id)
      .eq('user_id', userId)
    if (stepsError) return { target: null, error: true }
    if ((planSteps ?? []).some(stepHasStudentWork)) return { target: { student_edited_at: new Date().toISOString() }, error: false }
  }
  return { target: { student_edited_at: data.student_edited_at as string | null }, error: false }
}
