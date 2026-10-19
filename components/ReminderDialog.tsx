'use client'
// components/ReminderDialog.tsx
// The one-time "finish setting up" pop-up. Either button records that it was
// seen, so from then on ProfileReminder shows the banner instead.
import { useRef } from 'react'
import { dismissReminder } from '@/app/profile/actions'

export default function ReminderDialog() {
  const later = useRef<HTMLButtonElement>(null)
  return (
    <dialog
      ref={(el) => {
        if (el && !el.open) el.showModal()
      }}
      className="dialog"
      aria-labelledby="reminder-title"
      // Escape counts as "Later", otherwise the pop-up would come back.
      onCancel={(e) => {
        e.preventDefault()
        later.current?.click()
      }}
    >
      <form action={dismissReminder}>
        <div className="eyebrow" style={{ marginBottom: 14 }}>Welcome to Links</div>
        <h2 id="reminder-title" className="serif" style={{ margin: '0 0 12px', fontSize: 34, lineHeight: 1.05 }}>
          Tell us what you want to <em className="accent">work on</em>.
        </h2>
        <p className="body-copy" style={{ marginBottom: 24 }}>
          Two minutes, and we can start matching you with professors.
        </p>
        <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
          <button type="submit" name="go" value="answer" className="btn">Answer questions</button>
          <button ref={later} type="submit" name="go" value="later" className="link-quiet">Later</button>
        </div>
      </form>
    </dialog>
  )
}
