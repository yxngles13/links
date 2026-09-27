// app/auth/confirm/route.ts
//
// Supabase's confirmation email links to a URL containing `?code=...`.
// Nothing automatically does anything with that code — this route is what
// takes it and exchanges it for an actual session, which is what sets the
// cookies your server code (middleware, Server Actions, pages) reads from.
// Without this route existing, the confirmation link is a dead end: it
// loads a page, but no session ever gets created.

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/matches'

  if (code) {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Either there was no code, or exchanging it failed (expired/used link,
  // etc.) — send them back to login with something to show for it rather
  // than silently landing somewhere confusing.
  return NextResponse.redirect(`${origin}/login?error=Could not confirm email — try signing in`)
}