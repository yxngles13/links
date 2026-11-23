// lib/professors.ts
//
// Search and department filter for the Professors tab. There are only a
// couple dozen professors, so this runs in JS over every row. No `@/`
// imports so `npm test` can run this file directly under node.

export type ProfessorRow = {
  id: string
  professor_name: string
  department: string | null
  lab_name: string | null
  research_areas: string[] | null
  is_available: boolean | null
}

// "Dr. Yu Sun" sorts under Y, not D.
const sortKey = (name: string) => name.replace(/^dr\.?\s+/i, '').toLowerCase()

export function filterProfessors<T extends ProfessorRow>(rows: T[], opts: { q?: string; dept?: string }): T[] {
  const q = (opts.q ?? '').trim().toLowerCase()
  return rows
    .filter((r) => !opts.dept || r.department === opts.dept)
    .filter((r) => !q || [r.professor_name, r.lab_name, r.department, ...(r.research_areas ?? [])].some((f) => f?.toLowerCase().includes(q)))
    .sort((a, b) => sortKey(a.professor_name).localeCompare(sortKey(b.professor_name)))
}

export function departmentsOf(rows: ProfessorRow[]): string[] {
  return [...new Set(rows.map((r) => r.department).filter((d): d is string => !!d))].sort()
}

export type MatchContent = { explanation: string; suggested_questions: string[]; outreach_draft: string }

export const DRAFT_FAILED = "Couldn't write the draft just now. Try Rewrite, or come back in a minute."

// What a picked match stores: fresh AI text when there is some, otherwise
// whatever the match already had (so an edited draft survives a failed or
// skipped generation).
export function pickedContent(generated: MatchContent | null, existing: Partial<MatchContent> | null): { content: MatchContent; wrote: boolean } {
  if (generated && (generated.outreach_draft || generated.explanation)) return { content: generated, wrote: true }
  return {
    content: {
      explanation: existing?.explanation ?? '',
      suggested_questions: existing?.suggested_questions ?? [],
      outreach_draft: existing?.outreach_draft ?? '',
    },
    wrote: false,
  }
}

// Where "Write me a draft" lands: always the match page, with a reason
// shown when no draft was written (out of credits, or the AI failed).
export function draftRedirect(matchId: string, r: { spent: boolean; wrote: boolean }, outOfCredits: string): string {
  if (r.wrote) return `/matches/${matchId}`
  return `/matches/${matchId}?error=${encodeURIComponent(r.spent ? DRAFT_FAILED : outOfCredits)}`
}
