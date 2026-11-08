// ForYouView.swift + ForYouModel.swift: the feed by section. Opens on the last For you page from this device,
// then refreshes each section quietly as it's shown; while the server builds a fresher feed it asks again every 2s.
import { useCallback, useEffect, useRef, useState } from 'react'
import { Outlet, useNavigate, useSearchParams } from 'react-router'
import { Bookmark, Inbox, RotateCw, Search } from 'lucide-react'
import { readCache, writeCache } from '../../lib/cache'
import { feedApi } from '../../lib/client'
import { ChipBar } from '../../ui/Controls'
import { Spinner } from '../../ui/Button'
import { ContentUnavailable, SkeletonCard } from '../../ui/Feedback'
import { BarButton, Page, PageHeader } from '../../ui/Layout'
import FeedCard from './FeedCard'
import Radar from './Radar'
import { SECTIONS } from './kinds'
import './foryou.css'

const POLL_MS = 2000
const MAX_POLLS = 15
const CACHE = 'feed'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
// not a feed section: the companies Skillit tracks, as the last chip like SectionChips.swift
const RADAR = { id: 'radar', title: 'Radar' }
const CHIPS = [...SECTIONS, RADAR]

export default function ForYou() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const isRadar = params.get('section') === RADAR.id
  const section = SECTIONS.some((s) => s.id === params.get('section')) ? params.get('section') : 'all'
  const [timelines, setTimelines] = useState(() => {
    const saved = readCache(CACHE)
    return saved ? { all: saved } : {}
  })
  const [building, setBuilding] = useState(false)
  const [errors, setErrors] = useState({})
  const [loadingMore, setLoadingMore] = useState(false)
  const timelinesRef = useRef(timelines)
  const refreshing = useRef({})

  useEffect(() => {
    timelinesRef.current = timelines
    if (timelines.all) writeCache(CACHE, { cards: timelines.all.cards.slice(0, 40), nextCursor: timelines.all.nextCursor })
  }, [timelines])

  // newPostings is the web's pull to refresh: only its first request asks the server to search again
  const refresh = useCallback(async (which, { newPostings = false } = {}) => {
    if (refreshing.current[which]) return
    refreshing.current[which] = true
    try {
      for (let i = 0; i < MAX_POLLS; i++) {
        let page
        try {
          page = await (newPostings && i === 0 ? feedApi.fresh(which) : feedApi.page(which))
        } catch (e) {
          // with cards on screen a failed refresh stays silent; the cached feed is still useful
          if (!timelinesRef.current[which]?.cards.length) setErrors((x) => ({ ...x, [which]: e.message }))
          setBuilding(false)
          return
        }
        setBuilding(page.building)
        setErrors((x) => ({ ...x, [which]: null }))
        if (!page.building || page.items.length) {
          setTimelines((t) => ({ ...t, [which]: { cards: page.items, nextCursor: page.nextCursor } }))
        }
        if (!page.building) return
        await sleep(POLL_MS)
      }
      setBuilding(false)
    } finally {
      refreshing.current[which] = false
    }
  }, [])

  useEffect(() => {
    if (!isRadar) refresh(section)
  }, [section, isRadar, refresh])

  const loadMore = useCallback(async () => {
    const cursor = timelinesRef.current[section]?.nextCursor
    if (!cursor || refreshing.current[section]) return
    setLoadingMore(true)
    try {
      const page = await feedApi.page(section, cursor)
      setTimelines((t) => {
        const current = t[section] ?? { cards: [] }
        const known = new Set(current.cards.map((c) => c.id))
        return { ...t, [section]: { cards: [...current.cards, ...page.items.filter((c) => !known.has(c.id))], nextCursor: page.nextCursor } }
      })
    } catch {
      // the next scroll tries again
    } finally {
      setLoadingMore(false)
    }
  }, [section])

  const editAll = (edit) => setTimelines((t) => Object.fromEntries(Object.entries(t).map(([k, v]) => [k, { ...v, cards: edit(v.cards, k) }])))

  /** Fills the bookmark everywhere at once and puts the card at the top of Saved; the server call follows. */
  const save = async (card) => {
    if (card.saved) return
    const mark = (saved) => editAll((cards) => cards.map((c) => (c.id === card.id ? { ...c, saved } : c)))
    mark(true)
    setTimelines((t) => (t.saved ? { ...t, saved: { ...t.saved, cards: [{ ...card, saved: true }, ...t.saved.cards.filter((c) => c.id !== card.id)] } } : t))
    try {
      await feedApi.act(card.id, 'save')
    } catch {
      mark(false)
      setTimelines((t) => (t.saved ? { ...t, saved: { ...t.saved, cards: t.saved.cards.filter((c) => c.id !== card.id) } } : t))
    }
  }

  /** Empties the bookmark everywhere and takes the card out of Saved at once; it stays in the feed, since unsaving isn't "not for me". */
  const unsave = async (card) => {
    if (!card.saved) return
    const before = timelinesRef.current
    editAll((cards, key) => (key === 'saved' ? cards.filter((c) => c.id !== card.id) : cards.map((c) => (c.id === card.id ? { ...c, saved: false } : c))))
    try {
      await feedApi.act(card.id, 'unsave')
    } catch {
      setTimelines(before)
    }
  }

  const toggleSaved = (card) => (card.saved ? unsave(card) : save(card))

  /** The card leaves every section right away; if the server refuses, it slides back where it was. */
  const dismiss = async (card) => {
    const before = timelinesRef.current
    editAll((cards) => cards.filter((c) => c.id !== card.id))
    try {
      await feedApi.act(card.id, 'dismiss')
    } catch {
      setTimelines(before)
    }
  }

  const timeline = timelines[section]
  const cards = timeline?.cards ?? []
  const error = errors[section]
  // the open section first: a card just unsaved in Saved is gone from there, and other sections hold it unsaved
  const findCard = (id) => [timelines[section], ...Object.values(timelines)].flatMap((t) => t?.cards ?? []).find((c) => c.id === id)

  // the end of the list coming into view loads the next page
  const end = useRef(null)
  useEffect(() => {
    const node = end.current
    if (!node || isRadar || !timeline?.nextCursor) return undefined
    const observer = new IntersectionObserver(([entry]) => entry.isIntersecting && loadMore(), { rootMargin: '600px 0px' })
    observer.observe(node)
    return () => observer.disconnect()
  }, [isRadar, timeline?.nextCursor, loadMore])

  const attributions = [...new Map(cards.filter((c) => c.attribution).map((c) => [c.attribution.label, c.attribution])).values()]

  return (
    <Page wide className="foryou">
      <PageHeader
        title="For you"
        large
        actions={!isRadar && <BarButton icon={RotateCw} label="Refresh" onClick={() => refresh(section, { newPostings: true })} />}
      />
      <div className="foryou__chips">
        <ChipBar
          label="Sections"
          items={CHIPS}
          value={isRadar ? RADAR.id : section}
          onChange={(id) => setParams(id === 'all' ? {} : { section: id }, { replace: true })}
        />
      </div>

      {isRadar && <Radar />}

      {!isRadar && building && (
        <div className="building-row t-subhead medium c-agent" role="status">
          <Search size={17} strokeWidth={2.4} className="building-row__icon" aria-hidden /> Finding things for you…
        </div>
      )}

      {!isRadar && !timeline && !error && (
        <div className="foryou__grid">
          {[0, 1, 2, 3].map((i) => (
            <SkeletonCard key={i} widths={[0.5, 0.9, 0.7]} highlighted={2} />
          ))}
        </div>
      )}

      {!isRadar && (error || (timeline && !cards.length && !building)) && (
        <ContentUnavailable
          icon={section === 'saved' ? Bookmark : Inbox}
          title={error ? "Can't load your feed" : section === 'saved' ? 'Nothing saved yet' : 'Nothing here yet'}
          description={
            error ??
            (section === 'saved'
              ? 'Swipe a card right, or tap the bookmark, to keep it here.'
              : "Add the roles you're aiming for in Profile and Skillit will find things that fit.")
          }
        />
      )}

      {!isRadar && cards.length > 0 && (
        <div className="foryou__grid">
          {cards.map((card) => (
            <FeedCard
              key={card.id}
              card={card}
              inSaved={section === 'saved'}
              onOpen={() => navigate({ pathname: `/for-you/${encodeURIComponent(card.id)}`, search: params.toString() })}
              onSave={() => save(card)}
              onToggleSaved={() => toggleSaved(card)}
              onDismiss={() => (section === 'saved' ? unsave(card) : dismiss(card))}
            />
          ))}
        </div>
      )}

      <div ref={end} className="foryou__end">
        {loadingMore && <Spinner />}
      </div>

      {!isRadar && attributions.length > 0 && (
        <footer className="foryou__credits">
          {attributions.map((a) => (
            <a key={a.label} href={a.url} target="_blank" rel="noreferrer" className="t-caption c-2">
              {a.label}
            </a>
          ))}
        </footer>
      )}

      <Outlet context={{ findCard, toggleSaved, loaded: Boolean(timeline) }} />
    </Page>
  )
}
