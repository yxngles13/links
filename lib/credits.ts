// lib/credits.ts
//
// Daily AI credits (see supabase/migrations/20261021000000_ai_credits.sql).
// Every Groq-backed action spends one before calling the model. Running out
// never blocks the action itself: the answers, contact or note still save,
// only the AI part waits until tomorrow.
//
// Until the migration is run, credits are off (everything is allowed), so
// the app keeps working exactly as before.
//
// Paused for testing: credits only apply when AI_CREDITS=on. While paused,
// every AI action is allowed and nothing is counted or shown, the same as
// before the migration. The table and functions stay in the database.
import type { SupabaseClient } from '@supabase/supabase-js'
import { isMissingTable } from '@/components/MigrationNotice'

export const DAILY_CREDITS = 5 // keep in sync with the migration

const creditsPaused = () => process.env.AI_CREDITS !== 'on'

// PGRST202 = PostgREST can't find the function (migration not run).
const isMissingFunction = (error: { code?: string; message?: string }) =>
  error.code === 'PGRST202' || isMissingTable(error) || /could not find the function/i.test(error.message ?? '')

export async function spendCredit(supabase: SupabaseClient): Promise<boolean> {
  if (creditsPaused()) return true
  const { data, error } = await supabase.rpc('spend_ai_credit')
  if (error) {
    if (isMissingFunction(error)) return true
    // A credits hiccup shouldn't take AI away; err on the side of the user.
    console.error('Could not spend AI credit:', error.message)
    return true
  }
  return data === true
}

// null = credits are paused or aren't set up yet (nothing to show).
export async function creditsLeft(supabase: SupabaseClient): Promise<number | null> {
  if (creditsPaused()) return null
  const { data, error } = await supabase.rpc('ai_credits_left')
  if (error) return null
  return typeof data === 'number' ? data : null
}

export const OUT_OF_CREDITS = `You've used today's ${DAILY_CREDITS} AI credits. They reset at midnight.`
