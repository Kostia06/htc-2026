// The cards above and around the trail: ProgressCard.swift, ResumeStepsCard.swift and the loading skeleton.
import { useState } from 'react'
import { Check, ChevronDown, FileText, Flame } from 'lucide-react'
import { SkeletonCard, SkeletonLines, ThinProgressBar } from '../../ui/Feedback'

export function ProgressCard({ goal, progress, fromResume }) {
  const fraction = progress.total ? progress.done / progress.total : 0
  return (
    <section className="card progress-card">
      <p className="t-subhead c-2 clamp-1">On the way to {goal}</p>
      <p className="progress-card__count">
        <span className="rounded-num bold progress-card__done">{progress.done}</span>
        <span className="t-title3 medium c-2">/ {progress.total} steps</span>
      </p>
      <ThinProgressBar value={fraction} label="Steps done" />
      {(progress.streakDays > 0 || fromResume > 0) && (
        <div className="row progress-card__extras">
          {progress.streakDays > 0 && (
            <p className="t-footnote semibold c-action row progress-card__streak">
              <Flame size={14} strokeWidth={2.4} fill="currentColor" aria-hidden /> {progress.streakDays}-day streak
            </p>
          )}
          {fromResume > 0 && (
            <p className="t-footnote semibold c-2 row progress-card__streak">
              <FileText size={14} strokeWidth={2.4} aria-hidden /> +{fromResume} from your resume
            </p>
          )}
        </div>
      )}
    </section>
  )
}

/** The resume's finished steps folded into one card, so the path starts where the person is now. */
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

export function RoadmapSkeleton() {
  return (
    <div className="roadmap__body">
      <SkeletonCard widths={[0.5, 0.35, 0.9]} highlighted={1} />
      <div className="stack roadmap__skeleton">
        <span className="roadmap__skeleton-head shimmering" />
        <SkeletonCard widths={[0.7, 0.4, 0.9, 0.6]} highlighted={2} />
        <div className="card">
          <SkeletonLines widths={[0.7, 0.4, 0.9, 0.6]} highlighted={-1} />
        </div>
        <div className="card">
          <SkeletonLines widths={[0.7, 0.4, 0.9, 0.6]} highlighted={-1} />
        </div>
      </div>
    </div>
  )
}
