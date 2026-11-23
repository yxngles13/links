// lib/extension-api.ts
// Shared by the Chrome extension's endpoints (app/api/contacts/…). The
// extension sends the user's normal Links session cookie (it has host
// permission for this site), so a user signed in to Links in Chrome is
// signed in to the extension too.
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'

// The extension's requests carry Origin: chrome-extension://<id>. Anything
// else from another site is refused, so a random page can't act with a
// signed-in user's cookie.
export function allowedOrigin(request: Request) {
  const origin = request.headers.get('origin')
  if (!origin) return true // same-origin GETs may omit it
  return origin.startsWith('chrome-extension://') || origin === new URL(request.url).origin
}

export async function getUser() {
  const supabase = createClient(await cookies())
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return { supabase, user }
}
