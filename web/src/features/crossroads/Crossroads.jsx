// Crossroads: what people on the person's road learned, and where it matches their own notes. One insight on top,
// then matches, the rest of the road, and what is only theirs. Opening it finishes its step on the road.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Lock, Signpost } from 'lucide-react'
import { crossroadsApi, memoriesApi } from '../../lib/client'
import { useOnUpdatesApplied } from '../../lib/hooks'
import { ContentUnavailable, SkeletonCard } from '../../ui/Feedback'
import { Page, PageHeader } from '../../ui/Layout'
import { AskBar } from './AskBar'
import { CrossroadsDetail } from './Detail'
import { FactCard, LineCard, TeachingEmpty, YourCard } from './Cards'
import { Explainer, PathInsight } from './Insight'
import { matchesOf, pathInsight, unlinked } from './links'
import './crossroads.css'

const SEEN_KEY = 'skillit.crossroadsExplainerSeen'

function useCrossroads() {
  const [state, setState] = useState({ data: null, error: null })
  const load = useCallback(
    () =>
      crossroadsApi.load().then(
        (data) => setState({ data, error: null }),
        (e) => setState((s) => ({ ...s, error: e.message })),
      ),
    [],
  )
  useEffect(() => {
    load()
  }, [load])
  useOnUpdatesApplied(load)
  const update = (fn) => setState((s) => ({ ...s, data: s.data && fn(s.data) }))
  return { ...state, load, update }
}

function useExplainerSeen() {
  const [seen, setSeen] = useState(() => {
    try {
      return localStorage.getItem(SEEN_KEY) === '1'
    } catch {
      return false
    }
  })
  const dismiss = () => {
    setSeen(true)
    try {
      localStorage.setItem(SEEN_KEY, '1')
    } catch {
      // private mode: it shows again next visit, which is harmless
    }
  }
  return [seen, dismiss]
}

function Section({ id, title, detail, children }) {
  return (
    <section className="xr-section" aria-labelledby={id}>
      <header>
        <h2 id={id} className="t-title3">{title}</h2>
        <p className="t-subhead c-2">{detail}</p>
      </header>
      {children}
    </section>
  )
}

