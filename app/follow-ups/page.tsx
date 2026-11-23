// app/follow-ups/page.tsx
// Everyone in the network who's due a follow-up, longest-waiting first, with
// the start of their drafted note. Editing and rewriting happen on the
// contact's page.
import Link from 'next/link'
import { requireUser } from '@/lib/auth'
import { initials, needsFollowUp, timeAgo } from '@/lib/format'
import { pastelFor } from '@/lib/theme'

type Contact = { id: string; full_name: string; role: string | null; company: string | null; last_interaction_at: string | null }

const PREVIEW_LENGTH = 140

function preview(text: string) {
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length > PREVIEW_LENGTH ? `${flat.slice(0, PREVIEW_LENGTH).trimEnd()}…` : flat
}

export default async function FollowUpsPage() {
  const { supabase } = await requireUser()

  // Never-contacted first, then oldest contact first.
  const [{ data: contacts }, { data: drafts }] = await Promise.all([
    supabase
      .from('network_contacts')
      .select('id, full_name, role, company, last_interaction_at')
      .order('last_interaction_at', { ascending: true, nullsFirst: true }),
    supabase.from('network_follow_ups').select('contact_id, draft_text').eq('kind', 'follow_up'),
  ])
  const due = ((contacts ?? []) as Contact[]).filter((c) => needsFollowUp(c.last_interaction_at))
  const draftFor = new Map((drafts ?? []).map((d) => [d.contact_id as string, d.draft_text as string]))

  return (
    <main className="page">
      <h1 className="title" style={{ marginBottom: 10 }}>Follow-ups</h1>
      <div className="meta" style={{ marginBottom: 24 }}>
        {due.length ? `${due.length} contact${due.length === 1 ? '' : 's'} waiting on you` : 'Nobody is waiting on you'}
      </div>

      {due.length === 0 ? (
        <div className="notice">
          <p className="body-copy">
            You&apos;re all caught up. When two weeks pass without logging a chat with someone, they show up here.{' '}
            <Link href="/network" className="link">Go to your network</Link>
          </p>
        </div>
      ) : (
        <ul className="rank-list measure">
          {due.map((c) => {
            const draft = draftFor.get(c.id)
            const sub = [c.role, c.company].filter(Boolean).join(' · ')
            return (
              <li key={c.id}>
                <Link href={`/network/${c.id}`} className="card prof-card fu-card">
                  <div className="prof-top">
                    <span aria-hidden="true" className={`initials-tile initials-tile-${pastelFor(c.full_name)}`}>{initials(c.full_name)}</span>
                    <div>
                      <h2 className="prof-name">{c.full_name}</h2>
                      {sub ? <p className="prof-sub">{sub}</p> : null}
                    </div>
                    <span className="pill pill-peach">Last contact {timeAgo(c.last_interaction_at).toLowerCase()}</span>
                  </div>
                  <p className={draft ? 'fu-preview' : 'fu-preview fu-empty'}>
                    {draft ? preview(draft) : 'No draft yet. Open to write one.'}
                  </p>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </main>
  )
}
