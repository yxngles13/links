'use client'
// components/AddContactDialog.tsx
// The "+ Add to network" quick-add popup. A native <dialog> gives focus
// trapping, Escape-to-close and a backdrop for free.
import { useRef } from 'react'
import { addContact } from '@/app/network/actions'
import SubmitButton from '@/components/SubmitButton'
import { MET_OPTIONS } from '@/lib/format'

export default function AddContactDialog({ openOnLoad = false }: { openOnLoad?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null)

  return (
    <>
      <button type="button" className="l-btn l-btn-primary" style={{ height: 44 }} onClick={() => ref.current?.showModal()}>
        + Add contact
      </button>

      <dialog
        ref={(el) => {
          ref.current = el
          if (el && openOnLoad && !el.open) el.showModal()
        }}
        className="l-dialog"
        aria-labelledby="add-contact-title"
      >
        <div className="l-dialog-head">
          <h2 id="add-contact-title" className="l-display" style={{ margin: 0, fontSize: 15 }}>+ Add to network</h2>
          <button type="button" className="l-icon-btn" aria-label="Close" onClick={() => ref.current?.close()}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form action={addContact} className="l-dialog-body">
          <div className="l-field">
            <label htmlFor="c-name" className="l-label">Name</label>
            <input id="c-name" name="full_name" required placeholder="Priya Nair" className="l-input l-input-sm" />
          </div>

          <div className="l-form-row" style={{ gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div className="l-field">
              <label htmlFor="c-role" className="l-label">Role</label>
              <input id="c-role" name="role" placeholder="Product Manager" className="l-input l-input-sm" />
            </div>
            <div className="l-field">
              <label htmlFor="c-company" className="l-label">Company</label>
              <input id="c-company" name="company" placeholder="Notion" className="l-input l-input-sm" />
            </div>
          </div>

          <fieldset className="l-field" style={{ border: 'none', padding: 0, margin: 0 }}>
            <legend className="l-label" style={{ marginBottom: 8 }}>How you met</legend>
            <div className="l-choices" style={{ gap: 6 }}>
              {MET_OPTIONS.map((m, i) => (
                <label key={m} className="l-choice l-choice-sm">
                  <input type="radio" name="met_context" value={m} defaultChecked={i === 0} />
                  <span>{m}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="l-field">
            <label htmlFor="c-tags" className="l-label">Tags</label>
            <input id="c-tags" name="tags" placeholder="Product, Alumni" className="l-input l-input-sm" />
            <p className="l-hint" style={{ fontSize: 12 }}>Separate tags with commas.</p>
          </div>

          <div className="l-field">
            <label htmlFor="c-linkedin" className="l-label">LinkedIn URL (optional)</label>
            <input id="c-linkedin" name="linkedin_url" type="url" placeholder="https://linkedin.com/in/…" className="l-input l-input-sm" />
          </div>

          <div className="l-field">
            <label htmlFor="c-notes" className="l-label">Notes</label>
            <textarea id="c-notes" name="notes" rows={3} placeholder="What did you talk about? Anything to remember?" className="l-textarea l-input-sm" style={{ resize: 'vertical' }} />
          </div>

          <SubmitButton pendingText="Saving and drafting a follow-up…">Save contact</SubmitButton>
        </form>
      </dialog>
    </>
  )
}
