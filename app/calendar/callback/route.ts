// app/calendar/callback/route.ts
//
// Google sends the student back here with `?code=...&state=...`. We check the
// state against the cookie, swap the code for tokens, and store them with the
// service role (the table has no RLS policies, so only the server can touch it).

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { requireUser } from '@/lib/auth'
import { createAdminClient } from '@/utils/supabase/admin'
import { exchangeCode, GoogleTokenError } from '@/lib/agent/google'

export async function GET(request: Request) {
  const { user } = await requireUser()
  const { searchParams, origin } = new URL(request.url)

  const fail = () => {
    const url = new URL('/capture', origin)
    url.searchParams.set('error', "Couldn't connect Google Calendar")
    const res = NextResponse.redirect(url)
    res.cookies.delete({ name: 'cal_state', path: '/calendar' })
    return res
  }

  const cookieStore = await cookies()
  const expected = cookieStore.get('cal_state')?.value
  const code = searchParams.get('code')
  if (!expected || !code || searchParams.get('state') !== expected) return fail()

  try {
    const tokens = await exchangeCode(code, `${origin}/calendar/callback`)
    const admin = createAdminClient()

    const fields = {
      access_token: tokens.access_token,
      expires_at: tokens.expires_at,
      needs_reconnect: false,
    }

    // On a re-consent Google may omit the refresh token; keep the stored one.
    let error
    if (tokens.refresh_token) {
      ;({ error } = await admin
        .from('agent_calendar_connections')
        .upsert({ user_id: user.id, refresh_token: tokens.refresh_token, ...fields }))
    } else {
      const res = await admin
        .from('agent_calendar_connections')
        .update(fields)
        .eq('user_id', user.id)
        .select('user_id')
      error = res.error ?? (res.data?.length ? null : new Error('no stored token'))
    }
    if (error) return fail()
  } catch (e) {
    // Status only; never log bodies or tokens.
    console.error('Google Calendar connect failed', e instanceof GoogleTokenError ? e.status : 'unknown')
    return fail()
  }

  const res = NextResponse.redirect(new URL('/capture?calendar=connected', origin))
  res.cookies.delete({ name: 'cal_state', path: '/calendar' })
  return res
}
