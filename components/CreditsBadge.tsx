// components/CreditsBadge.tsx
// "3 of 5 AI credits left" in the student nav. Renders nothing until the
// credits migration has run.
import { requireUser } from '@/lib/auth'
import { creditsLeft, DAILY_CREDITS } from '@/lib/credits'

export default async function CreditsBadge() {
  const { supabase } = await requireUser()
  const left = await creditsLeft(supabase)
  if (left === null) return null
  return (
    <span
      className="num"
      title="Each AI action (refreshing matches, drafting a follow-up, …) uses one. They reset at midnight."
      style={{ color: left === 0 ? 'var(--danger)' : undefined, whiteSpace: 'nowrap' }}
    >
      {left === 0 ? 'No AI credits left today' : `${left} of ${DAILY_CREDITS} AI credits left`}
    </span>
  )
}
