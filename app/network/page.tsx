// app/network/page.tsx
import Link from 'next/link'
import AppNav from '@/components/AppNav'
import AddContactDialog from '@/components/AddContactDialog'
import { requireUser } from '@/lib/auth'
import { embed } from '@/lib/embeddings'
import { initials, needsFollowUp, timeAgo } from '@/lib/format'
import { cosine, parseVector } from '@/lib/similarity'

type Contact = {
  id: string
  full_name: string
  role: string | null
  company: string | null
  met_context: string | null
  tags: string[] | null
  last_interaction_at: string | null
  contact_embedding: unknown
}

// How many results an "Ask" search keeps. Contacts are ranked by meaning,
// not filtered by keyword, so a cutoff keeps the list to the useful top.
const ASK_RESULTS = 5

export default async function NetworkPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; add?: string; error?: string }>
}) {
  const { q, add, error } = await searchParams
  const { supabase } = await requireUser()

  const { data } = await supabase
    .from('network_contacts')
    .select('id, full_name, role, company, met_context, tags, last_interaction_at, contact_embedding')
    .order('last_interaction_at', { ascending: false, nullsFirst: false })
  const all = (data ?? []) as Contact[]

  const query = q?.trim()
  let contacts = all
  if (query && all.length) {
    const qv = await embed(query)
    contacts = all
      .map((c) => {
        const v = parseVector(c.contact_embedding)
        return { c, score: v ? cosine(qv, v) : -1 }
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, ASK_RESULTS)
      .map((x) => x.c)
  }

  const followUps = all.filter((c) => needsFollowUp(c.last_interaction_at)).length

  return (
    <div className="l-page">
      <AppNav active="network" />

      <div className="l-row-head">
        <div>
          <h1 className="l-page-title" style={{ margin: '0 0 10px' }}>Your network</h1>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <span className="l-chip l-chip-strong">{all.length} contact{all.length === 1 ? '' : 's'}</span>
            <span className="l-chip l-chip-neutral">{followUps} need{followUps === 1 ? 's' : ''} follow-up</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <form action="/network" role="search" style={{ display: 'flex', gap: 8 }}>
            <label htmlFor="ask" className="sr-only">
              Ask your network
            </label>
            <input
              id="ask"
              name="q"
              defaultValue={query}
              placeholder="Ask: who can help me break into ML infra?"
              className="l-input l-input-sm"
              style={{ width: 'min(320px, 70vw)', borderRadius: 999, height: 44, padding: '0 16px' }}
            />
          </form>
          <AddContactDialog openOnLoad={add === '1'} />
        </div>
      </div>

      {error ? <div className="l-card l-card-soft" style={{ color: '#a01818', fontWeight: 600 }}>{error}</div> : null}

      {query ? (
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--links-text-muted)' }}>
          Best matches for “{query}” · <Link href="/network" className="l-link">Clear</Link>
        </div>
      ) : null}

      {all.length === 0 ? (
        <div className="l-card l-card-soft">
          <p className="l-body" style={{ margin: 0 }}>
            No contacts yet. Add the first person you talked to, from a career fair, a coffee chat or a LinkedIn message.
          </p>
        </div>
      ) : (
        <div className="l-table-wrap">
          <table className="l-table">
            <thead>
              <tr>
                <th style={{ width: '28%' }}>Contact</th>
                <th style={{ width: '15%' }}>How you met</th>
                <th style={{ width: '20%' }}>Tags</th>
                <th style={{ width: '13%' }}>Last contact</th>
                <th style={{ width: '15%' }}>Status</th>
                <th style={{ width: '9%' }}><span className="sr-only">Open</span></th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((c) => {
                const stale = needsFollowUp(c.last_interaction_at)
                return (
                  <tr key={c.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div className="l-avatar l-avatar-sm">{initials(c.full_name)}</div>
                        <div>
                          <div style={{ fontWeight: 700 }}>{c.full_name}</div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(19,19,22,0.55)' }}>
                            {[c.role, c.company].filter(Boolean).join(' · ')}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>{c.met_context ? <span className="l-chip l-chip-sm l-chip-strong">{c.met_context}</span> : null}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {(c.tags ?? []).map((t) => (
                          <span key={t} className="l-chip l-chip-sm l-chip-muted">{t}</span>
                        ))}
                      </div>
                    </td>
                    <td style={{ color: 'rgba(19,19,22,0.6)', fontWeight: 600 }}>{timeAgo(c.last_interaction_at)}</td>
                    <td>
                      <span className={`l-chip l-chip-sm ${stale ? 'l-chip-neutral' : ''}`}>{stale ? 'Needs follow-up' : 'On track'}</span>
                    </td>
                    <td>
                      <Link href={`/network/${c.id}`} className="l-link" aria-label={`View ${c.full_name}`}>View →</Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