export default function Crossroads() {
  const { data, error, load, update } = useCrossroads()
  const [seen, dismiss] = useExplainerSeen()
  const [cited, setCited] = useState(new Set())
  const [actionError, setActionError] = useState(null)
  const [detail, setDetail] = useState(null)
  const matches = useMemo(() => (data ? matchesOf(data) : []), [data])
  const rest = useMemo(() => (data ? unlinked(data) : null), [data])

  const act = (work) => async (item) => {
    setActionError(null)
    try {
      await work(item)
    } catch (e) {
      setActionError(e.message)
    }
  }
  const meToo = act(async (line) => {
    const result = await crossroadsApi.meToo(line.id, !line.meToo)
    // a real line that drops under the bar is hidden again, so it leaves the page
    update((d) => ({
      ...d,
      everyone: result.line ? d.everyone.map((l) => (l.id === line.id ? result.line : l)) : d.everyone.filter((l) => l.id !== line.id),
    }))
  })
  const addToRoad = act(async (line) => {
    await crossroadsApi.addToRoad(line.id)
    update((d) => ({ ...d, yourRoad: { done: d.yourRoad?.done ?? [], added: [...(d.yourRoad?.added ?? []), line.id] } }))
  })
  const forget = act(async (item) => {
    await memoriesApi.forget(item.id)
    update((d) => ({ ...d, you: d.you.filter((y) => y.id !== item.id), links: d.links.filter((l) => l.you !== item.id) }))
  })

  const header = (
    <PageHeader title="Crossroads" large>
      {data && (
        <>
          <p className="t-title3 xr-intro">
            What people on the road to <span className="c-action">{data.road.goal}</span> learned, and where you match.
          </p>
          <p className="t-footnote c-2 xr-privacy">
            <Lock size={13} aria-hidden /> Only you see your notes. Counts show once {data.minPeople} people share something.
          </p>
        </>
      )}
    </PageHeader>
  )

  if (!data)
    return (
      <Page wide className="crossroads">
        {header}
        {error ? (
          <ContentUnavailable icon={Signpost} title="Couldn't load Crossroads" description={error}>
            <button type="button" className="glass-prominent" onClick={load}>
              Try again
            </button>
          </ContentUnavailable>
        ) : (
          <div className="xr-grid">
            <SkeletonCard widths={[0.4, 0.9, 0.7]} />
            <SkeletonCard widths={[0.5, 0.8, 0.9]} />
          </div>
        )}
      </Page>
    )

  const insight = pathInsight(data)
  const onRoad = new Set(data.yourRoad?.added ?? [])
  const lineCard = (line, match, key) => (
    <LineCard
      key={key}
      line={line}
      match={match}
      cited={cited.has(line.id)}
      onRoad={onRoad.has(line.id)}
      onMeToo={meToo}
      onAdd={addToRoad}
      onOpen={() => setDetail({ type: 'line', id: line.id, match })}
    />
  )
  const factCard = (fact, match, key) => (
    <FactCard key={key} fact={fact} match={match} cited={cited.has(fact.id)} onOpen={() => setDetail({ type: 'fact', id: fact.id, match })} />
  )
  // read live from the data so "Me too" and "Add" show their new state while the sheet is open
  const opened = detail && (detail.type === 'line' ? data.everyone : data.research).find((x) => x.id === detail.id)

  return (
    <Page wide className="crossroads">
      {header}
      {!seen && <Explainer goal={data.road.goal} onDismiss={dismiss} />}
      {insight && (
        <PathInsight
          insight={insight}
          cited={cited.has(insight.id)}
          otherRoles={data.trails.slice(1).map((t) => (t.example ? `${t.role} (example)` : t.role))}
        />
      )}
      {actionError && <p className="t-footnote c-negative xr-error" role="alert">{actionError}</p>}
      <div className="xr-grid">
        <div className="xr-main">
          <Section id="xr-matches" title="Where you match" detail="What people on your road said that lines up with your notes">
            {matches.length === 0 && (
              <TeachingEmpty>No matches yet. Practise an interview or finish a step: Skillit remembers what you’re working on and matches it here.</TeachingEmpty>
            )}
            <ul className="xr-list">
              {matches.map((m) =>
                m.type === 'line' ? lineCard(m.other, m.you, m.id) : factCard(m.other, m.you, m.id),
              )}
            </ul>
          </Section>
          <Section id="xr-road" title="More from your road" detail="Anonymous. “Example” means Skillit wrote it until people share">
            {rest.lines.length + rest.facts.length === 0 && (
              <TeachingEmpty>Nobody has shared from this road yet. When people land a job, what helped them shows up here.</TeachingEmpty>
            )}
            <ul className="xr-list">
              {rest.lines.map((line) => lineCard(line, null, line.id))}
              {rest.facts.map((fact) => factCard(fact, null, fact.id))}
            </ul>
          </Section>
        </div>
        {(rest.yours.length > 0 || matches.length === 0) && (
          <aside className="xr-aside">
            <Section id="xr-yours" title="Only you can see these" detail="Your notes that don’t match anyone yet">
              {rest.yours.length === 0 && <TeachingEmpty>Nothing saved yet. What you practise and finish lands here, private to you.</TeachingEmpty>}
              <ul className="xr-list">
                {rest.yours.map((item) => (
                  <YourCard key={item.id} item={item} cited={cited.has(item.id)} onForget={forget} />
                ))}
              </ul>
            </Section>
          </aside>
        )}
      </div>
      {opened && (
        <CrossroadsDetail
          detail={{ type: detail.type, other: opened, match: detail.match }}
          goal={data.road.goal}
          minPeople={data.minPeople}
          onRoad={onRoad.has(opened.id)}
          onMeToo={meToo}
          onAdd={addToRoad}
          onClose={() => setDetail(null)}
        />
      )}
      <AskBar onCited={(cites) => setCited(new Set(cites.map((c) => c.id)))} />
    </Page>
  )
}
