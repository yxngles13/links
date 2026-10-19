// lib/rewrite-draft.ts
// "Rewrite with AI" for outreach and follow-up drafts. The caller spends
// the AI credit first (lib/credits.ts).
import Groq from 'groq-sdk'
import { buildRewritePrompt, cleanRewrite } from '@/lib/rewrite-prompt'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

// null = the model failed or returned nothing; the caller keeps the old draft.
export async function rewriteDraft(input: Parameters<typeof buildRewritePrompt>[0]): Promise<string | null> {
  try {
    const completion = await groq.chat.completions.create({
      model: 'openai/gpt-oss-120b',
      messages: [{ role: 'user', content: buildRewritePrompt(input) }],
      temperature: 0.6,
    })
    return cleanRewrite(completion.choices[0]?.message?.content ?? '') || null
  } catch (err) {
    console.error('Draft rewrite failed:', err)
    return null
  }
}
