// app/api/contacts/parse/route.ts
//
// AI prefill for the Chrome extension: POST { url, text } with the visible
// text of the LinkedIn profile the student clicked on, get back the form's
// fields. One AI credit per call; the popup caches results per profile so
// reopening it doesn't spend another. The text itself is never stored.
//
//   POST -> { full_name, role, company, notes, tags }

import { NextResponse } from 'next/server'
import { OUT_OF_CREDITS, spendCredit } from '@/lib/credits'
import { allowedOrigin, getUser } from '@/lib/extension-api'
import { canonicalProfileUrl } from '@/lib/linkedin-parse'
import { parseLinkedInProfile } from '@/lib/parse-linkedin-profile'

const MAX_TEXT = 20000 // the popup sends at most 15,000

export async function POST(request: Request) {
  if (!allowedOrigin(request)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { supabase, user } = await getUser()
  if (!user) return NextResponse.json({ error: 'Sign in to Links first.' }, { status: 401 })

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Expected a JSON body.' }, { status: 400 })
  }

  const url = typeof body.url === 'string' ? canonicalProfileUrl(body.url) : null
  const text = typeof body.text === 'string' ? body.text.trim() : ''
  if (!url) return NextResponse.json({ error: 'Not a LinkedIn profile.' }, { status: 400 })
  if (!text) return NextResponse.json({ error: 'No profile text.' }, { status: 400 })
  if (text.length > MAX_TEXT) return NextResponse.json({ error: 'Profile text is too long.' }, { status: 413 })

  if (!(await spendCredit(supabase))) return NextResponse.json({ error: OUT_OF_CREDITS }, { status: 429 })

  const parsed = await parseLinkedInProfile(text)
  if (!parsed) return NextResponse.json({ error: "Couldn't read this profile." }, { status: 502 })
  return NextResponse.json(parsed)
}
