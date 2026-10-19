'use client'
// components/AddContactDialog.tsx
// The "Add to network" quick-add. A native <dialog> gives focus trapping,
// Escape-to-close and a backdrop for free.
import { useRef } from 'react'
import { addContact } from '@/app/network/actions'
import SubmitButton from '@/components/SubmitButton'
import { MET_OPTIONS } from '@/lib/format'

export default function AddContactDialog({ openOnLoad = false }: { openOnLoad?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null)

  return (
    <>
      <button type="button" className="btn" onClick={() => ref.current?.showModal()}>
        Add contact
      </button>

      <dialog
        ref={(el) => {
          ref.current = el
          if (el && openOnLoad && !el.open) el.showModal()
        }}
        className="dialog"
        aria-labelledby="add-contact-title"
      >
        <div className="row-split" style={{ alignItems: 'baseline', marginBottom: 24 }}>
          <h2 id="add-contact-title" className="serif" style={{ margin: 0, fontSize: 34 }}>Add to network</h2>
          <button type="button" className="link-quiet" style={{ fontSize: 13 }} onClick={() => ref.current?.close()}>
            Close
          </button>
        </div>

        <form action={addContact} className="form" style={{ gap: 18 }}>
          <div className="form-row" style={{ gap: 18 }}>
            <div className="field">
              <label htmlFor="c-name">Name</label>
              <input id="c-name" name="full_name" required placeholder="Priya Nair" className="input" />
            </div>
            <div className="field">
              <label htmlFor="c-role">Role</label>
              <input id="c-role" name="role" placeholder="Product Manager" className="input" />
            </div>
          </div>
          <div className="field">
            <label htmlFor="c-company">Company</label>
            <input id="c-company" name="company" placeholder="Notion" className="input" />
          </div>

          <fieldset className="field">
            <legend>How you met</legend>
            <div className="choices choices-sm">
              {MET_OPTIONS.map((m, i) => (
                <label key={m} className="choice">
                  <input type="radio" name="met_context" value={m} defaultChecked={i === 0} />
                  <span>{m}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="field">
            <label htmlFor="c-tags">Tags</label>
            <input id="c-tags" name="tags" placeholder="Product, Alumni" className="input" />
          </div>
          <div className="field">
            <label htmlFor="c-linkedin">LinkedIn URL (optional)</label>
            <input id="c-linkedin" name="linkedin_url" type="url" placeholder="https://linkedin.com/in/…" className="input" />
          </div>
          <div className="field">
            <label htmlFor="c-notes">Notes</label>
            <textarea id="c-notes" name="notes" rows={2} placeholder="What did you talk about?" className="input" />
          </div>

          <div style={{ marginTop: 6 }}>
            <SubmitButton className="btn" pendingText="Saving and drafting a follow-up…">Save contact</SubmitButton>
          </div>
        </form>
      </dialog>
    </>
  )
}
