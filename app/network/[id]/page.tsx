// app/network/[id]/page.tsx
import Link from 'next/link'
import { notFound } from 'next/navigation'
import AppNav from '@/components/AppNav'
import CopyButton from '@/components/CopyButton'
import SubmitButton from '@/components/SubmitButton'
import { requireUser } from '@/lib/auth'
import { needsFollowUp, timeAgo } from '@/lib/format'
import { deleteContact, logInteraction } from '../actions'

const INTERACTION_TYPES = ['LinkedIn message', 'Email', 'Call', 'Coffee chat', 'Meeting', 'Note']

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.5)', marginBottom: 3, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 600 }}>{children}</div>
    </div>
  )
}

export default async function ContactPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { id } = await params
  const { error } = await searchParams
  const { supabase } = await requireUser()

  // RLS restricts every one of these to the signed-in user's own contacts.
  const [{ data: contact }, { data: interactions }, { data: summary }, { data: followUps }] = await Promise.all([
    supabase
      .from('network_contacts')
      .select('id, full_name, role, company, met_context, linkedin_url, tags, last_interaction_at')
      .eq('id', id)
      .maybeSingle(),
    supabase
      .from('network_interactions')
      .select('id, interaction_type, notes, occurred_at')
      .eq('contact_id', id)
      .order('occurred_at', { ascending: false }),
    supabase.from('network_contact_summaries').select('summary').eq('contact_id', id).maybeSingle(),
    supabase.from('network_follow_ups').select('kind, draft_text').eq('contact_id', id).order('created_at'),
  ])

  if (!contact) notFound()

  const questions = (followUps ?? []).filter((f) => f.kind === 'question').map((f) => f.draft_text as string)
  const draft = (followUps ?? []).find((f) => f.kind === 'follow_up')?.draft_text as string | undefined
  const roleLine = [contact.role, contact.company].filter(Boolean).join(', ')

  return (
    <div className="l-page">
      <AppNav active="network" />

      <div>
        <Link href="/network" style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--links-text-faint)' }}>← Your network</Link>
        <h1 className="l-page-title" style={{ margin: '10px 0 4px' }}>{contact.full_name}</h1>
        {roleLine ? <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--links-text-faint)' }}>{roleLine}</div> : null}
      </div>

      <div className="l-layout">
        <div className="l-main" style={{ gap: 18 }}>
          {error ? <div className="l-card l-card-soft" style={{ color: '#a01818', fontWeight: 600 }}>{error}</div> : null}

          {summary?.summary ? (
            <div className="l-card l-card-tint" style={{ borderRadius: 22 }}>
              <div className="l-eyebrow" style={{ color: 'var(--links-secondary)', marginBottom: 10 }}>Summary</div>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 500, lineHeight: 1.7 }}>{summary.summary}</p>
            </div>
          ) : null}

          <section>
            <h2 className="l-eyebrow" style={{ margin: '0 0 10px' }}>Timeline</h2>
            {interactions?.length ? (
              <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {interactions.map((i) => (
                  <li key={i.id} className="l-card l-card-soft" style={{ borderRadius: 16, padding: '14px 18px' }}>
                    <div style={{ fontSize: 11.5, fontWeight: 800, color: 'rgba(19,19,22,0.45)', marginBottom: 4, textTransform: 'uppercase' }}>
                      {timeAgo(i.occurred_at)}{i.interaction_type ? ` · ${i.interaction_type}` : ''}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{i.notes}</div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="l-body" style={{ margin: 0 }}>Nothing logged yet.</p>
            )}
          </section>

          {questions.length ? (
            <section>
              <h2 className="l-eyebrow" style={{ margin: '0 0 10px' }}>Questions for your next chat</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {questions.map((q, i) => (
                  <div key={i} className="l-card l-card-soft" style={{ borderRadius: 16, padding: '15px 18px', fontSize: 14.5, fontWeight: 600, lineHeight: 1.5 }}>{q}</div>
                ))}
              </div>
            </section>
          ) : null}

          {draft ? (
            <section>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <h2 className="l-eyebrow" style={{ margin: 0 }}>Follow-up draft</h2>
                <CopyButton text={draft} />
              </div>
              <div className="l-card l-card-soft" style={{ borderRadius: 20, padding: 20, fontSize: 14.5, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{draft}</div>
            </section>
          ) : null}

          <form action={logInteraction} className="l-card l-card-soft" style={{ borderRadius: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h2 className="l-eyebrow" style={{ margin: 0 }}>Log a new interaction</h2>
            <input type="hidden" name="contact_id" value={contact.id} />
            <div className="l-field">
              <label htmlFor="interaction_type" className="l-label">Type</label>
              <select id="interaction_type" name="interaction_type" className="l-input l-input-sm" style={{ background: '#fff' }} defaultValue="LinkedIn message">
                {INTERACTION_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="l-field">
              <label htmlFor="notes" className="l-label">What happened?</label>
              <textarea id="notes" name="notes" rows={3} required placeholder="Call, message, coffee chat…" className="l-textarea" style={{ background: '#fff', resize: 'vertical' }} />
            </div>
            <SubmitButton pendingText="Saving and updating the summary…">Save interaction</SubmitButton>
          </form>
        </div>

        <aside className="l-side">
          <div className="l-card l-card-dark" style={{ borderRadius: 22, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="l-eyebrow">Contact info</div>
            {roleLine ? <Fact label="Role">{roleLine}</Fact> : null}
            {contact.met_context ? <Fact label="How you met">{contact.met_context}</Fact> : null}
            <Fact label="Last contact">
              {timeAgo(contact.last_interaction_at)}
              {needsFollowUp(contact.last_interaction_at) ? ' · time to follow up' : ''}
            </Fact>
            {contact.tags?.length ? (
              <Fact label="Tags">
                <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {contact.tags.map((t: string) => <span key={t} className="l-chip l-chip-sm l-chip-on-dark">{t}</span>)}
                </span>
              </Fact>
            ) : null}
            {contact.linkedin_url ? (
              <a href={contact.linkedin_url} target="_blank" rel="noreferrer" style={{ fontSize: 13, fontWeight: 800, color: 'var(--links-accent-on-dark)' }}>
                View LinkedIn →
              </a>
            ) : null}
          </div>

          <details className="l-details" style={{ padding: '0 6px' }}>
            <summary style={{ fontSize: 13, fontWeight: 700, color: 'var(--links-text-faint)' }}>Delete contact</summary>
            <form action={deleteContact} style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input type="hidden" name="contact_id" value={contact.id} />
              <p className="l-hint">Removes {contact.full_name} and their whole timeline. This can&apos;t be undone.</p>
              <button type="submit" className="l-btn l-btn-sm" style={{ background: '#a01818', color: '#fff' }}>Delete for good</button>
            </form>
          </details>
        </aside>
      </div>
    </div>
  )
}
