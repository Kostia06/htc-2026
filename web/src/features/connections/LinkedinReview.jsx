// LinkedinReviewView.swift: the person brings LinkedIn's own "Save to PDF" export; Skillit reads it once, keeps nothing,
// and lists edits that each quote the line they're about.
import { useRef, useState } from 'react'
import { FileUp, Lock } from 'lucide-react'
import { RESUME_MAX_BYTES, resumeApi } from '../../lib/client'
import { RaisedButton } from '../../ui/Button'
import './connections.css'

const AREAS = { headline: 'Headline', about: 'About', skills: 'Skills', experience: 'Experience' }

export default function LinkedinReview() {
  const input = useRef(null)
  const [state, setState] = useState({ phase: 'choosing' })

  const read = async (file) => {
    if (!file) return
    if (file.size > RESUME_MAX_BYTES) return setState({ phase: 'failed', message: 'That file is over 5 MB.' })
    setState({ phase: 'reading' })
    try {
      setState({ phase: 'done', review: await resumeApi.reviewLinkedin(file) })
    } catch (e) {
      setState({ phase: 'failed', message: e.message })
    }
  }

  return (
    <div className="stack li">
      <input ref={input} type="file" accept=".pdf,application/pdf" hidden onChange={(e) => read(e.target.files?.[0])} />
      {state.phase !== 'done' && (
        <>
          <p className="t-subhead">Get specific edits for your headline, About, skills and experience, aimed at the role you want.</p>
          <p className="t-footnote c-2">On LinkedIn, open your profile, choose More, then Save to PDF. Pick that file here.</p>
          <RaisedButton icon={FileUp} busy={state.phase === 'reading'} onClick={() => input.current?.click()}>
            {state.phase === 'reading' ? 'Reading your profile…' : 'Choose LinkedIn PDF'}
          </RaisedButton>
          {state.phase === 'failed' && <p className="t-footnote c-negative">{state.message}</p>}
          <p className="row t-caption c-2 gh__note">
            <Lock size={12} strokeWidth={2.4} aria-hidden /> Read once, kept nowhere. Emails, phone numbers and links are removed first.
          </p>
        </>
      )}
      {state.phase === 'done' && <Suggestions review={state.review} onAgain={() => input.current?.click()} />}
    </div>
  )
}

function Suggestions({ review, onAgain }) {
  return (
    <div className="stack li__list">
      {review.targetRole && <p className="t-footnote semibold c-agent">For {review.targetRole}</p>}
      {review.suggestions.length === 0 && <p className="t-subhead c-2">Nothing to change that Skillit could point to in your profile.</p>}
      {review.suggestions.map((s) => (
        <article key={`${s.area}-${s.quote}-${s.suggestion}`} className="stack li__card">
          <span className="t-caption semibold c-2">{AREAS[s.area] ?? s.area}</span>
          <q className="t-footnote c-2">{s.quote}</q>
          <span className="t-body">{s.suggestion}</span>
          <span className="t-footnote c-2">{s.why}</span>
        </article>
      ))}
      <button type="button" className="t-footnote c-2 li__again" onClick={onAgain}>
        Review another PDF
      </button>
    </div>
  )
}
