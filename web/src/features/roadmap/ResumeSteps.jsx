// ResumeStepsCard.swift: the resume's finished steps folded into one card, so the path starts where the person is now.
import { useState } from 'react'
import { Check, ChevronDown, FileText } from 'lucide-react'

export function ResumeStepsCard({ steps, onOpen }) {
  const [open, setOpen] = useState(false)
  return (
    <section className="card stack resume-steps">
      <button type="button" className="row resume-steps__head" aria-expanded={open} onClick={() => setOpen(!open)}>
        <FileText size={20} strokeWidth={2.4} className="c-positive" aria-hidden />
        <span className="stack resume-steps__title">
          <span className="t-headline">From your resume</span>
          <span className="t-subhead c-2">{steps.length} already done</span>
        </span>
        <ChevronDown size={18} className={`c-2 resume-steps__chevron${open ? ' is-open' : ''}`} aria-hidden />
      </button>
      {open &&
        steps.map((step) => (
          <button type="button" key={step.id} className="row resume-steps__step t-subhead" onClick={() => onOpen(step)}>
            <Check size={14} strokeWidth={3.2} className="c-positive" aria-hidden />
            <span>{step.title}</span>
          </button>
        ))}
    </section>
  )
}
