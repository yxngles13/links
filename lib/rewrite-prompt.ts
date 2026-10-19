// lib/rewrite-prompt.ts
//
// Pure pieces of "Rewrite with AI" for drafts: the prompt and cleanup of the
// model's reply. No `@/` imports so `npm test` can run this file directly.

export const MAX_DRAFT_LENGTH = 4000
export const MAX_INSTRUCTION_LENGTH = 300

export function buildRewritePrompt({
  draft,
  instruction,
  context,
}: {
  draft: string
  instruction: string
  context: string // who it's to and why, e.g. "Email to Dr. Chen (Vision Lab) about research"
}): string {
  const current = draft.trim().slice(0, MAX_DRAFT_LENGTH)
  const ask = instruction.trim().slice(0, MAX_INSTRUCTION_LENGTH)
  return `You are helping a college student write a short message.

WHAT THIS IS: ${context}

${current ? `CURRENT DRAFT:\n"""\n${current}\n"""` : 'There is no draft yet; write one from scratch.'}

THE STUDENT'S REQUEST: ${ask || 'Make it clearer and more natural.'}

Rewrite the message following the student's request. Keep every fact from the current draft unless asked to change it, and do not invent new facts, achievements or offers. Keep it genuine and not salesy.

Respond with ONLY the message text, no preamble, no quotes, no markdown.`
}

// Models sometimes wrap the answer in quotes or fences despite instructions.
export function cleanRewrite(raw: string): string {
  return raw
    .trim()
    .replace(/^```[a-z]*\s*|\s*```$/g, '')
    .replace(/^"""\s*|\s*"""$/g, '')
    .replace(/^"([\s\S]*)"$/, '$1')
    .trim()
    .slice(0, MAX_DRAFT_LENGTH)
}
