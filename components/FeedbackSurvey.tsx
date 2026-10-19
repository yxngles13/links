'use client'
// components/FeedbackSurvey.tsx
// The "Feedback" link in the nav, plus the same survey when someone looks
// like they're leaving (mouse heads for the tab bar). Browsers don't allow a
// custom pop-up on tab close, so exit-intent is the closest we can get; it's
// desktop-only, at most once a week, and never in someone's first 30 seconds.
import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { submitFeedback } from '@/app/feedback/actions'
import SubmitButton from '@/components/SubmitButton'
import { FEEDBACK_FEATURES, FEEDBACK_REASONS, MAX_FEEDBACK_COMMENT, shouldPromptOnExit } from '@/lib/feedback'

const SHOWN_KEY = 'links-feedback-shown-at'
const ARRIVED_KEY = 'links-session-started-at'

// Per-browser memory of the last exit prompt; storage can be blocked.
function lastShown(): number | null {
  try {
    const v = Number(localStorage.getItem(SHOWN_KEY))
    return Number.isFinite(v) && v > 0 ? v : null
  } catch {
    return null
  }
}
function markShown() {
  try {
    localStorage.setItem(SHOWN_KEY, String(Date.now()))
  } catch {}
}
// When this visit started. The nav (and this component) remounts on every
// page, so "30 seconds on the site" has to outlive a single page.
function sessionStart(): number {
  try {
    const v = Number(sessionStorage.getItem(ARRIVED_KEY))
    if (Number.isFinite(v) && v > 0) return v
    sessionStorage.setItem(ARRIVED_KEY, String(Date.now()))
  } catch {}
  return Date.now()
}

export default function FeedbackSurvey() {
  const ref = useRef<HTMLDialogElement>(null)
  const pathname = usePathname()
  const [trigger, setTrigger] = useState<'exit' | 'button'>('button')
  const [done, setDone] = useState(false)

  const open = (how: 'exit' | 'button') => {
    setTrigger(how)
    setDone(false)
    ref.current?.showModal()
  }

  useEffect(() => {
    const arrived = sessionStart()
    // ?feedback=exit opens the exit version right away, for trying it out.
    const testOpen = new URLSearchParams(location.search).get('feedback') === 'exit' ? setTimeout(() => open('exit')) : undefined

    const onOut = (e: MouseEvent) => {
      // Pointer left the window (no element under it) near the top edge.
      // Fast moves report a last position a few pixels in, hence the margin.
      if (e.relatedTarget || e.clientY > 20 || ref.current?.open) return
      if (!shouldPromptOnExit(lastShown(), Date.now() - arrived, Date.now())) return
      markShown()
      open('exit')
    }
    document.addEventListener('mouseout', onOut)
    return () => {
      clearTimeout(testOpen)
      document.removeEventListener('mouseout', onOut)
    }
  }, [])

  return (
    <>
      <button type="button" className="link-quiet" onClick={() => open('button')}>
        Feedback
      </button>

      <dialog ref={ref} className="dialog" aria-labelledby="feedback-title">
        {done ? (
          <div>
            <h2 id="feedback-title" className="serif" style={{ margin: '0 0 12px', fontSize: 34 }}>Thank you.</h2>
            <p className="body-copy" style={{ marginBottom: 24 }}>Every answer gets read. It&apos;s how Links gets better.</p>
            <button type="button" className="btn" onClick={() => ref.current?.close()}>Close</button>
          </div>
        ) : (
          <form
            action={async (fd) => {
              await submitFeedback(fd)
              setDone(true)
            }}
            className="form"
            style={{ gap: 20 }}
          >
            <input type="hidden" name="page" value={pathname} />
            <input type="hidden" name="trigger" value={trigger} />
            <div className="row-split" style={{ alignItems: 'baseline' }}>
              <h2 id="feedback-title" className="serif" style={{ margin: 0, fontSize: 32, lineHeight: 1.05 }}>
                {trigger === 'exit' ? 'Before you go…' : 'How’s it going?'}
              </h2>
              <button type="button" className="link-quiet" style={{ fontSize: 13 }} onClick={() => ref.current?.close()}>
                Close
              </button>
            </div>

            <fieldset className="field">
              <legend>How was Links today?</legend>
              <div className="choices choices-sm">
                {[1, 2, 3, 4, 5].map((n) => (
                  <label key={n} className="choice">
                    <input type="radio" name="rating" value={n} />
                    <span style={{ minWidth: 40, justifyContent: 'center' }}>{n}</span>
                  </label>
                ))}
              </div>
              <p className="hint">1 = not useful, 5 = loved it</p>
            </fieldset>

            <fieldset className="field">
              <legend>What did you use?</legend>
              <div className="choices choices-sm">
                {FEEDBACK_FEATURES.map((f) => (
                  <label key={f} className="choice">
                    <input type="checkbox" name="features" value={f} />
                    <span>{f}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            {trigger === 'exit' ? (
              <fieldset className="field">
                <legend>Why are you heading out?</legend>
                <div className="choices choices-sm">
                  {FEEDBACK_REASONS.map((r) => (
                    <label key={r} className="choice">
                      <input type="radio" name="reason" value={r} />
                      <span>{r}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ) : null}

            <div className="field">
              <label htmlFor="feedback-comment">Anything else? (optional)</label>
              <textarea id="feedback-comment" name="comment" rows={2} maxLength={MAX_FEEDBACK_COMMENT} placeholder="What would make Links more useful?" className="input" style={{ fontSize: 15 }} />
            </div>

            <div>
              <SubmitButton className="btn" pendingText="Sending…">Send feedback</SubmitButton>
            </div>
          </form>
        )}
      </dialog>
    </>
  )
}
