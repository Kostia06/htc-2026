// TailorJobSheet.swift at /resume/tailor: pick a saved posting or paste one, then wait while Skillit tailors a copy.
// On success it hands over to the change view at /resume/tailored/:id.
import { useEffect, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router'
import { CircleCheck, Circle, FileText } from 'lucide-react'
import { postingsApi, tailoredApi } from '../../../lib/client'
import { RaisedButton, Spinner } from '../../../ui/Button'
import { ContentUnavailable } from '../../../ui/Feedback'
import { Sheet } from '../../../ui/Sheet'

// long enough to be a posting rather than a stray line; the server makes the real call
const MIN_PASTED = 80

export function TailorSheet() {
  const navigate = useNavigate()
  const { tailored } = useOutletContext()
  const [postings, setPostings] = useState([])
  const [selected, setSelected] = useState(null)
  const [text, setText] = useState('')
  const [phase, setPhase] = useState({ name: 'choosing' })

  useEffect(() => {
    let alive = true
    postingsApi.list().then(
      (list) => alive && setPostings(list),
      () => {},
    )
    return () => {
      alive = false
    }
  }, [])

  const pasted = text.trim()
  const source = selected ? { postingId: selected } : pasted.length >= MIN_PASTED ? { text: pasted } : null

  const tailor = async () => {
    setPhase({ name: 'tailoring' })
    try {
      const made = await tailoredApi.create(source)
      tailored.reload()
      navigate(`/resume/tailored/${made.id}`, { replace: true, state: { tailored: made } })
    } catch (e) {
      setPhase({ name: 'failed', message: e.message })
    }
  }

  return (
    <Sheet
      onClose={() => navigate('/resume')}
      size="large"
      header={{ title: 'Tailor for a job' }}
      footer={
        phase.name === 'choosing' && (
          <RaisedButton onClick={tailor} disabled={!source}>
            Tailor my resume
          </RaisedButton>
        )
      }
    >
      {phase.name === 'tailoring' && (
        <div className="stack tailor-wait" role="status">
          <Spinner size={26} className="c-agent" />
          <p className="t-headline">Matching your resume to the posting…</p>
          <p className="t-subhead c-2">This takes about half a minute. Nothing is added that your resume doesn&rsquo;t already say.</p>
        </div>
      )}

      {phase.name === 'failed' && (
        <ContentUnavailable icon={FileText} title="Couldn't tailor your resume" description={phase.message}>
          <RaisedButton onClick={() => setPhase({ name: 'choosing' })}>Try again</RaisedButton>
        </ContentUnavailable>
      )}

      {phase.name === 'choosing' && (
        <div className="stack tailor-pick">
          {postings.length > 0 && (
            <div className="stack tailor-pick__group">
              <p className="t-caption c-2">Your saved postings</p>
              {postings.map((p) => {
                const isSelected = selected === p.id
                return (
                  <button
                    key={p.id}
                    type="button"
                    className={`row tailor-pick__posting${isSelected ? ' is-selected' : ''}`}
                    aria-pressed={isSelected}
                    onClick={() => {
                      setSelected(isSelected ? null : p.id)
                      setText('')
                    }}
                  >
                    <span className="stack grow">
                      <span className="t-subhead semibold">{p.title}</span>
                      <span className="t-footnote c-2">{p.company}</span>
                    </span>
                    {isSelected ? <CircleCheck size={20} className="c-action" aria-hidden /> : <Circle size={20} className="c-3" aria-hidden />}
                  </button>
                )
              })}
            </div>
          )}
          <label className="stack tailor-pick__group">
            <span className="t-caption c-2">{postings.length ? 'Or paste a posting' : 'Paste the job posting'}</span>
            <textarea
              className="field t-subhead"
              rows={8}
              value={text}
              placeholder="The job title, the company and what they ask for"
              onChange={(e) => {
                setText(e.target.value)
                if (e.target.value) setSelected(null)
              }}
            />
          </label>
        </div>
      )}
    </Sheet>
  )
}
