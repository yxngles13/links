// lib/network.ts
// Network-tracker writes shared by the Network pages, research matches
// ("Log this interaction") and mentor chats ("Log it").
import type { SupabaseClient } from '@supabase/supabase-js'
import { embed } from '@/lib/embeddings'
import { refreshContactContent } from '@/lib/generate-network-content'

type ContactFields = {
  full_name: string
  role?: string | null
  company?: string | null
  met_context?: string | null
  linkedin_url?: string | null
  tags?: string[]
  notes?: string | null
}

// What "Ask: who can help me break into ML infra?" searches against.
export function contactEmbeddingText(c: ContactFields) {
  return [
    c.full_name,
    [c.role, c.company].filter(Boolean).join(' at '),
    c.tags?.length ? `Tags: ${c.tags.join(', ')}` : '',
    c.notes ?? '',
  ]
    .filter(Boolean)
    .join('\n')
}

export async function createContact(supabase: SupabaseClient, userId: string, fields: ContactFields) {
  const { data, error } = await supabase
    .from('network_contacts')
    .insert({ user_id: userId, ...fields, contact_embedding: await embed(contactEmbeddingText(fields)) })
    .select('id')
    .single()
  if (error || !data) throw new Error(`Could not save contact: ${error?.message}`)
  return data.id as string
}

// Find the person in the user's network by exact name, or add them.
export async function findOrCreateContact(supabase: SupabaseClient, userId: string, fields: ContactFields) {
  const { data: existing } = await supabase
    .from('network_contacts')
    .select('id')
    .eq('user_id', userId)
    .eq('full_name', fields.full_name)
    .limit(1)
    .maybeSingle()
  if (existing) return existing.id as string
  return createContact(supabase, userId, fields)
}

// Adds a timeline entry, bumps "last contact", and regenerates the summary,
// questions and follow-up draft from the updated log. Pass refresh: false
// to skip the (slow) regeneration when the caller schedules it itself.
export async function recordInteraction(
  supabase: SupabaseClient,
  contactId: string,
  entry: { interaction_type: string | null; notes: string },
  studentName?: string,
  { refresh = true }: { refresh?: boolean } = {}
) {
  const now = new Date().toISOString()
  const { error } = await supabase
    .from('network_interactions')
    .insert({ contact_id: contactId, ...entry, occurred_at: now })
  if (error) throw new Error(`Could not log interaction: ${error.message}`)

  await supabase.from('network_contacts').update({ last_interaction_at: now, updated_at: now }).eq('id', contactId)
  if (refresh) await refreshContactContent(contactId, supabase, studentName)
}
