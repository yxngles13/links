'use client'
// components/SubmitButton.tsx
// Shows a pending state while the server action runs. Matching takes a while
// (one Groq call per match), so users need to know something is happening.
import { useFormStatus } from 'react-dom'

export default function SubmitButton({ children, pendingText }: { children: React.ReactNode; pendingText: string }) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" className="l-btn l-btn-primary" disabled={pending} style={{ height: 52, fontSize: 15, opacity: pending ? 0.75 : 1 }}>
      {pending ? pendingText : children}
    </button>
  )
}