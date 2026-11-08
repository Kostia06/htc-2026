// GithubConnectRow.swift: "Connect GitHub", then what Skillit took from it and a way out. The sign-in opens in a popup
// so a half-finished onboarding isn't lost; the app only learns "connected" and the derived project summaries.
import { useCallback, useEffect, useRef, useState } from 'react'
import { Code, Lightbulb, Lock } from 'lucide-react'
import { connectionsApi, safeUrl } from '../../lib/client'
import { Spinner, TextButton } from '../../ui/Button'
import './connections.css'

const POLL_MS = 2000
const POLL_LIMIT = 90

const isDone = (github) => github.status === 'not_connected' || (github.status === 'connected' && !github.importing && github.projects.length > 0)

export default function GithubConnect({ onChange }) {
  const [github, setGithub] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const polling = useRef(false)

  useEffect(() => {
    connectionsApi.github().then(setGithub, (e) => setError(e.message))
  }, [])

  const poll = useCallback(
    async (popup) => {
      if (polling.current) return
      polling.current = true
      try {
        for (let i = 0; i < POLL_LIMIT; i++) {
          await new Promise((r) => setTimeout(r, POLL_MS))
          const latest = await connectionsApi.github().catch(() => null)
          if (latest) setGithub(latest)
          if (latest && latest.status === 'connected' && popup && !popup.closed) popup.close()
          // a closed popup with nothing pending means the person gave up
          if (latest && (isDone(latest) || (popup?.closed && latest.status !== 'pending' && !latest.importing))) break
        }
        onChange?.()
      } finally {
        polling.current = false
      }
    },
    [onChange],
  )

  const connect = async () => {
    setBusy(true)
    setError(null)
    try {
      const url = safeUrl(await connectionsApi.connectGithub(`${window.location.origin}/profile/details?github=done`))
      if (!url) throw new Error("GitHub couldn't be reached just now, try again")
      const popup = window.open(url, 'skillit-github', 'popup,width=560,height=720')
      if (!popup) window.location.assign(url)
      else await poll(popup)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const disconnect = async () => {
    setBusy(true)
    setError(null)
    try {
      setGithub(await connectionsApi.disconnectGithub())
      onChange?.()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  // back from a full-page sign-in (popup blocked): the first status check starts the import, then wait for it
  useEffect(() => {
    if (github?.importing || github?.status === 'pending') poll(null)
  }, [github?.importing, github?.status, poll])

  const connected = github?.status === 'connected'
  return (
    <div className="stack gh">
      <div className="row gh__head">
        <Code size={22} strokeWidth={2.2} className="c-action" aria-hidden />
        <span className="stack grow">
          <span className="t-headline">GitHub</span>
          <span className="t-footnote c-2">{statusLine(github)}</span>
        </span>
        {busy || !github ? (
          <Spinner />
        ) : !github.configured ? null : connected || github.status === 'revoking' ? (
          <TextButton tone="destructive" onClick={disconnect}>
            Disconnect
          </TextButton>
        ) : (
          <TextButton tone="action" onClick={connect}>
            Connect
          </TextButton>
        )}
      </div>
      {connected && github.projects.length > 0 && (
        <ul className="stack gh__projects">
          {github.projects.map((p) => (
            <li key={p.name} className="stack">
              <span className="t-subhead semibold">{p.name}</span>
              {p.summary && <span className="t-footnote c-2">{p.summary}</span>}
            </li>
          ))}
          {github.suggestions.map((s) => (
            <li key={s} className="row gh__idea t-footnote">
              <Lightbulb size={14} strokeWidth={2.4} aria-hidden /> {s}
            </li>
          ))}
        </ul>
      )}
      {error && <p className="t-footnote c-negative">{error}</p>}
      <p className="row t-caption c-2 gh__note">
        <Lock size={12} strokeWidth={2.4} aria-hidden /> Read-only. Skillit never posts or changes anything.
      </p>
    </div>
  )
}

function statusLine(github) {
  if (!github) return 'Checking…'
  if (!github.configured) return 'Not available yet'
  if (github.status === 'connected') return github.importing ? 'Reading your repos…' : github.projects.length ? `${github.projects.length} projects added` : 'Connected'
  if (github.status === 'pending') return 'Finish signing in on GitHub'
  if (github.status === 'revoking') return "Disconnecting didn't finish. Try again."
  return 'Add your public projects'
}
