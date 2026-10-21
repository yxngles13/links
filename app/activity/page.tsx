// app/activity/page.tsx
// What Links did, grouped by the brain dump that caused it, with Undo on
// anything the student hasn't touched since. The trust rules sit alongside.
import AgentMigrationNotice from '@/components/AgentMigrationNotice'
import AgentTabs from '@/components/AgentTabs'
import AppNav from '@/components/AppNav'
import { isMissingTable } from '@/components/MigrationNotice'
import { requireUser } from '@/lib/auth'
import { undoState, UNDO_EDITED } from '@/lib/agent/undo'
import { undoActivity } from './actions'
import { loadTarget, type Target, type UndoEntry } from './target'

type Entry = UndoEntry & { capture_id: string | null; summary: string }
type Capture = { id: string; text: string; created_at: string }

const PACIFIC = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Los_Angeles', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
})

export default async function ActivityPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams
  const { supabase, user } = await requireUser()

  const activityRes = await supabase
    .from('agent_activity')
    .select('id, capture_id, action, plan_id, step_id, summary, before, undone_at, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50)
  const missing = isMissingTable(activityRes.error)
  const entries = (activityRes.data ?? []) as Entry[]

  // Undo targets (same check the action runs) and captures.
  const captureIds = [...new Set(entries.map((e) => e.capture_id).filter((id): id is string => !!id))]
  const [targets, capturesRes] = await Promise.all([
    Promise.all(entries.map((e) => (e.undone_at || e.action === 'suggested_pause' ? null : loadTarget(supabase, user.id, e)))),
    captureIds.length ? supabase.from('agent_captures').select('id, text, created_at').eq('user_id', user.id).in('id', captureIds) : null,
  ])
  const targetOf = new Map<string, Target>(entries.map((e, i) => [e.id, targets[i]?.target ?? null]))
  const captures = new Map(((capturesRes?.data ?? []) as Capture[]).map((c) => [c.id, c]))

  const stateOf = (e: Entry) => undoState(e, targetOf.get(e.id) ?? null)

  // Group by capture. Entries arrive newest first, so groups are in newest-first
  // order already; within a group they are flipped to oldest first.
  const groups = new Map<string, Entry[]>()
  for (const e of entries) {
    const key = e.capture_id ?? 'other'
    groups.set(key, [...(groups.get(key) ?? []), e])
  }

  return (
    <>
      <AppNav active="plans" />
      <AgentTabs active="activity" />
      <div className="shell">
        <main className="main">
          <div className="eyebrow" style={{ marginBottom: 16 }}>Activity</div>
          <h1 className="title" style={{ marginBottom: 12 }}>What Links <em className="accent">did</em></h1>
          <p className="body-copy" style={{ marginBottom: 32 }}>Every change Links made, in order. Undo what you don&apos;t want.</p>

          {error ? <div className="alert" role="alert">{error}</div> : null}
          {missing ? <AgentMigrationNotice /> : null}
          {!missing && entries.length === 0 ? <p className="meta">Nothing yet. Links lists its changes here.</p> : null}

          {[...groups.entries()].map(([key, group]) => {
            const capture = captures.get(key)
            const title = key === 'other' || !capture ? 'Other' : capture.text.startsWith('Starter plan') ? 'Starter plan' : 'Brain dump'
            const when = capture ? PACIFIC.format(new Date(capture.created_at)) : null
            const ordered = [...group].reverse()
            return (
              <section key={key} style={{ marginBottom: 36 }}>
                <div className="row-split" style={{ alignItems: 'baseline', marginBottom: 6 }}>
                  <h2 className="title" style={{ fontSize: 26 }}>{title}</h2>
                  <span className="meta">{when ? <>{when} · </> : null}{group.length} {group.length === 1 ? 'change' : 'changes'}</span>
                </div>
                <ul className="rows" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {ordered.map((e) => {
                    const state = stateOf(e)
                    return (
                      <li key={e.id} className="row row-tight">
                        <div className="row-split">
                          <span style={{ minWidth: 0 }}>{e.summary}</span>
                          {state === 'available' ? (
                            <form action={undoActivity}>
                              <input type="hidden" name="entry_id" value={e.id} />
                              <button type="submit" className="btn btn-outline btn-sm">Undo</button>
                            </form>
                          ) : state === 'edited' ? (
                            <span className="meta" style={{ flexShrink: 0 }}>{UNDO_EDITED}</span>
                          ) : state === 'done' ? (
                            <span className="meta" style={{ flexShrink: 0 }}>Undone</span>
                          ) : null}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </section>
            )
          })}
        </main>

        <aside className="aside">
          <div className="label" style={{ marginBottom: 10 }}>Links can do on its own</div>
          <ul className="body-copy" style={{ listStyle: 'none', margin: '0 0 28px', padding: 0, lineHeight: 1.9 }}>
            <li>Read your plans and people</li>
            <li>Create and edit plans and steps</li>
            <li>Suggest a pause</li>
          </ul>
          <div className="label" style={{ marginBottom: 10 }}>Never</div>
          <ul className="body-copy" style={{ listStyle: 'none', margin: 0, padding: 0, lineHeight: 1.9 }}>
            <li>Send a message for you</li>
            <li>Read your calendar&apos;s events or your email (it only sees when you&apos;re busy)</li>
            <li>Invent a person or a deadline</li>
          </ul>
        </aside>
      </div>
    </>
  )
}
