// lib/generate-match-content.ts
//
// Fills in the three fields the matching pipeline leaves null:
// explanation, suggested_questions, outreach_draft. This is a genuinely
// different problem than the embedding step — embeddings just needed
// *a* vector, but this needs actual, specific, well-written text grounded
// in the real overlap between a student and a professor. That's why it
// uses a real generative LLM (via Groq's free tier) instead of the small
// local model used for embeddings.
//
// Requires GROQ_API_KEY in .env.local — get one free, no credit card, at
// https://console.groq.com (API Keys > Create API Key).

import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

type StudentProfileForPrompt = {
  major: string | null
  academic_year: string | null
  research_interests: string[] | null
  technical_skills: string[] | null
  career_goals: string | null
}

type OpportunityForPrompt = {
  professor_name: string
  department: string | null
  lab_name: string | null
  project_description: string | null
}

type GeneratedMatchContent = {
  explanation: string
  suggested_questions: string[]
  outreach_draft: string
}

function buildPrompt(student: StudentProfileForPrompt, opp: OpportunityForPrompt): string {
  return `You are helping a college student prepare to reach out to a professor about research opportunities.

STUDENT PROFILE:
- Major: ${student.major ?? 'not specified'}
- Year: ${student.academic_year ?? 'not specified'}
- Research interests: ${student.research_interests?.join(', ') || 'not specified'}
- Technical skills: ${student.technical_skills?.join(', ') || 'not specified'}
- Career goals: ${student.career_goals ?? 'not specified'}

PROFESSOR / OPPORTUNITY:
- Name: ${opp.professor_name}
- Department: ${opp.department ?? 'not specified'}
- Lab: ${opp.lab_name ?? 'not specified'}
- Project description: ${opp.project_description ?? 'not specified'}

Generate three things, grounded ONLY in the specific details above — do not invent facts not stated:
1. A 2-3 sentence explanation of why this professor's work overlaps with this student's stated interests/skills. Be specific, not generic.
2. Three thoughtful questions the student could ask this professor, based on the actual project description — not generic interview questions.
3. A short, genuine-sounding outreach email draft (not corporate or salesy) the student could send, referencing specific overlap.

Respond with ONLY a JSON object, no markdown fences, no other text, in exactly this shape:
{"explanation": "...", "suggested_questions": ["...", "...", "..."], "outreach_draft": "..."}`
}

export async function generateMatchContent(
  student: StudentProfileForPrompt,
  opportunity: OpportunityForPrompt
): Promise<GeneratedMatchContent> {
  const completion = await groq.chat.completions.create({
    model: 'openai/gpt-oss-120b',
    messages: [{ role: 'user', content: buildPrompt(student, opportunity) }],
    temperature: 0.6,
  })

  const raw = completion.choices[0]?.message?.content ?? ''

  try {
    // Models sometimes wrap JSON in ```json fences despite instructions —
    // strip those before parsing rather than letting a good response fail
    // just because of formatting.
    const cleaned = raw.replace(/^```json\s*|\s*```$/g, '').trim()
    const parsed = JSON.parse(cleaned)
    return {
      explanation: parsed.explanation ?? '',
      suggested_questions: Array.isArray(parsed.suggested_questions) ? parsed.suggested_questions : [],
      outreach_draft: parsed.outreach_draft ?? '',
    }
  } catch {
    // If parsing fails, don't crash the whole matching pipeline over one
    // bad generation — fall back to empty content for this match, and log
    // enough to debug later. A missing explanation is recoverable; a
    // crashed onboarding flow is not.
    console.error(`Failed to parse generated content for ${opportunity.professor_name}:`, raw)
    return { explanation: '', suggested_questions: [], outreach_draft: '' }
  }
}