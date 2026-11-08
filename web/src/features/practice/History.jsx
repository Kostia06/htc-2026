// PracticeHistoryView.swift and PracticeSessionDetailView.swift: the average over time with a sparkline, every
// past session, and each one replayed answer by answer. History scores are on a 1–5 scale.
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { ArrowDownRight, ArrowUpRight, AudioWaveform, Lightbulb, UserRound } from 'lucide-react'
import { readCache, writeCache } from '../../lib/cache'
import { voiceApi } from '../../lib/client'
import { fullDate, relative } from '../../lib/format'
import { RaisedButton } from '../../ui/Button'
import { ContentUnavailable, SkeletonCard } from '../../ui/Feedback'
import { Page, PageHeader } from '../../ui/Layout'
import './practice.css'

const CACHE = 'history'
// scores are out of 100, the same number the report shows
const one = (n) => (Number.isFinite(n) ? String(Math.round(n)) : '–')

export function History() {
  const [page, setPage] = useState(() => readCache(CACHE))
  const [error, setError] = useState(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const end = useRef(null)

  const load = useCallback(
    () =>
      voiceApi.history().then(
        (first) => {
          setPage(first)
          setError(null)
          writeCache(CACHE, first)
        },
        (e) => setError(e.message),
      ),
    [],
  )

  useEffect(() => {
    load()
  }, [load])

  const loadMore = useCallback(async () => {
    if (!page?.nextCursor || loadingMore) return
    setLoadingMore(true)
    try {
      const next = await voiceApi.history(page.nextCursor)
      setPage((p) => {
        const known = new Set(p.sessions.map((s) => s.id))
        return { sessions: [...p.sessions, ...next.sessions.filter((s) => !known.has(s.id))], nextCursor: next.nextCursor }
      })
    } catch {
      // the next scroll tries again
    } finally {
      setLoadingMore(false)
    }
  }, [page, loadingMore])

  useEffect(() => {
    const node = end.current
    if (!node || !page?.nextCursor) return undefined
    const observer = new IntersectionObserver(([entry]) => entry.isIntersecting && loadMore(), { rootMargin: '400px 0px' })
    observer.observe(node)
    return () => observer.disconnect()
  }, [page?.nextCursor, loadMore])

  const sessions = page?.sessions ?? []
  return (
    <Page className="history">
      <PageHeader title="Practice history" large back={{ to: '/practice', label: 'Practice' }} />
      {!page && !error && (
        <div className="stack history__list">
          <SkeletonCard widths={[0.4, 0.9, 0.3]} highlighted={2} />
          {[0, 1, 2, 3].map((i) => (
            <SkeletonCard key={i} widths={[0.6, 0.4]} highlighted={-1} />
          ))}
        </div>
      )}
      {((error && !page) || (page && !sessions.length)) && (
        <ContentUnavailable
          icon={AudioWaveform}
          title={error ? "Couldn't load your history" : 'No practice yet'}
          description={error ?? 'Your interview sessions will show up here, with scores over time.'}
          className="history__empty"
        >
          {error && <RaisedButton onClick={load}>Try again</RaisedButton>}
        </ContentUnavailable>
      )}
      {sessions.length > 0 && (
        <div className="stack history__list">
          <TrendCard sessions={sessions} />
          {sessions.map((s) => (
            <SessionRow key={s.id} session={s} />
          ))}
          <div ref={end} />
        </div>
      )}
    </Page>
  )
}

function TrendCard({ sessions }) {
  // oldest first, finished and scored only
  const scores = sessions
    .filter((s) => s.status === 'finished' && Number.isFinite(s.score))
    .map((s) => s.score)
    .reverse()
  const average = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null
  const change = scores.length >= 2 ? scores[scores.length - 1] - scores[scores.length - 2] : null
  return (
    <section className="card trend-card">
      <div className="row trend-card__head">
        <div className="grow stack">
          <span className="t-subhead c-2">Average score</span>
          <p className="row trend-card__avg">
            <span className="t-large-title rounded-num">{one(average)}</span>
            <span className="t-title3 c-2">/ 100</span>
          </p>
        </div>
        {change !== null && (
          <span className={`trend-card__change t-subhead semibold ${change >= 0 ? 'is-up' : ''}`}>
            {change >= 0 ? <ArrowUpRight size={15} strokeWidth={2.6} aria-hidden /> : <ArrowDownRight size={15} strokeWidth={2.6} aria-hidden />}
            {change >= 0 ? '+' : ''}
            {Math.round(change)}
          </span>
        )}
      </div>
      {scores.length >= 2 ? <Sparkline scores={scores} /> : <p className="t-footnote c-2">Finish another session to see a trend.</p>}
    </section>
  )
}

/** ScoreSparkline.swift: smooth curve on the 0–100 scale that draws itself in, ending in a dot. */
function Sparkline({ scores, height = 56 }) {
  const width = 600
  const points = scores.map((s, i) => {
    const unit = Math.min(100, Math.max(0, s)) / 100
    return [scores.length === 1 ? width / 2 : (i / (scores.length - 1)) * width, 4 + (height - 8) * (1 - unit)]
  })
  const d = points.reduce((path, [x, y], i) => {
    if (i === 0) return `M ${x} ${y}`
    const [px, py] = points[i - 1]
    const mx = (px + x) / 2
    return `${path} C ${mx} ${py}, ${mx} ${y}, ${x} ${y}`
  }, '')
  const [lx, ly] = points[points.length - 1]
  return (
    <svg className="sparkline" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" height={height} aria-label="Scores over time">
      <path d={d} pathLength="1" vectorEffect="non-scaling-stroke" />
      <circle cx={lx} cy={ly} r="4" className="sparkline__dot" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

function SessionRow({ session }) {
  const when = relative(session.createdAt)
  return (
    <Link to={`/practice/history/${session.id}`} className="card session-row">
      <span className="session-row__icon">
        <UserRound size={20} strokeWidth={2.4} className="c-action" aria-hidden />
      </span>
      <span className="grow stack">
        <span className="t-headline">{session.companyName ?? 'General interview'}</span>
        <span className="t-subhead c-2">
          {when} · {session.turnCount} {session.turnCount === 1 ? 'answer' : 'answers'}
        </span>
      </span>
      {session.status === 'active' ? (
        <span className="t-caption semibold c-agent">In progress</span>
      ) : Number.isFinite(session.score) ? (
        <span className="t-title3 bold rounded-num">{one(session.score)}</span>
      ) : (
        <span className="t-caption c-2">Unscored</span>
      )}
    </Link>
  )
}

export function SessionDetail() {
  const { id } = useParams()
  const [state, setState] = useState({ phase: 'loading' })

  const load = useCallback(
    () =>
      voiceApi.session(id).then(
        (detail) => setState({ phase: 'ready', detail }),
        (e) => setState({ phase: 'failed', message: e.message }),
      ),
    [id],
  )

  useEffect(() => {
    load()
  }, [load])

  const detail = state.detail
  const turns = detail?.turns ?? []
  const avg = (t) => {
    const values = Object.values(t.scores ?? {})
    if (!values.length) return null
    // 1-5 ratings mapped like the report: lowest is 0, highest is 100
    return ((values.reduce((a, b) => a + b, 0) / values.length - 1) / 4) * 100
  }
  const scored = turns.map(avg).filter((v) => v !== null)
  const overall = scored.length ? scored.reduce((a, b) => a + b, 0) / scored.length : null

  return (
    <Page className="session-detail">
      <PageHeader title={detail?.companyName ?? 'Interview'} back={{ to: '/practice/history', label: 'History' }} />
      {state.phase === 'loading' && (
        <div className="stack history__list">
          {[0, 1, 2].map((i) => (
            <SkeletonCard key={i} widths={[0.7, 0.95, 0.9, 0.5]} />
          ))}
        </div>
      )}
      {state.phase === 'failed' && (
        <ContentUnavailable icon={AudioWaveform} title="Couldn't load this session" description={state.message}>
          <RaisedButton onClick={load}>Try again</RaisedButton>
        </ContentUnavailable>
      )}
      {detail && (
        <div className="stack history__list">
          <header className="row session-detail__head">
            <div className="grow stack">
              <span className="t-headline">Interview practice</span>
              <span className="t-subhead c-2">{fullDate(detail.createdAt)}</span>
            </div>
            {overall !== null && (
              <div className="stack session-detail__score">
                <span className="t-large-title rounded-num">{one(overall)}</span>
                <span className="t-caption c-2">of 100</span>
              </div>
            )}
          </header>
          {!turns.length && <p className="card t-body c-2">Nothing was said in this session.</p>}
          {turns.map((t) => (
            <article key={t.idx} className="card turn-card">
              <div className="row turn-card__head">
                <p className="t-subhead semibold c-2 grow">{t.question}</p>
                {avg(t) !== null && <span className="t-title3 bold rounded-num">{one(avg(t))}</span>}
              </div>
              <p className="t-body">{t.answer}</p>
              {t.delivery && (
                <p className="t-caption c-2">
                  {[
                    `${t.delivery.words} words`,
                    `${t.delivery.fillerWords} ${t.delivery.fillerWords === 1 ? 'filler' : 'fillers'}`,
                    t.delivery.wordsPerMinute ? `${Math.round(t.delivery.wordsPerMinute)} wpm` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              )}
              {t.tip && (
                <p className="turn-card__tip t-subhead c-agent">
                  <Lightbulb size={16} strokeWidth={2.2} aria-hidden /> {t.tip}
                </p>
              )}
            </article>
          ))}
        </div>
      )}
    </Page>
  )
}
