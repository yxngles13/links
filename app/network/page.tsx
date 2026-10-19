// app/network/page.tsx
import Link from 'next/link'
import AppNav from '@/components/AppNav'
import ProfileReminder from '@/components/ProfileReminder'
import AddContactDialog from '@/components/AddContactDialog'
import LinkedInLink from '@/components/LinkedInLink'
import { requireUser } from '@/lib/auth'
import { embed } from '@/lib/embeddings'
import { needsFollowUp, timeAgo } from '@/lib/format'
import { cosine, parseVector } from '@/lib/similarity'

type Contact = {
  id: string
  full_name: string
  role: string | null
  company: string | null
  met_context: string | null
  tags: string[] | null
  linkedin_url: string | null
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
    .select('id, full_name, role, company, met_context, tags, linkedin_url, last_interaction_at, contact_embedding')
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
    <>
      <AppNav active="network" />
      <ProfileReminder />
      <main className="page">
        <div className="head-row">
          <div>
            <h1 className="title" style={{ marginBottom: 10 }}>Your network</h1>
            <div className="meta">
              {all.length} contact{all.length === 1 ? '' : 's'}
              {followUps ? <> · <span className="accent">{followUps} need{followUps === 1 ? 's' : ''} a follow-up</span></> : null}
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 28 }}>
            <form action="/network" role="search" className="field" style={{ width: 320, maxWidth: '100%' }}>
              <label htmlFor="ask">Ask your network</label>
              <input id="ask" name="q" defaultValue={query} placeholder="Who can help me break into ML infra?" className="input" style={{ fontSize: 15 }} />
            </form>
            <AddContactDialog openOnLoad={add === '1'} />
          </div>
        </div>

        {error ? <div className="alert" role="alert">{error}</div> : null}
        {query ? (
          <div className="meta" style={{ marginBottom: 20 }}>
            Best matches for “{query}” · <Link href="/network" className="link" style={{ fontSize: 14 }}>Clear</Link>
          </div>
        ) : null}

        {all.length === 0 ? (
          <div className="notice">
            <p className="body-copy">No contacts yet. Add the first person you talked to, from a career fair, a coffee chat or a LinkedIn message.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: '29%' }}>Contact</th>
                  <th style={{ width: '15%' }}>How you met</th>
                  <th style={{ width: '17%' }}>Tags</th>
                  <th style={{ width: '13%' }}>Last contact</th>
                  <th style={{ width: '15%' }}>Status</th>
                  <th style={{ width: '11%' }}>LinkedIn</th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((c) => {
                  const stale = needsFollowUp(c.last_interaction_at)
                  return (
                    <tr key={c.id}>
                      <td>
                        <Link href={`/network/${c.id}`} className="name-sm" style={{ display: 'block', color: 'var(--ink)' }}>{c.full_name}</Link>
                        <span style={{ fontSize: 13, color: 'var(--muted)' }}>{[c.role, c.company].filter(Boolean).join(' · ')}</span>
                      </td>
                      <td>{c.met_context}</td>
                      <td>{(c.tags ?? []).join(', ')}</td>
                      <td>{timeAgo(c.last_interaction_at)}</td>
                      <td className={stale ? 'accent' : undefined}>{stale ? 'Needs follow-up' : 'On track'}</td>
                      <td>
                        {c.linkedin_url ? (
                          <LinkedInLink url={c.linkedin_url} name={c.full_name} style={{ fontSize: 13 }} />
                        ) : (
                          <Link href={`/network/${c.id}#linkedin`} className="link-quiet" style={{ fontSize: 13 }}>Add</Link>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  )
}
