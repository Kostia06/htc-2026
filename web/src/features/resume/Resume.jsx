// ResumeView.swift: Raven's suggestions one at a time, then the resume as a sheet of paper; tap a section to edit it.
// Every change saves in the background, one save after another.
import { useCallback, useEffect, useRef, useState } from 'react'
import { Outlet, useNavigate } from 'react-router'
import { FileText, PenLine, TriangleAlert } from 'lucide-react'
import { resumeApi } from '../../lib/client'
import { RaisedButton } from '../../ui/Button'
import { ContentUnavailable, SkeletonLines } from '../../ui/Feedback'
import { BarButton, Page, PageHeader } from '../../ui/Layout'
import { applySuggestion, labelFor, normalizeResume, textAt } from './resumeDoc'
import ResumePaper from './ResumePaper'
import './resume.css'

const ADD_NUMBER = '[add number]'

export default function Resume() {
  const navigate = useNavigate()
  const [state, setState] = useState({ phase: 'loading' })
  const [suggestions, setSuggestions] = useState([])
  const [note, setNote] = useState(null)
  const [improving, setImproving] = useState(false)
  const [saveFailed, setSaveFailed] = useState(false)
  const [direction, setDirection] = useState(null)
  const queue = useRef(Promise.resolve())
  const resumeRef = useRef(null)
  useEffect(() => {
    resumeRef.current = state.resume
  })

  const load = useCallback(
    () =>
      resumeApi.load().then(
        (r) => setState({ phase: 'ready', resume: normalizeResume(r.resume) }),
        (e) => setState((s) => (s.resume ? s : { phase: 'failed', message: e.message })),
      ),
    [],
  )
  useEffect(() => {
    load()
  }, [load])

  /** Shows the change at once and queues the save behind any still running. */
  const update = useCallback((next) => {
    setState((s) => ({ ...s, resume: next }))
    setSaveFailed(false)
    queue.current = queue.current
      .then(() => resumeApi.save(next))
      .catch(() => setSaveFailed(true))
  }, [])

  const improve = async () => {
    setImproving(true)
    setNote(null)
    try {
      const found = (await resumeApi.improve()).filter((s) => textAt(resumeRef.current, s.path) !== null)
      setSuggestions(found)
      setDirection(null)
      if (!found.length) setNote('Raven read it through and has nothing to tighten up right now.')
    } catch (e) {
      setNote(e.message)
    } finally {
      setImproving(false)
    }
  }

  const next = (accept) => {
    const [current, ...rest] = suggestions
    if (accept) {
      const applied = applySuggestion(resumeRef.current, current)
      if (applied) update(applied)
    }
    setDirection('out')
    setSuggestions(rest)
  }

  const resume = state.resume
  return (
    <Page className="resume-page">
      <PageHeader
        title="Resume"
        back={{ to: '/profile', label: 'Profile' }}
        actions={resume && <BarButton icon={FileText} label="View PDF" onClick={() => navigate('/profile/resume/pdf')} />}
      />
      {state.phase === 'loading' && (
        <div className="paper paper--skeleton">
          <SkeletonLines widths={[0.5, 0.3]} highlighted={-1} />
          <SkeletonLines widths={[0.9, 0.8, 0.6]} highlighted={-1} />
          <SkeletonLines widths={[0.7, 0.9, 0.85, 0.4]} highlighted={2} />
        </div>
      )}
      {state.phase === 'failed' && (
        <ContentUnavailable icon={FileText} title="Couldn't load your resume" description={state.message}>
          <RaisedButton onClick={load}>Try again</RaisedButton>
        </ContentUnavailable>
      )}
      {resume && (
        <div className="stack resume-page__stack">
          {suggestions.length > 0 && (
            <section className="stack deck">
              <div className="row deck__head">
                <h2 className="t-headline c-agent row deck__title">
                  <PenLine size={17} strokeWidth={2.4} aria-hidden /> Raven suggests
                </h2>
                <span className="t-subhead mono c-2">{suggestions.length} left</span>
              </div>
              <SuggestionCard key={suggestions[0].path} resume={resume} suggestion={suggestions[0]} entering={direction === 'out'} onSkip={() => next(false)} onAccept={() => next(true)} />
            </section>
          )}
          {!suggestions.length && note && <p className="t-footnote c-2">{note}</p>}

          <ResumePaper resume={resume} onEdit={(section) => navigate(`/profile/resume/edit/${section}`)} />

          {saveFailed && (
            <p className="t-footnote c-action row resume-page__warn">
              <TriangleAlert size={15} strokeWidth={2.4} aria-hidden /> Your last change didn&rsquo;t save. Reload or edit again.
            </p>
          )}
        </div>
      )}
      {resume && (
        <div className="resume-page__bottom">
          <RaisedButton variant="agent" onClick={improve} disabled={improving}>
            <PenLine size={19} strokeWidth={2.4} className={improving ? 'shimmering' : ''} aria-hidden />
            {improving ? 'Raven is reading your resume…' : 'Improve with Raven'}
          </RaisedButton>
        </div>
      )}
      <Outlet context={{ resume, update }} />
    </Page>
  )
}

/** SuggestionCard.swift: where it lands, the old line struck through, the rewrite, and why. */
function SuggestionCard({ resume, suggestion, entering, onSkip, onAccept }) {
  const parts = suggestion.after.split(ADD_NUMBER)
  return (
    <article className={`card suggestion${entering ? ' is-entering' : ''}`}>
      <p className="t-caption semibold c-2 suggestion__where">{labelFor(resume, suggestion.path)}</p>
      <p className="t-subhead c-2 suggestion__before">{suggestion.before || textAt(resume, suggestion.path)}</p>
      <p className="t-body medium">
        {parts.map((part, i) => (
          <span key={i}>
            {part}
            {i < parts.length - 1 && <span className="c-action">{ADD_NUMBER}</span>}
          </span>
        ))}
      </p>
      {suggestion.why && <p className="t-footnote c-agent">{suggestion.why}</p>}
      <div className="row suggestion__actions">
        <RaisedButton variant="grey" onClick={onSkip}>
          Skip
        </RaisedButton>
        <RaisedButton variant="agent" onClick={onAccept}>
          Accept
        </RaisedButton>
      </div>
    </article>
  )
}
