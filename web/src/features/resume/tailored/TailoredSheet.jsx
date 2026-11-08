// TailoredResumeView.swift at /resume/tailored/:id: how a resume was tailored for one job. The match comes first,
// then each change as before → after with why and the requirement it serves, each one revertable.
import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useOutletContext, useParams } from 'react-router'
import { ArrowDown, CircleCheck, Circle, FileText, Trash2, TriangleAlert } from 'lucide-react'
import { capitalized } from '../../../lib/format'
import { tailoredApi } from '../../../lib/client'
import { Spinner, TextButton } from '../../../ui/Button'
import { Segmented } from '../../../ui/Controls'
import { ContentUnavailable, SkeletonLines } from '../../../ui/Feedback'
import { Confirm, Sheet } from '../../../ui/Sheet'
import ExportButtons from '../ExportButtons'
import { TEMPLATES, useTemplate } from '../template'
import { kindLabel } from './match'

export function TailoredSheet() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { state: handedOver } = useLocation()
  const { tailored: list } = useOutletContext()
  const [doc, setDoc] = useState(handedOver?.tailored?.id === id ? handedOver.tailored : null)
  const [failure, setFailure] = useState(null)
  const [pending, setPending] = useState(null)
  const [error, setError] = useState(null)
  // some postings want a bare page, so the layout is chosen per job
  const [template, setTemplate] = useTemplate(`tailored-${id}`)
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    if (doc) return
    let alive = true
    tailoredApi.get(id).then(
      (found) => alive && setDoc(found),
      (e) => alive && setFailure(e.message),
    )
    return () => {
      alive = false
    }
  }, [id, doc])

  const toggle = async (change) => {
    setPending(change.id)
    setError(null)
    try {
      setDoc(await tailoredApi.setChange(id, change.id, !change.accepted))
      list.reload()
    } catch (e) {
      setError(e.message)
    } finally {
      setPending(null)
    }
  }

  const remove = async () => {
    try {
      await tailoredApi.remove(id)
      list.reload()
      navigate('/resume')
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <Sheet
      onClose={() => navigate('/resume')}
      size="large"
      header={{
        title: 'Tailored resume',
        trailing: () =>
          doc && (
            <button type="button" className="glass-button" onClick={() => setConfirming(true)} aria-label="Delete this version">
              <Trash2 size={16} strokeWidth={2.4} aria-hidden />
            </button>
          ),
      }}
      footer={
        doc && (
          <div className="stack tailored-view__export">
            <Segmented label="Layout for this job" options={TEMPLATES} value={template} onChange={setTemplate} />
            <ExportButtons
              fetchFile={(options) => tailoredApi.file(id, options)}
              name={`Resume - ${doc.company}`}
              template={template}
              onError={setError}
            />
          </div>
        )
      }
    >
      {!doc && !failure && <SkeletonLines widths={[0.6, 0.4, 0.9, 0.8]} highlighted={-1} />}
      {failure && <ContentUnavailable icon={FileText} title="Couldn't open this version" description={failure} />}
      {doc && (
        <div className="stack tailored-view">
          <div className="stack tailored-view__head">
            <h2 className="t-title2">{doc.title}</h2>
            <p className="t-subhead c-2">{doc.company}</p>
          </div>
          <MatchCard match={doc.match} />
          <div className="stack tailored-view__changes">
            <h3 className="t-headline">How it was tailored</h3>
            <p className="t-footnote c-2">{changesNote(doc)}</p>
            {error && (
              <p className="t-footnote c-negative row tailored-view__warn">
                <TriangleAlert size={15} strokeWidth={2.4} aria-hidden /> {error}
              </p>
            )}
            {doc.changes.map((change) => (
              <ChangeCard key={change.id} change={change} locked={doc.editedByHand} busy={pending === change.id} onToggle={() => toggle(change)} />
            ))}
          </div>
        </div>
      )}
      {confirming && (
        <Confirm
          title="Delete this tailored resume?"
          message="Your base resume stays as it is."
          confirmLabel="Delete"
          onConfirm={remove}
          onClose={() => setConfirming(false)}
        />
      )}
    </Sheet>
  )
}

function changesNote(doc) {
  if (!doc.changes.length) return 'Your resume already reads well for this job, so nothing was changed.'
  if (doc.editedByHand) return 'You edited this version by hand, so these changes are kept as a record.'
  return 'Every change only rewords, reorders or trims what your resume already says. Revert any you don’t want.'
}

/** TailorMatchCard.swift: how much of the posting the tailored copy shows, and what it can't without inventing. */
function MatchCard({ match }) {
  const total = match.covered.length + match.missing.length
  const before =
    total === 0
      ? 'The posting listed no requirements'
      : match.coveredBefore === match.covered.length
        ? 'requirements shown, same as your base resume'
        : `requirements shown, up from ${match.coveredBefore}`
  return (
    <section className="card stack tailored-match">
      <div>
        <p className="t-large-title mono">
          {match.covered.length} of {total}
        </p>
        <p className="t-subhead c-2">{before}</p>
      </div>
      <Requirements title="Shown on your resume" items={match.covered} covered />
      <Requirements title="Still missing" items={match.missing} />
      {match.missing.length > 0 && (
        <p className="t-caption c-3">Skillit won&rsquo;t add what your resume and profile don&rsquo;t already show. Build these up on your roadmap.</p>
      )}
    </section>
  )
}

function Requirements({ title, items, covered = false }) {
  if (!items.length) return null
  const Icon = covered ? CircleCheck : Circle
  return (
    <div className="stack tailored-match__group">
      <p className="t-caption c-2">{title}</p>
      <ul className="stack tailored-match__list">
        {items.map((r) => (
          <li key={r.text} className="row tailored-match__item t-subhead">
            <Icon size={17} strokeWidth={2.4} className={covered ? 'c-positive' : 'c-3'} aria-label={covered ? 'Shown' : 'Missing'} />
            {r.required ? r.text : `${r.text} (nice to have)`}
          </li>
        ))}
      </ul>
    </div>
  )
}

/** TailorChangeRow.swift: before → after, why, the requirement it targets, and revert. */
function ChangeCard({ change, locked, busy, onToggle }) {
  return (
    <article className={`stack tailored-change${change.accepted ? '' : ' is-reverted'}`}>
      <div className="row tailored-change__head">
        <span className="t-caption semibold c-2 grow">
          {capitalized(change.section)} · {kindLabel(change.kind)}
        </span>
        {!locked && (
          <TextButton tone="action" onClick={onToggle} disabled={busy}>
            {busy ? <Spinner size={14} /> : change.accepted ? 'Revert' : 'Use this'}
          </TextButton>
        )}
      </div>
      <p className={`t-subhead c-2${change.accepted ? ' tailored-change__struck' : ''}`}>{change.before}</p>
      {change.kind !== 'trim' && (
        <>
          <ArrowDown size={14} className="c-3" aria-hidden />
          <p className="t-subhead tailored-change__after">{change.after}</p>
        </>
      )}
      <p className="t-footnote c-2">{change.why}</p>
      {change.requirement && <p className="t-caption c-agent">For &ldquo;{change.requirement}&rdquo;</p>}
    </article>
  )
}
