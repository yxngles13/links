// app/calendar/connect/route.ts
//
// Starts the Google Calendar OAuth flow: stash a random `state` in a short
// httpOnly cookie, then send the student to Google. The callback checks it.

import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { authUrl, googleConfigured } from '@/lib/agent/google'

export async function GET(request: Request) {
  await requireUser()
  const { origin } = new URL(request.url)

  if (!googleConfigured()) {
    const url = new URL('/capture', origin)
    url.searchParams.set('error', "Google Calendar isn't set up yet")
    return NextResponse.redirect(url)
  }

  const state = crypto.randomUUID()
  const response = NextResponse.redirect(authUrl(state, `${origin}/calendar/callback`))
  response.cookies.set('cal_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/calendar',
    maxAge: 600,
  })
  return response
}
