// lib/agent/calendar-status.ts
// Whether the student has a Google Calendar connection, for the Capture and
// Plans pages. Server-only: it reads the service-role table.
import { createAdminClient } from '@/utils/supabase/admin'

// Tokens never leave the server: only whether a connection exists, and
// whether Google rejected it. Any error counts as not connected.
export async function calendarStatus(userId: string): Promise<{ connected: boolean; needsReconnect: boolean }> {
  try {
    const { data, error } = await createAdminClient()
      .from('agent_calendar_connections')
      .select('needs_reconnect')
      .eq('user_id', userId)
      .maybeSingle()
    if (error || !data) return { connected: false, needsReconnect: false }
    return { connected: true, needsReconnect: data.needs_reconnect === true }
  } catch (err) {
    console.error('Could not read calendar connection:', err)
    return { connected: false, needsReconnect: false }
  }
}
