'use client'
// components/DraftEditor.tsx
// An AI-written message the student can edit (free) or have rewritten from
// their own instructions (1 AI credit). Both buttons submit the same form,
// so a rewrite starts from whatever the student has typed so far.
import { useRef, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { MAX_DRAFT_LENGTH, MAX_INSTRUCTION_LENGTH } from '@/lib/rewrite-prompt'

type Action = (formData: FormData) => void | Promise<void>

function Buttons({ save, rewrite, dirty }: { save: Action; rewrite: Action; dirty: boolean }) {
  const { pending } = useFormStatus()
  const rewriteButton = useRef<HTMLButtonElement>(null)
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end' }}>
      <button type="submit" formAction={save} className="btn btn-sm btn-outline" disabled={pending || !dirty}>
        Save edits
      </button>
      <div className="field" style={{ flex: 1, minWidth: 'min(100%, 240px)' }}>
        <label htmlFor="draft-instruction">Rewrite with AI</label>
        <input
          id="draft-instruction"
          name="instruction"
          maxLength={MAX_INSTRUCTION_LENGTH}
          placeholder="e.g. shorter, and mention my Python project"
          className="input"
          style={{ fontSize: 15 }}
          // Enter here means "rewrite", not the form's first button (save).
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              rewriteButton.current?.click()
            }
          }}
        />
      </div>
      <button ref={rewriteButton} type="submit" formAction={rewrite} className="btn btn-sm" disabled={pending}>
        {pending ? 'Working…' : 'Rewrite · 1 credit'}
      </button>
    </div>
  )
}

export default function DraftEditor({
  label,
  text,
  idName,
  idValue,
  save,
  rewrite,
}: {
  label: string
  text: string
  idName: string // hidden field the actions read, e.g. "match_id"
  idValue: string
  save: Action
  rewrite: Action
}) {
  const [value, setValue] = useState(text)
  const [copied, setCopied] = useState(false)
  // A new draft from the server (after a save or rewrite) replaces local edits.
  const [base, setBase] = useState(text)
  if (text !== base) {
    setBase(text)
    setValue(text)
  }

  return (
    <form className="form" style={{ gap: 14 }}>
      <input type="hidden" name={idName} value={idValue} />
      <div className="row-split" style={{ alignItems: 'baseline' }}>
        <label htmlFor={`draft-${idValue}`} className="label">{label}</label>
        <button
          type="button"
          className="link"
          style={{ fontSize: 13 }}
          disabled={!value.trim()}
          onClick={async () => {
            await navigator.clipboard.writeText(value)
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
          }}
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <textarea
        id={`draft-${idValue}`}
        name="draft"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        maxLength={MAX_DRAFT_LENGTH}
        rows={Math.min(16, Math.max(6, value.split('\n').length + 1))}
        placeholder="Write your own message, or have AI draft one below."
        className="draft"
        style={{ width: '100%', resize: 'vertical', font: 'inherit', fontSize: 14.5, outline: 'none' }}
      />
      <Buttons save={save} rewrite={rewrite} dirty={value !== text} />
    </form>
  )
}
