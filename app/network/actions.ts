// app/network/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireUser, displayName } from '@/lib/auth'
import { httpUrl, toArray } from '@/lib/format'
import { OUT_OF_CREDITS, spendCredit } from '@/lib/credits'
import { createContact, recordInteraction } from '@/lib/network'
import { rewriteDraft } from '@/lib/rewrite-draft'
import { MAX_DRAFT_LENGTH } from '@/lib/rewrite-prompt'

function fail(path: string, message: string): never {
  redirect(`${path}${path.includes('?') ? '&' : '?'}error=${encodeURIComponent(message)}`)
}

export async function addContact(formData: FormData) {
  const { supabase, user } = await requireUser()

  const fullName = String(formData.get('full_name') ?? '').trim()
  if (!fullName) fail('/network', 'Name is required')

  const metContext = String(formData.get('met_context') ?? '').trim() || null
  const notes = String(formData.get('notes') ?? '').trim() || null

  let contactId: string
  try {
    contactId = await createContact(supabase, user.id, {
      full_name: fullName,
      role: String(formData.get('role') ?? '').trim() || null,
      company: String(formData.get('company') ?? '').trim() || null,
      met_context: metContext,
      // Only http(s): this ends up in an <a href> on the contact page.
      linkedin_url: /^https?:\/\//i.test(String(formData.get('linkedin_url') ?? '').trim())
        ? String(formData.get('linkedin_url')).trim()
        : null,
      tags: toArray(formData.get('tags')),
      notes,
    })
    // The first meeting becomes the first timeline entry, so the contact
    // page has something to summarize from the start.
    await recordInteraction(
      supabase,
      contactId,
      { interaction_type: metContext, notes: notes ?? `Met ${fullName}.` },
      displayName(user)
    )
  } catch (err) {
    fail('/network', (err as Error).message)
  }

  revalidatePath('/network')
  redirect(`/network/${contactId}`)
}

export async function logInteraction(formData: FormData) {
  const { supabase, user } = await requireUser()
  const contactId = String(formData.get('contact_id') ?? '')
  const notes = String(formData.get('notes') ?? '').trim()
  if (!notes) fail(`/network/${contactId}`, 'Write a note about what happened first')

  // RLS limits this to the user's own contacts, so this select is also the
  // ownership check before anything is written.
  const { data: contact } = await supabase.from('network_contacts').select('id').eq('id', contactId).single()
  if (!contact) redirect('/network')

  try {
    await recordInteraction(
      supabase,
      contactId,
      { interaction_type: String(formData.get('interaction_type') ?? '').trim() || 'Note', notes },
      displayName(user)
    )
  } catch (err) {
    fail(`/network/${contactId}`, (err as Error).message)
  }

  revalidatePath('/network')
  revalidatePath(`/network/${contactId}`)
  redirect(`/network/${contactId}`)
}

export async function deleteContact(formData: FormData) {
  const { supabase } = await requireUser()
  const contactId = String(formData.get('contact_id') ?? '')
  // RLS limits deletes to the user's own contacts; the timeline, summary
  // and follow-up drafts cascade with it.
  const { error } = await supabase.from('network_contacts').delete().eq('id', contactId)
  if (error) fail(`/network/${contactId}`, error.message)

  revalidatePath('/network')
  redirect('/network')
}

export async function setContactLinkedIn(formData: FormData) {
  const { supabase } = await requireUser()
  const contactId = String(formData.get('contact_id') ?? '')
  const raw = String(formData.get('linkedin_url') ?? '').trim()
  const url = httpUrl(raw)
  if (raw && !url) fail(`/network/${contactId}`, 'LinkedIn link should start with https://')

  // RLS limits updates to the user's own contacts. Blank clears the link.
  const { error } = await supabase
    .from('network_contacts')
    .update({ linkedin_url: url, updated_at: new Date().toISOString() })
    .eq('id', contactId)
  if (error) fail(`/network/${contactId}`, error.message)

  revalidatePath('/network')
  revalidatePath(`/network/${contactId}`)
}

// Writes the contact's follow-up draft, replacing the current one.
async function setFollowUpDraft(supabase: Awaited<ReturnType<typeof requireUser>>['supabase'], contactId: string, text: string) {
  await supabase.from('network_follow_ups').delete().eq('contact_id', contactId).eq('kind', 'follow_up')
  if (!text.trim()) return
  const { error } = await supabase.from('network_follow_ups').insert({ contact_id: contactId, kind: 'follow_up', draft_text: text })
  if (error) fail(`/network/${contactId}`, error.message)
}

// Hand edits to the follow-up draft. Free: no AI involved. The next logged
// interaction writes a fresh draft over it, as before.
export async function saveFollowUpDraft(formData: FormData) {
  const { supabase } = await requireUser()
  const contactId = String(formData.get('contact_id') ?? '')
  // RLS limits this to the user's own contacts: the ownership check.
  const { data: contact } = await supabase.from('network_contacts').select('id').eq('id', contactId).maybeSingle()
  if (!contact) redirect('/network')

  await setFollowUpDraft(supabase, contactId, String(formData.get('draft') ?? '').slice(0, MAX_DRAFT_LENGTH))
  revalidatePath(`/network/${contactId}`)
}

// Rewrites the draft (as currently typed) from the student's instruction.
// Costs an AI credit.
export async function rewriteFollowUpDraft(formData: FormData) {
  const { supabase, user } = await requireUser()
  const contactId = String(formData.get('contact_id') ?? '')
  const { data: contact } = await supabase
    .from('network_contacts')
    .select('id, full_name, role, company, met_context')
    .eq('id', contactId)
    .maybeSingle()
  if (!contact) redirect('/network')

  if (!(await spendCredit(supabase))) fail(`/network/${contactId}`, OUT_OF_CREDITS)
  const who = [contact.role, contact.company].filter(Boolean).join(' at ')
  const rewritten = await rewriteDraft({
    draft: String(formData.get('draft') ?? ''),
    instruction: String(formData.get('instruction') ?? ''),
    context: `A follow-up message from the student (${displayName(user)}) to ${contact.full_name}${who ? `, ${who}` : ''}${contact.met_context ? `, whom they met via ${contact.met_context}` : ''}.`,
  })
  if (!rewritten) fail(`/network/${contactId}`, "Couldn't rewrite it right now. Your draft wasn't changed.")

  await setFollowUpDraft(supabase, contactId, rewritten)
  revalidatePath(`/network/${contactId}`)
}
