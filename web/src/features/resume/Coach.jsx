// The resume coach: pick a part of the resume (and, if you like, a company you're applying to), then go through
// Skillit's rewrites one at a time. It works on the resume as it is on screen, saved or not.
import { useEffect, useState } from 'react'
import { PenLine } from 'lucide-react'
import { companiesApi, resumeApi } from '../../lib/client'
import { RaisedButton } from '../../ui/Button'
import { Segmented } from '../../ui/Controls'
import { applySuggestion, labelFor, textAt } from './resumeDoc'

const ADD_NUMBER = '[add number]'
const SCOPES = [
  { id: '', title: 'All' },
  { id: 'summary', title: 'Summary' },
  { id: 'experience', title: 'Experience' },
  { id: 'projects', title: 'Projects' },
]

/** The lines the coach rewrites: the summary and the bullets under experience and projects. */
function hasLines(resume, scope) {
  const want = (s) => !scope || scope === s
  const bullets = (s) => resume[s].some((e) => e.bullets.some((b) => b.trim()))
  return (want('summary') && resume.summary.trim()) || (want('experience') && bullets('experience')) || (want('projects') && bullets('projects'))
}

export default function Coach({ resume, onApply }) {
  const [scope, setScope] = useState('')
  const [company, setCompany] = useState('')
  const [companies, setCompanies] = useState([])
  const [suggestions, setSuggestions] = useState([])
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState(null)

  // only companies Skillit has researched can be targeted; without any the picker stays hidden
  useEffect(() => {
    let alive = true
    companiesApi.list().then(
      (list) => alive && setCompanies(list ?? []),
      () => {},
    )
    return () => {
      alive = false
    }
  }, [])

  const improve = async () => {
    setNote(null)
    if (!hasLines(resume, scope)) {
      setNote('Add a summary or a few points under experience or projects first. Those are the lines Skillit rewrites.')
      return
    }
    setBusy(true)
    try {
      const found = (await resumeApi.improve({ resume, section: scope, company }))
        .filter((s) => textAt(resume, s.path) !== null)
        // keep the line as it was when it was read, so a later edit marks the suggestion as out of date
        .map((s) => ({ ...s, before: s.before ?? textAt(resume, s.path) }))
      setSuggestions(found)
      if (!found.length) setNote("Skillit read it through and has nothing to tighten up right now. Add more detail, or try another part.")
    } catch (e) {
      setNote(e.message)
    } finally {
      setBusy(false)
    }
  }

  const next = (accept) => {
    const [current, ...rest] = suggestions
    if (accept) {
      const applied = applySuggestion(resume, current)
      if (applied) onApply(applied)
    }
    setSuggestions(rest)
  }

  return (
    <section className="card stack coach" aria-label="Improve with Skillit">
      <div className="stack coach__intro">
        <h2 className="t-headline row coach__title">
          <PenLine size={17} strokeWidth={2.4} aria-hidden /> Improve with Skillit
        </h2>
        <p className="t-footnote c-2">Skillit only rewrites what your resume already says. It never adds numbers or experience you didn&rsquo;t give it.</p>
      </div>

      <Segmented label="Part to improve" options={SCOPES} value={scope} onChange={setScope} />

      {companies.length > 0 && (
        <label className="row coach__company">
          <span className="t-subhead c-2 grow">Applying to</span>
          <select className="t-subhead" value={company} onChange={(e) => setCompany(e.target.value)} aria-label="Company you're applying to">
            <option value="">Any company</option>
            {companies.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <RaisedButton variant="agent" onClick={improve} disabled={busy}>
        <PenLine size={19} strokeWidth={2.4} className={busy ? 'shimmering' : ''} aria-hidden />
        {busy ? 'Skillit is reading your resume…' : suggestions.length ? 'Look again' : 'Suggest rewrites'}
      </RaisedButton>

      {note && !suggestions.length && <p className="t-footnote c-2">{note}</p>}

      {suggestions.length > 0 && (
        <div className="stack deck" aria-live="polite">
          <div className="row deck__head">
            <span className="t-subhead semibold c-agent">Skillit suggests</span>
            <span className="t-footnote mono c-2">{suggestions.length} left</span>
          </div>
          <SuggestionCard key={suggestions[0].path} resume={resume} suggestion={suggestions[0]} onSkip={() => next(false)} onAccept={() => next(true)} />
        </div>
      )}
    </section>
  )
}

/** SuggestionCard.swift: where it lands, the old line struck through, the rewrite, and why. */
function SuggestionCard({ resume, suggestion, onSkip, onAccept }) {
  const now = textAt(resume, suggestion.path)
  const stale = now === null || now.trim() !== suggestion.before.trim()
  const parts = suggestion.after.split(ADD_NUMBER)
  return (
    <article className="suggestion">
      <p className="t-caption semibold c-2 suggestion__where">{labelFor(resume, suggestion.path)}</p>
      <p className="t-subhead c-2 suggestion__before">{suggestion.before}</p>
      <p className="t-body medium">
        {parts.map((part, i) => (
          <span key={i}>
            {part}
            {i < parts.length - 1 && <span className="c-action">{ADD_NUMBER}</span>}
          </span>
        ))}
      </p>
      {suggestion.why && <p className="t-footnote c-agent">{suggestion.why}</p>}
      {stale && <p className="t-footnote c-2">You changed this line since Skillit read it, so this one can only be skipped.</p>}
      <div className="row suggestion__actions">
        <RaisedButton variant="grey" onClick={onSkip}>
          Skip
        </RaisedButton>
        <RaisedButton variant="agent" onClick={onAccept} disabled={stale}>
          Use this
        </RaisedButton>
      </div>
    </article>
  )
}
