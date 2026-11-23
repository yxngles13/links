'use client'
// components/ExtensionCard.tsx
// Home's "Add to Chrome" feature card. Chrome no longer lets a site install
// an extension itself, so the button opens the Web Store listing in a new
// tab. Clicking it or "Not now" hides the card for good in this browser.
// Renders nothing until mounted, so a dismissed card never flashes in.
import { useEffect, useState } from 'react'

const DISMISSED_KEY = 'links-extension-card-dismissed'

export default function ExtensionCard({ storeUrl }: { storeUrl: string }) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    try {
      // Reading browser storage after mount is the point: the server can't know.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShow(!localStorage.getItem(DISMISSED_KEY))
    } catch {
      setShow(true)
    }
  }, [])

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISSED_KEY, String(Date.now()))
    } catch {}
    setShow(false)
  }

  if (!show) return null

  return (
    <section
      aria-labelledby="extension-title"
      className="card card-peach row-split"
      style={{ flexWrap: 'wrap', alignItems: 'center', gap: '16px 32px', marginBottom: 28 }}
    >
      <div style={{ minWidth: 0, flex: '1 1 320px' }}>
        <div className="eyebrow" style={{ color: 'var(--peach-ink)', marginBottom: 6 }}>New · Chrome extension</div>
        <h2 id="extension-title" className="name" style={{ margin: '0 0 4px' }}>Add people straight from LinkedIn</h2>
        <p className="body-copy" style={{ fontSize: 14, margin: 0, color: 'var(--ink)' }}>
          Click the Links icon on someone&apos;s profile and they&apos;re in your network, with a follow-up reminder. No copying and pasting.
        </p>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <a href={storeUrl} target="_blank" rel="noreferrer" className="btn btn-accent" onClick={dismiss}>Add to Chrome</a>
        <button type="button" className="link-quiet" onClick={dismiss}>Not now</button>
      </div>
    </section>
  )
}
