// BringYourWorkList.swift: a search field and every service Skillit can read work from, each one optional. Sign-ins open in
// a popup so a half-finished onboarding isn't lost; the app only learns "connected" and the derived project summaries.
import { useCallback, useEffect, useRef, useState } from 'react'
import { Lock, Search, X } from 'lucide-react'
import { connectionsApi, safeUrl } from '../../lib/client'
import ConnectionRow from './ConnectionRow'
import { matches } from './search'
import './connections.css'

const POLL_MS = 2000
const POLL_LIMIT = 90

const isDone = (c) => !c || c.status === 'not_connected' || (c.status === 'connected' && !c.importing && c.projects.length > 0)
const isWaiting = (c) => c.importing || c.status === 'pending'

export default function BringYourWork({ onChange, onAnyConnected }) {
  const [connections, setConnections] = useState(null)
  const [query, setQuery] = useState('')
  const [working, setWorking] = useState(null)
  const [error, setError] = useState(null)
  const polling = useRef(false)

  useEffect(() => {
    connectionsApi.list().then(setConnections, (e) => setError(e.message))
  }, [])

  const anyConnected = Boolean(connections?.some((c) => c.status === 'connected'))
  useEffect(() => onAnyConnected?.(anyConnected), [anyConnected, onAnyConnected])

  const poll = useCallback(
    async (id, popup) => {
      if (polling.current) return
      polling.current = true
      try {
        for (let i = 0; i < POLL_LIMIT; i++) {
          await new Promise((r) => setTimeout(r, POLL_MS))
          const latest = await connectionsApi.list().catch(() => null)
          if (!latest) continue
          setConnections(latest)
          const current = latest.find((c) => c.id === id)
          if (current?.status === 'connected' && popup && !popup.closed) popup.close()
          // a closed popup with nothing pending means the person gave up
          if (isDone(current) || (popup?.closed && current && !isWaiting(current))) break
        }
        onChange?.()
      } finally {
        polling.current = false
      }
    },
    [onChange],
  )

  const connect = async (connection) => {
    setWorking(connection.id)
    setError(null)
    try {
      const url = safeUrl(await connectionsApi.connect(connection.id, `${window.location.origin}/profile/details?connected=${connection.id}`))
      if (!url) throw new Error(`${connection.name} couldn't be reached just now, try again`)
      const popup = window.open(url, 'skillit-connect', 'popup,width=560,height=720')
      if (!popup) window.location.assign(url)
      else await poll(connection.id, popup)
    } catch (e) {
      setError(e.message)
    } finally {
      setWorking(null)
    }
  }

  const disconnect = async (connection) => {
    setWorking(connection.id)
    setError(null)
    try {
      const updated = await connectionsApi.disconnect(connection.id)
      setConnections((all) => all.map((c) => (c.id === updated.id ? updated : c)))
      onChange?.()
    } catch (e) {
      setError(e.message)
    } finally {
      setWorking(null)
    }
  }

  // back from a full-page sign-in (popup blocked): the first status check starts the import, then wait for it
  const waitingFor = connections?.find(isWaiting)?.id
  useEffect(() => {
    if (waitingFor) poll(waitingFor, null)
  }, [waitingFor, poll])

  const visible = (connections ?? []).filter((c) => matches(c, query))
  return (
    <div className="stack work">
      <label className="row work__search">
        <Search size={16} strokeWidth={2.4} className="c-2" aria-hidden />
        <input
          className="t-body grow"
          type="search"
          placeholder="Search, like design or video"
          aria-label="Search services"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {query && (
          <button type="button" className="work__clear c-2" aria-label="Clear search" onClick={() => setQuery('')}>
            <X size={16} strokeWidth={2.4} aria-hidden />
          </button>
        )}
      </label>
      {!connections && !error && <p className="t-footnote c-2">Checking…</p>}
      <ul className="stack work__list">
        {visible.map((c) => (
          <li key={c.id}>
            <ConnectionRow connection={c} busy={working === c.id} onConnect={() => connect(c)} onDisconnect={() => disconnect(c)} />
          </li>
        ))}
      </ul>
      {connections && visible.length === 0 && <p className="t-footnote c-2">Nothing matches &ldquo;{query}&rdquo;. Try code, design, writing or video.</p>}
      {error && <p className="t-footnote c-negative">{error}</p>}
      <p className="row t-caption c-2 work__note">
        <Lock size={12} strokeWidth={2.4} aria-hidden /> Read-only. Skillit never posts or changes anything.
      </p>
    </div>
  )
}
