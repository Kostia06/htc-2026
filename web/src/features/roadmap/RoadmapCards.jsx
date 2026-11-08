// The cards above and around the trail: ProgressCard.swift and the loading skeleton.
import { Flame } from 'lucide-react'
import { SkeletonCard, SkeletonLines, ThinProgressBar } from '../../ui/Feedback'

export function ProgressCard({ goal, progress }) {
  const fraction = progress.total ? progress.done / progress.total : 0
  return (
    <section className="card progress-card">
      <p className="t-subhead c-2 clamp-1">On the way to {goal}</p>
      <p className="progress-card__count">
        <span className="rounded-num bold progress-card__done">{progress.done}</span>
        <span className="t-title3 medium c-2">/ {progress.total} steps</span>
      </p>
      <ThinProgressBar value={fraction} label="Steps done" />
      {progress.streakDays > 0 && (
        <p className="t-footnote semibold c-action row progress-card__streak">
          <Flame size={14} strokeWidth={2.4} fill="currentColor" aria-hidden /> {progress.streakDays}-day streak
        </p>
      )}
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
