// lib/auth.ts
// Every page and server action under the app needs "a Supabase client plus
// the signed-in user, or bounce to /login". The proxy already redirects
// logged-out page loads, but server actions can be POSTed directly, so they
// must check again themselves.
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

export async function requireUser() {
  const supabase = createClient(await cookies())
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  return { supabase, user }
}

export function displayName(user: { email?: string; user_metadata?: Record<string, unknown> }) {
  const full = user.user_metadata?.full_name
  if (typeof full === 'string' && full.trim()) return full.trim()
  return user.email?.split('@')[0] ?? 'there'
}
