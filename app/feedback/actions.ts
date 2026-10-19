// app/feedback/actions.ts
'use server'

import { requireUser } from '@/lib/auth'
import { parseFeedback } from '@/lib/feedback'

// Never throws: a survey that errors at someone on their way out is worse
// than a lost answer. Returns whether it was stored.
export async function submitFeedback(formData: FormData): Promise<boolean> {
  const { supabase, user } = await requireUser()
  const fb = parseFeedback(formData)
  if (!fb) return false
  const trigger = formData.get('trigger') === 'exit' ? 'exit' : 'button'
  const { error } = await supabase.from('feedback').insert({ user_id: user.id, ...fb, trigger })
  if (error) console.error('Could not save feedback:', error.message)
  return !error
}
