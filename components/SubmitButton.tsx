'use client'
// components/SubmitButton.tsx
// Shows a pending state while the server action runs. Matching and
// summaries call Groq, so users need to know something is happening.
import { useFormStatus } from 'react-dom'

export default function SubmitButton({
  children,
  pendingText,
  className = 'btn btn-lg',
}: {
  children: React.ReactNode
  pendingText: string
  className?: string
}) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" className={className} disabled={pending}>
      {pending ? pendingText : children}
    </button>
  )
}
