// app/network/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireUser, displayName } from '@/lib/auth'
import { toArray } from '@/lib/format'
import { createContact, recordInteraction } from '@/lib/network'

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
