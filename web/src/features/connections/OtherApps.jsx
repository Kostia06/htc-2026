// OtherAppsSection.swift: any other app in Composio's catalog, searched on the server. These only connect: nothing is read
// from them yet, so a connected one says so. The curated services above keep their own rows and imports.
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, Search, X } from 'lucide-react'
import { appsApi, safeUrl } from '../../lib/client'
import { Spinner, TextButton } from '../../ui/Button'
import './connections.css'

const DEBOUNCE_MS = 300
const POLL_MS = 2000
const POLL_LIMIT = 90

export default function OtherApps() {
  const [connected, setConnected] = useState([])
  const [query, setQuery] = useState('')
  const [results, setResults] = useState(null)
  const [working, setWorking] = useState(null)
  const [error, setError] = useState(null)
  const latestQuery = useRef('')
  const polling = useRef(false)

  useEffect(() => {
    appsApi.list().then(setConnected, () => {})
  }, [])

  useEffect(() => {
    const needle = query.trim()
    latestQuery.current = needle
    if (!needle) return undefined
    const timer = setTimeout(() => {
      appsApi.search(needle).then(
        // an older, slower answer must not replace the one for what's typed now
        (page) => latestQuery.current === needle && setResults(page),
        (e) => latestQuery.current === needle && setError(e.message),
      )
    }, DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [query])

  const waitFor = useCallback(async (slug, popup) => {
    if (polling.current) return
    polling.current = true
    try {
      await pollUntilSettled(slug, popup, setConnected)
    } finally {
      polling.current = false
    }
  }, [])

  const connect = async (app) => {
    setWorking(app.slug)
    setError(null)
    try {
      const url = safeUrl(await appsApi.connect(app.slug, `${window.location.origin}/profile/connections`))
      if (!url) throw new Error(`${app.name} couldn't be reached just now, try again`)
      const popup = window.open(url, 'skillit-connect', 'popup,width=560,height=720')
      if (!popup) window.location.assign(url)
      else await waitFor(app.slug, popup)
    } catch (e) {
      setError(e.message)
    } finally {
      setWorking(null)
    }
  }

  const disconnect = async (app) => {
    setWorking(app.slug)
    setError(null)
    try {
      setConnected(await appsApi.disconnect(app.slug))
    } catch (e) {
      setError(e.message)
    } finally {
      setWorking(null)
    }
  }

  // back from a full-page sign-in (popup blocked): keep checking the one still pending
  const pending = connected.find((a) => a.status === 'pending')?.slug
  useEffect(() => {
    if (!pending) return undefined
    const timer = setTimeout(() => waitFor(pending, null), 0)
    return () => clearTimeout(timer)
  }, [pending, waitFor])

  const statusOf = new Map(connected.map((a) => [a.slug, a]))
  const showing = query.trim() ? results : null
  const rows = showing ? showing.apps.filter((a) => !a.curated).map((r) => ({ ...r, ...statusOf.get(r.slug) })) : connected

  const showMore = async () => {
    const needle = latestQuery.current
    setWorking('more')
    try {
      const page = await appsApi.search(needle, showing.next)
      if (latestQuery.current === needle) setResults((prev) => ({ apps: [...prev.apps, ...page.apps], next: page.next }))
    } catch (e) {
      setError(e.message)
    } finally {
      setWorking(null)
    }
  }
  return (
    <div className="stack work">
      <label className="row work__search">
        <Search size={16} strokeWidth={2.4} className="c-2" aria-hidden />
        <input
          className="t-body grow"
          type="search"
          placeholder="Search 1,700 apps, like Slack or Figma"
          aria-label="Search all apps"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {query && (
          <button type="button" className="work__clear c-2" aria-label="Clear search" onClick={() => setQuery('')}>
            <X size={16} strokeWidth={2.4} aria-hidden />
          </button>
        )}
      </label>
      <ul className="stack work__list">
        {rows.map((app) => (
          <li key={app.slug}>
            <AppRow app={app} busy={working === app.slug} onConnect={() => connect(app)} onDisconnect={() => disconnect(app)} />
          </li>
        ))}
      </ul>
      {showing && rows.length === 0 && <p className="t-footnote c-2">No app called &ldquo;{query.trim()}&rdquo;.</p>}
      {showing?.next &&
        (working === 'more' ? (
          <Spinner />
        ) : (
          <TextButton tone="action" onClick={showMore}>
            Show more
          </TextButton>
        ))}
      {!showing && rows.length === 0 && <p className="t-footnote c-2">Connect anything else you work in. Skillit&rsquo;s assistant can look things up in them, read-only.</p>}
      {error && <p className="t-footnote c-negative">{error}</p>}
    </div>
  )
}

// checks until the sign-in lands, the popup is closed with nothing pending, or a full-page return finds nothing waiting
async function pollUntilSettled(slug, popup, setConnected) {
  for (let i = 0; i < POLL_LIMIT; i++) {
    await new Promise((r) => setTimeout(r, POLL_MS))
    const latest = await appsApi.list().catch(() => null)
    if (!latest) continue
    setConnected(latest)
    const current = latest.find((a) => a.slug === slug)
    if (current?.status === 'connected') {
      if (popup && !popup.closed) popup.close()
      return
    }
    if (popup?.closed && current?.status !== 'pending') return
    if (!popup && !current) return
  }
}

function AppRow({ app, busy, onConnect, onDisconnect }) {
  const linked = app.status === 'connected' || app.status === 'revoking'
  return (
    <div className="row work__head">
      <AppLogo app={app} />
      <span className="stack grow">
        <span className="t-headline">{app.name}</span>
        <span className="t-footnote c-2">{statusLine(app)}</span>
      </span>
      {busy ? (
        <Spinner />
      ) : linked ? (
        <TextButton tone="destructive" onClick={onDisconnect} aria-label={`Disconnect ${app.name}`}>
          Disconnect
        </TextButton>
      ) : app.connectable === false ? (
        <span className="t-footnote c-2">Not yet</span>
      ) : (
        <TextButton tone="action" onClick={onConnect} aria-label={`Connect ${app.name}`}>
          Connect
        </TextButton>
      )}
    </div>
  )
}

function AppLogo({ app }) {
  const [broken, setBroken] = useState(false)
  if (!app.logo || broken || !app.logo.startsWith('https://')) {
    return (
      <span className="logo logo--other c-2" aria-hidden>
        <Link size={20} strokeWidth={2.2} />
      </span>
    )
  }
  return (
    <span className="logo logo--app" aria-hidden>
      <img src={app.logo} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} />
    </span>
  )
}

function statusLine(app) {
  if (app.status === 'connected') return 'Connected · nothing imported yet'
  if (app.status === 'pending') return `Finish signing in on ${app.name}`
  if (app.status === 'revoking') return "Disconnecting didn't finish. Try again."
  if (app.connectable === false) return "Skillit can't connect this one yet"
  return app.category ? app.category[0].toUpperCase() + app.category.slice(1) : 'Connect to keep it with your work'
}
