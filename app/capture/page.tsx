// app/capture/page.tsx
// The brain-dump page: one textarea for everything the student is juggling,
// or three questions for a starter plan when they don't know where to begin.
import Link from 'next/link'
import AgentMigrationNotice from '@/components/AgentMigrationNotice'
import AgentTabs from '@/components/AgentTabs'
import AppNav from '@/components/AppNav'
import { isMissingTable } from '@/components/MigrationNotice'
import SubmitButton from '@/components/SubmitButton'
import { requireUser } from '@/lib/auth'
import { timeAgo } from '@/lib/format'
import { calendarStatus } from '@/lib/agent/calendar-status'
import { WHEN_OPTIONS } from '@/lib/agent/starter-options'
import { disconnectCalendar } from '@/app/calendar/actions'
import { makePlan, makeStarterPlan } from './actions'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type Capture = { id: string; text: string; status: string; created_at: string }

export default async function CapturePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; retry?: string; start?: string }>
}) {
  const { error, retry, start } = await searchParams
  const { supabase, user } = await requireUser()

  const [settingsRes, capturesRes, calendar] = await Promise.all([
    supabase.from('agent_settings').select('daily_minutes').eq('user_id', user.id).maybeSingle(),
    supabase
      .from('agent_captures')
      .select('id, text, status, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5),
    calendarStatus(user.id),
  ])
  const missing = isMissingTable(settingsRes.error) || isMissingTable(capturesRes.error)
  const captures = (capturesRes.data ?? []) as Capture[]

  // Ask for hours only when nothing else can size the days.
  const hoursKnown = settingsRes.data?.daily_minutes != null || (calendar.connected && !calendar.needsReconnect)
  const retryId = retry && UUID.test(retry) ? retry : null
  const starting = start === '1'

  // After a failure, the saved text goes back in the box. A starter run's
  // text is its answers, not something to edit, so it stays out.
  let savedText = ''
  if (retryId && !missing) {
    const { data } = await supabase
      .from('agent_captures')
      .select('text')
      .eq('id', retryId)
      .eq('user_id', user.id)
      .maybeSingle()
    const text = (data?.text as string | undefined) ?? ''
    if (!text.startsWith('Starter plan · ')) savedText = text
  }

  const hoursField = hoursKnown ? null : (
    <div className="field" style={{ maxWidth: 360 }}>
      <label htmlFor="daily_hours">About how many hours a day do you have for this?</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <input id="daily_hours" name="daily_hours" type="number" min={0} max={12} step={0.5} required className="input" style={{ width: 90 }} />
        <a href="/calendar/connect" className="link" style={{ fontSize: 14 }}>
          {calendar.needsReconnect ? 'Reconnect Google Calendar' : 'Connect Google Calendar'}
        </a>
      </div>
      <input type="hidden" name="hours_required" value="1" />
    </div>
  )

  return (
    <>
      <AppNav active="plans" />
      <AgentTabs active="capture" />
      <main className="page" style={{ display: 'flex', flexWrap: 'wrap', gap: 48, alignItems: 'flex-start' }}>
        <div style={{ flex: '1 1 420px', minWidth: 0 }}>
          <div className="eyebrow" style={{ marginBottom: 16 }}>Capture</div>
          <h1 className="title" style={{ marginBottom: 32 }}>What&apos;s on your mind?</h1>

          {error ? <div className="alert" role="alert">{error}</div> : null}
          {missing ? <AgentMigrationNotice /> : null}

          {retryId ? (
            <form action={makePlan} style={{ marginBottom: 28 }}>
              <input type="hidden" name="capture_id" value={retryId} />
              <SubmitButton pendingText="Making your plan…" className="btn btn-outline">Try again</SubmitButton>
            </form>
          ) : null}

          {!missing && !starting ? (
            <form action={makePlan} className="form">
              <div className="field">
                <label htmlFor="text">Everything you&apos;re juggling. Messy is fine.</label>
                <textarea key={retryId ?? 'new'} id="text" name="text" required rows={7} maxLength={5000} defaultValue={savedText} className="input" />
              </div>
              {hoursField}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
                <Link href="/capture?start=1" className="link-quiet">Not sure where to start?</Link>
                <SubmitButton pendingText="Making your plan…">Make my plan</SubmitButton>
              </div>
            </form>
          ) : null}

          {!missing && starting ? (
            <form action={makeStarterPlan} className="form">
              <div className="field">
                <label htmlFor="role">What kind of role do you want, if you have one in mind?</label>
                <input id="role" name="role" maxLength={200} placeholder="Product designer, ML engineer…" className="input" />
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, marginTop: 6 }}>
                  <input type="checkbox" name="no_idea" /> No idea yet
                </label>
              </div>
              <div className="field" style={{ maxWidth: 360 }}>
                <label htmlFor="when">When do you want to have it by?</label>
                <select id="when" name="when" defaultValue="Not sure" className="input">
                  {WHEN_OPTIONS.map((w) => <option key={w} value={w}>{w}</option>)}
                </select>
              </div>
              {hoursField}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
                <Link href="/capture" className="link-quiet">Back to writing it out</Link>
                <SubmitButton pendingText="Making your starter plan…">Make my starter plan</SubmitButton>
              </div>
            </form>
          ) : null}
        </div>

        <aside style={{ flex: '0 1 320px', minWidth: 0 }}>
          <div className="label" style={{ marginBottom: 12 }}>What happens next</div>
          <ol className="rows" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            <li className="row body-copy">Links sorts it into plans: career goals and personal ideas, side by side.</li>
            <li className="row body-copy">It checks your people for a warm path, and tells you what to pause.</li>
            <li className="row body-copy">Anything that leaves Links, like a message or a calendar item, waits for your OK.</li>
          </ol>

          <div className="label" style={{ margin: '36px 0 10px' }}>Calendar</div>
          {calendar.connected ? (
            <div className="meta">
              {calendar.needsReconnect ? (
                <a href="/calendar/connect" className="link" style={{ fontSize: 14 }}>Reconnect Google Calendar</a>
              ) : (
                'Calendar connected'
              )}
              {' · '}
              <form action={disconnectCalendar} style={{ display: 'inline' }}>
                <button type="submit" className="link-quiet">Disconnect</button>
              </form>
            </div>
          ) : (
            <div className="meta">
              Not connected{hoursKnown ? <> · <a href="/calendar/connect" className="link" style={{ fontSize: 14 }}>Connect Google Calendar</a></> : null}
            </div>
          )}

          {captures.length ? (
            <>
              <div className="label" style={{ margin: '36px 0 10px' }}>Recent captures</div>
              <ul className="meta" style={{ listStyle: 'none', margin: 0, padding: 0, lineHeight: 1.9 }}>
                {captures.map((c) => (
                  <li key={c.id}>
                    {c.text.length > 60 ? `${c.text.slice(0, 60)}…` : c.text} · {timeAgo(c.created_at)}
                    {c.status === 'failed' ? (
                      <> · <span className="accent">Didn&apos;t finish</span> · <Link href={`/capture?retry=${c.id}`} className="link" style={{ fontSize: 14 }}>Try again</Link></>
                    ) : null}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </aside>
      </main>
    </>
  )
}
