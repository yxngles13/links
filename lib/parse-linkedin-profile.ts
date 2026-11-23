// lib/parse-linkedin-profile.ts
//
// The extension's AI prefill: the visible text of a LinkedIn profile the
// student clicked on goes to Groq, which picks out the contact's details.
// The text is never stored or logged; only the parsed fields come back.

import Groq from 'groq-sdk'
import { parseModelOutput, type ParsedProfile } from '@/lib/linkedin-parse'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

function buildPrompt(text: string) {
  return `Below is the visible text of one LinkedIn profile page. Pick out details about the person whose profile it is.

Rules:
- Use ONLY what the text says. Never guess or invent. Leave a field as "" (or [] for lists) when it isn't clearly stated.
- The person is the profile owner. Ignore other people on the page: "People also viewed", recommendations, comments, ads, messaging, and LinkedIn's own navigation.
- role and company: their current position. school, major and grad_year: their most recent school (grad_year as "YYYY").
- past_roles: up to 3 earlier positions, each as "Title, Company".
- about_summary: one short sentence summarizing their About section, or "" if there isn't one.
- tags: up to 3 short topics (1-2 words each) that describe their field or background, e.g. "ML", "Product", "CPP alum".

Respond with ONLY a JSON object, no markdown fences, no other text, in exactly this shape:
{"full_name": "", "role": "", "company": "", "location": "", "school": "", "major": "", "grad_year": "", "past_roles": [], "about_summary": "", "tags": []}

Profile text:
<<<
${text}
>>>`
}

export async function parseLinkedInProfile(text: string): Promise<ParsedProfile | null> {
  try {
    const completion = await groq.chat.completions.create({
      model: 'openai/gpt-oss-120b',
      messages: [{ role: 'user', content: buildPrompt(text) }],
      temperature: 0.2,
    })
    return parseModelOutput(completion.choices[0]?.message?.content ?? '')
  } catch (err) {
    // The error only: the profile text never goes in the logs.
    console.error('LinkedIn profile parse failed:', (err as Error).message)
    return null
  }
}
