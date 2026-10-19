// components/ProfilePrompts.tsx
// The personality answers, read-only. Answers to prompts that were later
// removed from PROFILE_PROMPTS are skipped.
import { promptText, type PromptAnswer } from '@/lib/profile'

export default function ProfilePrompts({ prompts }: { prompts: PromptAnswer[] }) {
  const shown = prompts.filter((p) => promptText(p.key))
  if (!shown.length) return null
  return (
    <div className="rows">
      {shown.map((p) => (
        <div key={p.key} className="row">
          <div className="label" style={{ marginBottom: 8 }}>{promptText(p.key)}</div>
          <div className="serif" style={{ fontSize: 24, lineHeight: 1.25 }}>{p.answer}</div>
        </div>
      ))}
    </div>
  )
}
