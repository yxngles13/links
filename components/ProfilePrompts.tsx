// components/ProfilePrompts.tsx
// The personality answers, read-only. Answers to prompts that were later
// removed from PROFILE_PROMPTS are skipped.
import { pastelFor } from '@/lib/theme'
import { promptText, type PromptAnswer } from '@/lib/profile'

export default function ProfilePrompts({ prompts }: { prompts: PromptAnswer[] }) {
  const shown = prompts.filter((p) => promptText(p.key))
  if (!shown.length) return null
  return (
    <div className="prompt-grid">
      {shown.map((p) => (
        <div key={p.key} className={`card prompt-card card-${pastelFor(p.key)}`}>
          <div className="label">{promptText(p.key)}</div>
          <div className="prompt-answer">{p.answer}</div>
        </div>
      ))}
    </div>
  )
}
