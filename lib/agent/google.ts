// lib/agent/google.ts — Google Calendar free/busy for the agent. Plain fetch
// against Google's OAuth and freeBusy endpoints; no SDK. Server-only: tokens
// live in agent_calendar_connections (service role) and never reach a client.
// No `@/` imports so authUrl can be unit-tested under `npm test`; the admin
// client is loaded lazily inside getBusy.

export const GOOGLE_SCOPE = 'https://www.googleapis.com/auth/calendar.freebusy'

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'
const FREEBUSY_ENDPOINT = 'https://www.googleapis.com/calendar/v3/freeBusy'

// Refresh when the access token expires within this many ms.
const REFRESH_SKEW_MS = 60_000

// Read at call time (not import time) so a missing env var never crashes.
export function googleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
}

// offline + consent so Google always hands back a refresh token.
export function authUrl(state: string, redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? '',
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: GOOGLE_SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    state,
  })
  return `${AUTH_ENDPOINT}?${params.toString()}`
}

// Token endpoint failure: just the HTTP status and Google's error code.
export class GoogleTokenError extends Error {
  status: number
  code?: string
  constructor(status: number, code?: string) {
    super(`Google token request failed (${status})`)
    this.status = status
    this.code = code
  }
}

async function tokenRequest(body: Record<string, string>) {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      ...body,
    }),
  })
  if (!res.ok) {
    // Keep only the status and Google's short error code, never the body.
    let code: string | undefined
    try {
      code = ((await res.json()) as { error?: string }).error
    } catch {}
    throw new GoogleTokenError(res.status, code)
  }
  return (await res.json()) as {
    access_token?: string
    refresh_token?: string
    expires_in?: number
  }
}

function expiryFrom(expiresIn: number | undefined): string {
  return new Date(Date.now() + (expiresIn ?? 3600) * 1000).toISOString()
}

export async function exchangeCode(
  code: string,
  redirectUri: string,
): Promise<{ refresh_token: string; access_token: string; expires_at: string }> {
  const t = await tokenRequest({ code, redirect_uri: redirectUri, grant_type: 'authorization_code' })
  if (!t.access_token) throw new Error('Google did not return tokens')
  return {
    // '' when Google omits it on a re-consent; the caller keeps the stored one.
    refresh_token: t.refresh_token ?? '',
    access_token: t.access_token,
    expires_at: expiryFrom(t.expires_in),
  }
}

// Busy intervals for the student's primary calendar. Never throws.
//   'none'        - they never connected (select succeeded, no row)
//   'reconnect'   - Google rejected our tokens for good (invalid_grant / 401);
//                   flagged on the row so the UI can ask to reconnect
//   'unavailable' - anything transient (network, 429/5xx, bad JSON, DB error);
//                   the flag is never written for these
export async function getBusy(
  userId: string,
  timeMin: Date,
  timeMax: Date,
): Promise<{ start: string; end: string }[] | 'none' | 'reconnect' | 'unavailable'> {
  try {
    const { createAdminClient } = await import('../../utils/supabase/admin.ts')
    const admin = createAdminClient()

    const { data: conn, error } = await admin
      .from('agent_calendar_connections')
      .select('refresh_token, access_token, expires_at, needs_reconnect')
      .eq('user_id', userId)
      .maybeSingle()
    if (error) return 'unavailable'
    if (!conn) return 'none'

    const flagReconnect = async () => {
      await admin.from('agent_calendar_connections').update({ needs_reconnect: true }).eq('user_id', userId)
      return 'reconnect' as const
    }

    let accessToken: string | null = conn.access_token
    let refreshed = false
    const expiresAt = conn.expires_at ? new Date(conn.expires_at).getTime() : 0
    if (!accessToken || expiresAt - Date.now() < REFRESH_SKEW_MS) {
      let t
      try {
        t = await tokenRequest({ refresh_token: conn.refresh_token, grant_type: 'refresh_token' })
      } catch (e) {
        if (
          e instanceof GoogleTokenError &&
          (e.status === 401 || (e.status === 400 && e.code === 'invalid_grant'))
        ) {
          return await flagReconnect()
        }
        return 'unavailable'
      }
      if (!t.access_token) return 'unavailable'
      accessToken = t.access_token
      refreshed = true
      await admin
        .from('agent_calendar_connections')
        .update({ access_token: accessToken, expires_at: expiryFrom(t.expires_in) })
        .eq('user_id', userId)
    }

    const res = await fetch(FREEBUSY_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        timeZone: 'America/Los_Angeles',
        items: [{ id: 'primary' }],
      }),
    })
    // A 401 on a token we just refreshed is a real revocation; on a stored
    // token it may just be stale, so treat it as transient.
    if (res.status === 401) return refreshed ? await flagReconnect() : 'unavailable'
    if (!res.ok) return 'unavailable'

    const json = (await res.json()) as {
      calendars?: { primary?: { busy?: { start: string; end: string }[]; errors?: unknown[] } }
    }
    const primary = json.calendars?.primary
    if (!primary || primary.errors?.length || !Array.isArray(primary.busy ?? [])) return 'unavailable'

    if (conn.needs_reconnect) {
      await admin.from('agent_calendar_connections').update({ needs_reconnect: false }).eq('user_id', userId)
    }
    return (primary.busy ?? []).map((b) => ({ start: b.start, end: b.end }))
  } catch {
    return 'unavailable'
  }
}
