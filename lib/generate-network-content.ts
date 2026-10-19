// lib/generate-network-content.ts
//
// The networking tracker's counterpart to generate-match-content.ts: given
// one contact and everything the student has logged about them, write a
// running summary, questions for the next chat, and a follow-up draft.
// Called after every new interaction so the contact page stays current.

import Groq from 'groq-sdk'
import type { SupabaseClient } from '@supabase/supabase-js'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

type GeneratedNetworkContent = {
  summary: string
  questions: string[]
  follow_up_draft: string
}

// Dates in the prompt are Pacific calendar days (every user is at CPP).
// UTC would make an evening interaction read as "tomorrow".
function pacificDate(iso: string | Date) {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })
}

async function generate(prompt: string): Promise<GeneratedNetworkContent | null> {
  const completion = await groq.chat.completions.create({
    model: 'openai/gpt-oss-120b',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.6,
  })
  const raw = completion.choices[0]?.message?.content ?? ''
  try {
    const parsed = JSON.parse(raw.replace(/^```json\s*|\s*```$/g, '').trim())
    return {
      summary: parsed.summary ?? '',
      questions: Array.isArray(parsed.questions) ? parsed.questions : [],
      follow_up_draft: parsed.follow_up_draft ?? '',
    }
  } catch {
    console.error('Failed to parse generated network content:', raw)
    return null
  }
}

// Regenerates and stores the summary, questions and follow-up draft for one
// contact. Never throws: a failed generation leaves the previous content in
// place, because losing an interaction the student just logged over an LLM
// hiccup would be far worse than a stale summary.
export async function refreshContactContent(contactId: string, supabase: SupabaseClient, studentName?: string) {
  try {
    const { data: contact } = await supabase
      .from('network_contacts')
      .select('full_name, role, company, met_context, tags, notes')
      .eq('id', contactId)
      .single()
    if (!contact) return

    const { data: interactions } = await supabase
      .from('network_interactions')
      .select('interaction_type, notes, occurred_at')
      .eq('contact_id', contactId)
      .order('occurred_at', { ascending: true })

    const log = (interactions ?? [])
      .map((i) => `- ${pacificDate(i.occurred_at)} (${i.interaction_type ?? 'note'}): ${i.notes ?? ''}`)
      .join('\n')

    const prompt = `You are helping a college student keep track of a professional contact.

CONTACT:
- Name: ${contact.full_name}
- Role: ${contact.role ?? 'not specified'}
- Company / organization: ${contact.company ?? 'not specified'}
- How they met: ${contact.met_context ?? 'not specified'}
- Tags: ${contact.tags?.join(', ') || 'none'}
- Notes: ${contact.notes ?? 'none'}

INTERACTION LOG (oldest first; today is ${pacificDate(new Date())}):
${log || '- none logged yet'}

Write three things, grounded ONLY in the details above. Do not invent events, offers or facts that are not stated:
1. "summary": 2-3 sentences on who this person is to the student and where the relationship stands now.
2. "questions": three specific questions the student could ask in their next conversation, based on what has actually been discussed.
3. "follow_up_draft": a short, warm, natural follow-up message the student could send next${studentName ? `, signed "${studentName}"` : ''}. Not salesy.

Respond with ONLY a JSON object, no markdown fences, in exactly this shape:
{"summary": "...", "questions": ["...", "...", "..."], "follow_up_draft": "..."}`

    const content = await generate(prompt)
    if (!content) return

    await supabase
      .from('network_contact_summaries')
      .upsert({ contact_id: contactId, summary: content.summary, updated_at: new Date().toISOString() })

    // Replace, not append: only the latest questions and draft are useful.
    await supabase.from('network_follow_ups').delete().eq('contact_id', contactId)
    await supabase.from('network_follow_ups').insert([
      ...content.questions.map((q) => ({ contact_id: contactId, kind: 'question', draft_text: q })),
      ...(content.follow_up_draft
        ? [{ contact_id: contactId, kind: 'follow_up', draft_text: content.follow_up_draft }]
        : []),
    ])
  } catch (err) {
    console.error(`Could not refresh content for contact ${contactId}:`, err)
  }
}
