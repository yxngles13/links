// app/calendar/actions.ts
'use server'

import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth'
import { rescheduleUser } from '@/lib/agent/reschedule'
import { createAdminClient } from '@/utils/supabase/admin'

// Drops the stored Google tokens, then re-places steps using daily hours.
export async function disconnectCalendar() {
  const { supabase, user } = await requireUser()
  const { error } = await createAdminClient().from('agent_calendar_connections').delete().eq('user_id', user.id)
  if (error) {
    console.error('Could not disconnect calendar:', error.message)
    redirect(`/capture?error=${encodeURIComponent("Couldn't disconnect your calendar. Try again.")}`)
  }
  await rescheduleUser(supabase, user.id)
  redirect('/capture')
}
