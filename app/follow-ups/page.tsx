// app/follow-ups/page.tsx
// Everyone in the network who's due a follow-up, longest-waiting first, with
// the start of their drafted note. Editing and rewriting happen on the
// contact's page.
import Link from 'next/link'
import { requireUser } from '@/lib/auth'
import { needsFollowUp, timeAgo } from '@/lib/format'

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
      <div className="meta" style={{ marginBottom: 28 }}>
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
        <div className="rows measure">
          {due.map((c) => {
            const draft = draftFor.get(c.id)
            return (
              <Link key={c.id} href={`/network/${c.id}`} className="row">
                <div className="row-split" style={{ alignItems: 'baseline' }}>
                  <span className="name-sm">{c.full_name}</span>
                  <span className="meta accent" style={{ fontSize: 13 }}>Last contact {timeAgo(c.last_interaction_at).toLowerCase()}</span>
                </div>
                {c.role || c.company ? (
                  <div style={{ fontSize: 13, color: 'var(--muted)' }}>{[c.role, c.company].filter(Boolean).join(' · ')}</div>
                ) : null}
                <p className="body-copy" style={{ fontSize: 14, margin: '8px 0 0', color: draft ? undefined : 'var(--muted)' }}>
                  {draft ? preview(draft) : 'No draft yet. Open to write one.'}
                </p>
              </Link>
            )
          })}
        </div>
      )}
    </main>
  )
}
