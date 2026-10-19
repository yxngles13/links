// app/network/[id]/page.tsx
import Link from 'next/link'
import { notFound } from 'next/navigation'
import AppNav from '@/components/AppNav'
import DraftEditor from '@/components/DraftEditor'
import SubmitButton from '@/components/SubmitButton'
import { requireUser } from '@/lib/auth'
import { creditsLeft, OUT_OF_CREDITS } from '@/lib/credits'
import { needsFollowUp, timeAgo } from '@/lib/format'
import LinkedInLink from '@/components/LinkedInLink'
import { deleteContact, logInteraction, rewriteFollowUpDraft, saveFollowUpDraft, setContactLinkedIn } from '../actions'

const INTERACTION_TYPES = ['LinkedIn message', 'Email', 'Call', 'Coffee chat', 'Meeting', 'Note']

function LinkedInForm({ id, current }: { id: string; current: string | null }) {
  return (
    <form action={setContactLinkedIn} style={{ display: 'flex', gap: 12, alignItems: 'flex-end', marginTop: current ? 10 : 0 }}>
      <input type="hidden" name="contact_id" value={id} />
      <div className="field" style={{ flex: 1 }}>
        <label htmlFor={`li-${id}`}>LinkedIn</label>
        <input id={`li-${id}`} name="linkedin_url" type="url" defaultValue={current ?? ''} placeholder="https://www.linkedin.com/in/…" className="input" style={{ fontSize: 14 }} />
      </div>
      <button type="submit" className="link" style={{ fontSize: 13 }}>Save</button>
    </form>
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
  const credits = await creditsLeft(supabase)

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
  const stale = needsFollowUp(contact.last_interaction_at)

  return (
    <>
      <AppNav active="network" />
      <div className="shell">
        <main className="main">
          <Link href="/network" className="back">← Your network</Link>
          <div className="eyebrow" style={{ margin: '22px 0 10px' }}>
            Last contact {timeAgo(contact.last_interaction_at).toLowerCase()} · <span className={stale ? 'accent' : undefined}>{stale ? 'Time to follow up' : 'On track'}</span>
          </div>
          <h1 className="title-sm" style={{ marginBottom: 4 }}>{contact.full_name}</h1>
          <div className="meta" style={{ marginBottom: 22, display: 'flex', flexWrap: 'wrap', gap: '4px 16px' }}>
            <span>{[contact.role, contact.company].filter(Boolean).join(' · ')}</span>
            <LinkedInLink url={contact.linkedin_url} name={contact.full_name} style={{ fontSize: 14 }} />
          </div>

          {error ? <div className="alert" role="alert">{error}</div> : null}
          {credits === 0 ? (
            <p className="meta" role="status" style={{ marginBottom: 22 }}>
              {OUT_OF_CREDITS} Anything you log still saves; the summary and draft below catch up tomorrow.
            </p>
          ) : null}
          {summary?.summary ? <p className="lead" style={{ marginBottom: 26 }}>{summary.summary}</p> : null}

          {questions.length ? (
            <section className="measure" style={{ marginBottom: 26 }}>
              <h2 className="label" style={{ margin: '0 0 6px', fontWeight: 400 }}>Questions for your next chat</h2>
              <ol className="rows" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {questions.map((q, i) => (
                  <li key={i} className="row row-tight numbered"><span className="num">{i + 1}</span>{q}</li>
                ))}
              </ol>
            </section>
          ) : null}

          <section className="measure">
            <DraftEditor
              label="Follow-up draft"
              text={draft ?? ''}
              idName="contact_id"
              idValue={contact.id}
              save={saveFollowUpDraft}
              rewrite={rewriteFollowUpDraft}
            />
          </section>
        </main>

        <aside className="aside" style={{ width: 340 }}>
          <div className="label" style={{ marginBottom: 12 }}>Timeline</div>
          {interactions?.length ? (
            <ol className="rows" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {interactions.map((i) => (
                <li key={i.id} className="row row-tight">
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>{timeAgo(i.occurred_at)}{i.interaction_type ? ` · ${i.interaction_type}` : ''}</div>
                  <div style={{ fontSize: 14, lineHeight: 1.5, marginTop: 3, whiteSpace: 'pre-wrap' }}>{i.notes}</div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="body-copy" style={{ fontSize: 14 }}>Nothing logged yet.</p>
          )}

          <details className="details" style={{ marginTop: 28 }} open={!!error}>
            <summary className="btn">Log a new interaction</summary>
            <form action={logInteraction} className="form" style={{ gap: 16, marginTop: 20 }}>
              <input type="hidden" name="contact_id" value={contact.id} />
              <div className="field">
                <label htmlFor="interaction_type">Type</label>
                <select id="interaction_type" name="interaction_type" className="input" defaultValue="LinkedIn message">
                  {INTERACTION_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="notes">What happened</label>
                <textarea id="notes" name="notes" rows={3} required placeholder="Call, message, coffee chat…" className="input" style={{ fontSize: 15 }} />
              </div>
              <SubmitButton className="btn btn-block" pendingText="Saving and updating the summary…">Save interaction</SubmitButton>
            </form>
          </details>

          <div className="label" style={{ margin: '32px 0 8px' }}>Contact info</div>
          <div className="rows">
            {contact.met_context ? <div className="row row-tight row-split" style={{ fontSize: 14 }}><span className="muted">Met via</span>{contact.met_context}</div> : null}
            {contact.tags?.length ? <div className="row row-tight row-split" style={{ fontSize: 14 }}><span className="muted">Tags</span>{contact.tags.join(', ')}</div> : null}
            <div className="row row-tight" id="linkedin">
              {contact.linkedin_url ? (
                <div className="row-split" style={{ fontSize: 14 }}>
                  <LinkedInLink url={contact.linkedin_url} name={contact.full_name} />
                  <details className="details">
                    <summary className="link-quiet" style={{ fontSize: 13 }}>Change</summary>
                    <LinkedInForm id={contact.id} current={contact.linkedin_url} />
                  </details>
                </div>
              ) : (
                <LinkedInForm id={contact.id} current={null} />
              )}
            </div>
          </div>

          <details className="details" style={{ marginTop: 32 }}>
            <summary className="link-quiet" style={{ fontSize: 13 }}>Delete contact</summary>
            <form action={deleteContact} style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-start' }}>
              <input type="hidden" name="contact_id" value={contact.id} />
              <p className="hint">Removes {contact.full_name} and their whole timeline. This can&apos;t be undone.</p>
              <button type="submit" className="btn btn-sm btn-danger">Delete for good</button>
            </form>
          </details>
        </aside>
      </div>
    </>
  )
}
