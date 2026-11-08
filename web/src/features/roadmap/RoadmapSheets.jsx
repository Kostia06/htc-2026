// The sheets over the roadmap, each its own route so the back button closes it:
// /roadmap/step/:id (StepDetailSheet.swift), /roadmap/step/:id/done and /roadmap/update (QuickUpdateView.swift).
import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useOutletContext, useParams } from 'react-router'
import { Target } from 'lucide-react'
import { namedRelative } from '../../lib/format'
import { RaisedButton } from '../../ui/Button'
import { ExpandableText, FactGrid } from '../../ui/Controls'
import { SkeletonLines } from '../../ui/Feedback'
import { Sheet } from '../../ui/Sheet'
import QuickUpdate from '../chat/QuickUpdate'
import { clearUpdateHandOff, peekUpdateHandOff } from '../chat/handoff'
import StartPracticeButton from '../practice/StartPracticeButton'
import { readPref } from '../../lib/cache'
import { allSteps, kindOf, LABELS } from './page'

const BACK = '/roadmap'

function useStep() {
  const { id } = useParams()
  const { page } = useOutletContext()
  const step = page ? allSteps(page).find((s) => s.id === id) : undefined
  return { step, loaded: Boolean(page) }
}

export function StepSheet() {
  const navigate = useNavigate()
  const { step, loaded } = useStep()

  // a link to a step that's gone (rebuilt roadmap) just shows the roadmap
  useEffect(() => {
    if (loaded && !step) navigate(BACK, { replace: true })
  }, [loaded, step, navigate])

  const close = () => navigate(BACK)
  if (!step)
    return (
      <Sheet onClose={close} label="Step">
        <SkeletonLines />
      </Sheet>
    )

  const isDone = step.status === 'done'
  const facts = [
    { label: 'Kind', value: kindOf(step).name },
    isDone
      ? { label: 'Status', value: step.completedAt ? `Done ${namedRelative(step.completedAt)}` : 'Done', tint: 'var(--positive)' }
      : { label: 'Status', value: LABELS[step.label] ?? 'Stretch' },
    { label: 'Time', value: step.estimate },
  ]

  const live = () => {
    const { companySlug, role } = step.action ?? {}
    const params = new URLSearchParams({ step: step.id, difficulty: readPref('practiceDifficulty', 'standard') })
    if (companySlug) params.set('company', companySlug)
    if (role) params.set('role', role)
    navigate(`/practice/session?${params}`)
  }

  return (
    <Sheet
      onClose={close}
      label={step.title}
      footer={
        isDone ? null : step.action?.type === 'crossroads' ? (
          <RaisedButton onClick={() => navigate('/crossroads')}>Open Crossroads</RaisedButton>
        ) : step.action ? (
          <StartPracticeButton companySlug={step.action.companySlug} role={step.action.role} stepId={step.id} onLive={live} />
        ) : (
          <RaisedButton onClick={() => navigate(`/roadmap/step/${step.id}/done`, { replace: true })}>Mark done</RaisedButton>
        )
      }
    >
      <h2 className="t-title2">{step.title}</h2>
      {step.why && (
        <p className="t-subhead c-agent step-sheet__why clamp-2">
          <Target size={16} strokeWidth={2.2} aria-hidden /> {step.why}
        </p>
      )}
      <FactGrid facts={facts} />
      {isDone && step.note && (
        <div className="step-sheet__block">
          <span className="t-caption c-2">What you did</span>
          <ExpandableText text={step.note} />
        </div>
      )}
      {step.detail && (
        <div className="step-sheet__block">
          <span className="t-caption c-2">How</span>
          <ExpandableText text={step.detail} />
        </div>
      )}
    </Sheet>
  )
}

/** "What did you do?" for one step; Skillit marks it done itself and only asks if it must. */
export function MarkDoneSheet() {
  const navigate = useNavigate()
  const { reload } = useOutletContext()
  const { step } = useStep()
  return <QuickUpdate key={step?.id ?? 'loading'} focusTitle={step?.title ?? 'this step'} focusStepId={step?.id} onApplied={reload} onClose={() => navigate(BACK)} />
}

// keyed by visit: picking another file from the plus menu while the sheet is open starts a fresh chat for it
export function UpdateSheet() {
  return <UpdateSheetChat key={useLocation().key} />
}

function UpdateSheetChat() {
  const navigate = useNavigate()
  const { reload } = useOutletContext()
  // the plus menu may have opened this with a file to send or the mic to start; taken once
  const [start] = useState(peekUpdateHandOff)
  useEffect(clearUpdateHandOff, [])
  return <QuickUpdate file={start?.file} listen={start?.listen} onApplied={reload} onClose={() => navigate(BACK)} />
}
