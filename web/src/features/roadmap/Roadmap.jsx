// RoadmapView.swift + RoadmapPath.swift: progress at the top, then the winding trail of steps to the goal job.
// Finished steps come first (the last three, unless expanded), then where you are, then what's next, then the goal.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Outlet, useNavigate } from 'react-router'
import { Check, FileText, Flag, Flame, MessageSquarePlus, Route } from 'lucide-react'
import { roadmapApi } from '../../lib/client'
import { weekday } from '../../lib/format'
import { RaisedButton } from '../../ui/Button'
import { ContentUnavailable, SkeletonCard, SkeletonLines, ThinProgressBar } from '../../ui/Feedback'
import { BarButton, Page, PageHeader } from '../../ui/Layout'
import { appendPage, completeStep, doneSteps, kindOf, replaceStep, restoreStep, resumeSteps, trailProgress } from './page'
import { ResumeStepsCard } from './ResumeSteps'
import './roadmap.css'

const RECENT_DONE = 3
const ROW = 118
const TILE = 68

export default function Roadmap() {
  const navigate = useNavigate()
  const [state, setState] = useState({ phase: 'loading', page: null, message: null })
  const [more, setMore] = useState({ loading: false, failed: false })
  const pageRef = useRef(null)
  const loadingMore = useRef(false)

  useEffect(() => {
    pageRef.current = state.page
  })

  const setPage = (edit) => setState((s) => (s.page ? { ...s, page: edit(s.page) } : s))

  // the first load shows the skeleton; a refresh keeps the page on screen until the new one arrives
  const load = useCallback(async () => {
    try {
      const page = await roadmapApi.page()
      setState({ phase: 'ready', page, message: null })
    } catch (e) {
      setState((s) => (s.page ? s : { phase: 'failed', page: null, message: e.message }))
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const loadMore = useCallback(async () => {
    const cursor = pageRef.current?.nextCursor
    if (!cursor || loadingMore.current) return
    loadingMore.current = true
    setMore({ loading: true, failed: false })
    try {
      const next = await roadmapApi.page(cursor)
      setState((s) => (s.page ? { ...s, page: appendPage(s.page, next) } : s))
      setMore({ loading: false, failed: false })
    } catch {
      setMore({ loading: false, failed: true })
    } finally {
      loadingMore.current = false
    }
  }, [])

  /** Moves the step into today's group at once, then tells the server; a refused change is put back. */
  const complete = useCallback(async (stepId, note) => {
    const current = pageRef.current
    const result = current && completeStep(current, stepId, note)
    if (!result) return
    const [, previous] = result
    setState((s) => (s.page ? { ...s, page: completeStep(s.page, stepId, note)?.[0] ?? s.page } : s))
    try {
      const saved = await roadmapApi.setStatus(stepId, 'done', note)
      setState((s) => (s.page ? { ...s, page: replaceStep(s.page, saved) } : s))
    } catch {
      setState((s) => (s.page ? { ...s, page: restoreStep(s.page, previous) } : s))
    }
  }, [])

  return (
    <Page className="roadmap">
      <PageHeader
        title="Road"
        showTitle={false}
        actions={<BarButton icon={MessageSquarePlus} label="Update" showLabel onClick={() => navigate('/roadmap/update')} />}
      />
      {state.phase === 'loading' && <RoadmapSkeleton />}
      {state.phase === 'failed' && (
        <ContentUnavailable icon={Route} title="Couldn't load your road" description={state.message}>
          <RaisedButton onClick={load}>Try again</RaisedButton>
        </ContentUnavailable>
      )}
      {state.page && <RoadmapPath page={state.page} more={more} onMore={loadMore} onOpen={(step) => navigate(`/roadmap/step/${step.id}`)} />}
      <Outlet context={{ page: state.page, complete, reload: load, setPage }} />
    </Page>
  )
}

function RoadmapPath({ page, more, onMore, onOpen }) {
  const [showAll, setShowAll] = useState(false)
  const [width, setWidth] = useState(0)
  const trail = useRef(null)
  const end = useRef(null)

  const done = doneSteps(page)
  const fromResume = resumeSteps(page)
  const stops = [...(showAll ? done : done.slice(-RECENT_DONE)), ...page.next]
  const currentId = page.next[0]?.id
  const stateOf = (step) => (step.status === 'done' ? 'done' : step.id === currentId ? 'current' : 'upcoming')
  const sway = (i) => Math.sin(i * 0.9) * width * 0.18

  useLayoutEffect(() => {
    const node = trail.current
    if (!node) return undefined
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  // when the current step changes, bring it to the middle of the screen
  useEffect(() => {
    if (!currentId) return
    const el = document.getElementById(`stop-${currentId}`)
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [currentId])

  // the end of the list coming into view loads the next steps
  useEffect(() => {
    const node = end.current
    if (!node || !page.nextCursor) return undefined
    const observer = new IntersectionObserver(([entry]) => entry.isIntersecting && onMore(), { rootMargin: '400px 0px' })
    observer.observe(node)
    return () => observer.disconnect()
  }, [page.nextCursor, onMore])

  return (
    <div className="roadmap__body">
      <ProgressCard goal={page.goal} progress={trailProgress(page)} fromResume={fromResume.length} />
      {fromResume.length > 0 && <ResumeStepsCard steps={fromResume} onOpen={onOpen} />}
      {done.length > RECENT_DONE && (
        <button type="button" className="roadmap__earlier t-subhead semibold" onClick={() => setShowAll(!showAll)}>
          {showAll ? 'Hide earlier steps' : `Show ${done.length - RECENT_DONE} earlier steps`}
        </button>
      )}
      <div className="trail" ref={trail}>
        {width > 0 &&
          stops.map((step, i) => (
            <PathRow key={step.id} id={`stop-${step.id}`} width={width} sway={sway(i)} previousSway={i === 0 ? null : sway(i - 1)}>
              {{
                tile: <PathNode step={step} state={stateOf(step)} onClick={() => onOpen(step)} />,
                label: <StopLabel step={step} state={stateOf(step)} />,
              }}
            </PathRow>
          ))}
        {page.nextCursor ? (
          <div ref={end} className="roadmap__more">
            {more.failed ? (
              <div className="card stack roadmap__more-failed">
                <p className="t-subhead c-2">Couldn&rsquo;t load more steps</p>
                <RaisedButton variant="grey" onClick={onMore}>
                  Try again
                </RaisedButton>
              </div>
            ) : (
              <SkeletonCard widths={[0.6, 0.4]} highlighted={-1} />
            )}
          </div>
        ) : (
          width > 0 && (
            <PathRow width={width} sway={sway(stops.length)} previousSway={stops.length ? sway(stops.length - 1) : null}>
              {{
                tile: (
                  <div className="goal-tile" aria-label="Goal">
                    <Flag size={24} strokeWidth={2.6} aria-hidden />
                  </div>
                ),
                label: (
                  <div className="stop-label">
                    <span className="t-caption semibold c-agent">Goal</span>
                    <span className="t-subhead semibold clamp-2">{page.goal}</span>
                  </div>
                ),
              }}
            </PathRow>
          )
        )}
      </div>
    </div>
  )
}

function ProgressCard({ goal, progress, fromResume }) {
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

/**
 * One stop on the trail, laid out like PathRow.swift: the tile sits `sway` off centre, its label on the far side,
 * and a dotted S-curve runs up to the previous tile.
 */
function PathRow({ id, width, sway, previousSway, children }) {
  const tileX = width / 2 + sway
  const half = TILE / 2 + 14
  const onLeft = sway > 0
  const room = onLeft ? tileX - half - 20 : width - tileX - half - 20
  const labelWidth = Math.max(80, room)
  const labelLeft = onLeft ? tileX - half - labelWidth : tileX + half
  return (
    <div id={id} className="path-row" style={{ height: ROW }}>
      {previousSway !== null && <DottedTrail from={width / 2 + previousSway} to={tileX} width={width} />}
      <div className="path-row__tile" style={{ left: tileX - TILE / 2, top: ROW / 2 - TILE / 2 }}>
        {children.tile}
      </div>
      <div className={`path-row__label${onLeft ? ' is-left' : ''}`} style={{ left: labelLeft, width: labelWidth, top: ROW / 2 }}>
        {children.label}
      </div>
    </div>
  )
}

/** Round 3px dots 9px apart from just under the previous tile to just over this one. */
function DottedTrail({ from, to, width }) {
  const clearance = TILE / 2 + 10
  const startY = -ROW / 2 + clearance
  const endY = ROW / 2 - clearance
  return (
    <svg className="path-row__trail" width={width} height={ROW} viewBox={`0 ${-ROW / 2} ${width} ${ROW}`} aria-hidden>
      <path d={`M ${from} ${startY} C ${from} 0, ${to} 0, ${to} ${endY}`} />
    </svg>
  )
}

/** PathNode.swift: a 68px tile on a 6px ledge. Sage when done or current, grey ahead. */
function PathNode({ step, state, onClick }) {
  const Icon = state === 'done' ? Check : kindOf(step).icon
  return (
    <button type="button" className={`path-node is-${state}`} onClick={onClick} aria-label={`${step.title}, ${state === 'current' ? 'you are here' : state}`}>
      <span className="path-node__face">
        <Icon size={26} strokeWidth={state === 'done' ? 3.2 : 2.4} aria-hidden />
      </span>
      {state === 'current' && <span className="path-node__here t-caption2 bold">You&rsquo;re here</span>}
    </button>
  )
}

function StopLabel({ step, state }) {
  const kind = kindOf(step).name
  const meta = state === 'done' && step.completedAt ? `Done ${weekday(step.completedAt)}` : step.estimate ? `${kind} · ${step.estimate}` : kind
  return (
    <div className="stop-label">
      <span className={`t-caption semibold ${state === 'current' ? 'c-action' : 'c-2'}`}>{meta}</span>
      <span className={`t-subhead semibold clamp-2 ${state === 'upcoming' ? 'c-2' : ''}`}>{step.title}</span>
    </div>
  )
}

function RoadmapSkeleton() {
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
