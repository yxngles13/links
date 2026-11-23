// app/network/page.tsx
import Link from 'next/link'
import AddContactDialog from '@/components/AddContactDialog'
import LinkedInLink from '@/components/LinkedInLink'
import { requireUser } from '@/lib/auth'
import { embed } from '@/lib/embeddings'
import { initials, needsFollowUp, timeAgo } from '@/lib/format'
import { cosine, parseVector } from '@/lib/similarity'
import { pastelFor } from '@/lib/theme'

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
      <main className="page">
        <div className="head-row">
          <div>
            <h1 className="title" style={{ marginBottom: 10 }}>Your network</h1>
            <div className="meta">
              {all.length} contact{all.length === 1 ? '' : 's'}
              {followUps ? <> · <Link href="/follow-ups" className="accent">{followUps} need{followUps === 1 ? 's' : ''} a follow-up</Link></> : null}
            </div>
          </div>
          <div className="prof-tools net-tools">
            <form action="/network" role="search" style={{ display: 'contents' }}>
              <label className="search" htmlFor="ask">
                <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
                <span className="sr-only">Ask your network</span>
                <input id="ask" name="q" defaultValue={query} placeholder="Who can help me break into ML infra?" />
              </label>
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
          <ul className="prof-grid">
            {contacts.map((c) => {
              const stale = needsFollowUp(c.last_interaction_at)
              const sub = [c.role, c.company].filter(Boolean).join(' · ')
              return (
                <li key={c.id} style={{ minWidth: 0 }}>
                  <article className="card prof-card">
                    <div className="prof-top">
                      <span aria-hidden="true" className={`initials-tile initials-tile-${pastelFor(c.full_name)}`}>{initials(c.full_name)}</span>
                      <div>
                        <h2 className="prof-name"><Link href={`/network/${c.id}`}>{c.full_name}</Link></h2>
                        {sub ? <p className="prof-sub">{sub}</p> : null}
                      </div>
                    </div>
                    {c.met_context ? <p className="prof-sub" style={{ margin: 0 }}>Met via {c.met_context}</p> : null}
                    {c.tags?.length ? (
                      <div className="tags">{c.tags.map((t) => <span key={t} className="tag">{t}</span>)}</div>
                    ) : null}
                    <div className="prof-foot">
                      <span className="prof-sub" style={{ margin: 0 }}>Last contact {timeAgo(c.last_interaction_at).toLowerCase()}</span>
                      {stale ? <span className="pill pill-peach">Needs follow-up</span> : <span className="pill pill-mint">On track</span>}
                    </div>
                    <div className="prof-foot">
                      {c.linkedin_url ? (
                        <LinkedInLink url={c.linkedin_url} name={c.full_name} />
                      ) : (
                        <Link href={`/network/${c.id}#linkedin`} className="link-quiet">Add LinkedIn</Link>
                      )}
                    </div>
                  </article>
                </li>
              )
            })}
          </ul>
        )}
      </main>
    </>
  )
}
