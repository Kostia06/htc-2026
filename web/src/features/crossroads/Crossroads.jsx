// Crossroads: the person's own notes on one side, everyone heading the same way on the other, and the places where
// they meet. Opening it finishes its step on the road (the server marks it done on load).
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Signpost } from 'lucide-react'
import { crossroadsApi, memoriesApi } from '../../lib/client'
import { ContentUnavailable, SkeletonCard } from '../../ui/Feedback'
import { Page, PageHeader } from '../../ui/Layout'
import { AskBar } from './AskBar'
import { YouLane, RoadLane } from './Lanes'
import { litIds, partnerMap } from './links'
import { Trails } from './Trails'
import './crossroads.css'

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
  const update = (fn) => setState((s) => ({ ...s, data: s.data && fn(s.data) }))
  return { ...state, load, update }
}

export default function Crossroads() {
  const { data, error, load, update } = useCrossroads()
  const [active, setActive] = useState(null)
  const [cited, setCited] = useState(new Set())
  const [actionError, setActionError] = useState(null)
  const partners = useMemo(() => partnerMap(data?.links ?? []), [data])
  const view = { lit: litIds(active, partners), cited, active }

  const meToo = async (line) => {
    setActionError(null)
    try {
      const result = await crossroadsApi.meToo(line.id, !line.meToo)
      // a real line that drops under the bar is hidden again, so it leaves the page
      update((d) => ({
        ...d,
        everyone: result.line ? d.everyone.map((l) => (l.id === line.id ? result.line : l)) : d.everyone.filter((l) => l.id !== line.id),
      }))
    } catch (e) {
      setActionError(e.message)
    }
  }

  const forget = async (item) => {
    setActionError(null)
    try {
      await memoriesApi.forget(item.id)
      update((d) => ({ ...d, you: d.you.filter((y) => y.id !== item.id), links: d.links.filter((l) => l.you !== item.id) }))
    } catch (e) {
      setActionError(e.message)
    }
  }

  const header = (
    <PageHeader title="Crossroads" large>
      {data && (
        <p className="t-subhead c-2 xr-intro">
          Where your road to <span className="c-action semibold">{data.road.goal}</span> meets everyone else's. Every person who reached a job made it a
          little clearer.
        </p>
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
          <div className="xr-lanes">
            <SkeletonCard widths={[0.4, 0.9, 0.7]} />
            <SkeletonCard widths={[0.5, 0.8, 0.9]} />
          </div>
        )}
      </Page>
    )

  return (
    <Page wide className="crossroads">
      {header}
      {actionError && <p className="t-footnote c-negative xr-error" role="alert">{actionError}</p>}
      <div className={`xr-lanes${active ? ' has-active' : ''}`}>
        <YouLane items={data.you} partners={partners} view={view} onActive={setActive} onForget={forget} />
        <div className="xr-spine" aria-hidden>
          <span>{data.links.length ? `${data.links.length} overlap${data.links.length === 1 ? '' : 's'}` : 'no overlaps yet'}</span>
        </div>
        <RoadLane
          road={data.road}
          lines={data.everyone}
          research={data.research}
          minPeople={data.minPeople}
          partners={partners}
          view={view}
          onActive={setActive}
          onMeToo={meToo}
        />
      </div>
      <Trails trails={data.trails} badges={data.badges} cited={cited} />
      <AskBar onCited={(cites) => setCited(new Set(cites.map((c) => c.id)))} />
    </Page>
  )
}
