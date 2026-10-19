// app/api/contacts/route.ts
//
// Backend for the Chrome extension's "+ Add to network" popup (extension/).
// The extension sends the user's normal Links session cookie (it has host
// permission for this site), so a user signed in to Links in Chrome is
// signed in to the extension too.
//
//   GET  -> { signedIn, name, metOptions }   popup uses this to show the form or a sign-in link
//   POST -> { id, url }                       saves a contact, same as the in-app dialog

import { cookies } from 'next/headers'
import { after, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { displayName } from '@/lib/auth'
import { MET_OPTIONS } from '@/lib/format'
import { createContact, recordInteraction } from '@/lib/network'
import { refreshContactContent } from '@/lib/generate-network-content'

// The extension's requests carry Origin: chrome-extension://<id>. Anything
// else from another site is refused, so a random page can't save contacts
// with a signed-in user's cookie.
function allowedOrigin(request: Request) {
  const origin = request.headers.get('origin')
  if (!origin) return true // same-origin GETs may omit it
  return origin.startsWith('chrome-extension://') || origin === new URL(request.url).origin
}

async function getUser() {
  const supabase = createClient(await cookies())
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return { supabase, user }
}

export async function GET(request: Request) {
  if (!allowedOrigin(request)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { user } = await getUser()
  return NextResponse.json({
    signedIn: !!user,
    name: user ? displayName(user) : null,
    metOptions: MET_OPTIONS,
  })
}

function str(v: unknown, max = 2000) {
  return typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null
}

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

  const fullName = str(body.full_name, 200)
  if (!fullName) return NextResponse.json({ error: 'Name is required.' }, { status: 400 })

  const linkedinUrl = str(body.linkedin_url, 500)
  const metContext = str(body.met_context, 100)
  const notes = str(body.notes)
  const tags = Array.isArray(body.tags)
    ? body.tags.map((t) => str(t, 50)).filter((t): t is string => !!t).slice(0, 10)
    : []

  try {
    const id = await createContact(supabase, user.id, {
      full_name: fullName,
      role: str(body.role, 200),
      company: str(body.company, 200),
      met_context: metContext,
      // Only keep http(s) links; this ends up in an <a href> on the contact page.
      linkedin_url: linkedinUrl && /^https?:\/\//i.test(linkedinUrl) ? linkedinUrl : null,
      tags,
      notes,
    })
    await recordInteraction(
      supabase,
      id,
      { interaction_type: metContext, notes: notes ?? `Met ${fullName}.` },
      displayName(user),
      { refresh: false }
    )

    // The summary, questions and follow-up draft take a few seconds of LLM
    // time. Write them after responding so the popup closes right away; the
    // contact page shows them once they land.
    after(() => refreshContactContent(id, supabase, displayName(user)))

    return NextResponse.json({ id, url: new URL(`/network/${id}`, request.url).toString() }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
