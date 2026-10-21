'use client'
// components/DeletePlanDialog.tsx
// "Delete plan" button that opens a confirm dialog. The form only sends
// confirm=delete once the student presses the red button.
import { useRef } from 'react'
import { deletePlan } from '@/app/plans/actions'

export default function DeletePlanDialog({ planId, title }: { planId: string; title: string }) {
  const ref = useRef<HTMLDialogElement>(null)
  return (
    <>
      <button type="button" className="link-quiet" onClick={() => ref.current?.showModal()}>Delete plan</button>
      <dialog ref={ref} className="dialog" aria-labelledby="delete-plan-title">
        <form action={deletePlan}>
          <input type="hidden" name="plan_id" value={planId} />
          <input type="hidden" name="confirm" value="delete" />
          <h2 id="delete-plan-title" className="serif" style={{ margin: '0 0 12px', fontSize: 30, lineHeight: 1.1 }}>
            Delete this plan?
          </h2>
          <p className="body-copy" style={{ marginBottom: 24 }}>
            &ldquo;{title}&rdquo; and all of its steps will be removed. This can&apos;t be undone.
          </p>
          <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
            <button type="submit" className="btn btn-danger">Delete plan</button>
            <button type="button" className="link-quiet" onClick={() => ref.current?.close()}>Cancel</button>
          </div>
        </form>
      </dialog>
    </>
  )
}
