// WorkConnectionRow.swift: one service, what Skillit reads from it, Connect / Disconnect, and once connected what it took.
import { Lightbulb } from 'lucide-react'
import { Spinner, TextButton } from '../../ui/Button'
import ServiceLogo from './ServiceLogo'

export default function ConnectionRow({ connection: c, busy, onConnect, onDisconnect }) {
  const connected = c.status === 'connected'
  return (
    <div className="stack work__row">
      <div className="row work__head">
        <ServiceLogo connection={c} />
        <span className="stack grow">
          <span className="t-headline">{c.name}</span>
          <span className="t-footnote c-2">{statusLine(c)}</span>
        </span>
        {busy ? (
          <Spinner />
        ) : connected || c.status === 'revoking' ? (
          <TextButton tone="destructive" onClick={onDisconnect} aria-label={`Disconnect ${c.name}`}>
            Disconnect
          </TextButton>
        ) : !c.configured ? (
          <span className="t-footnote c-2">Coming soon</span>
        ) : (
          <TextButton tone="action" onClick={onConnect} aria-label={`Connect ${c.name}`}>
            Connect
          </TextButton>
        )}
      </div>
      {connected && c.projects.length > 0 && (
        <ul className="stack work__projects">
          {c.projects.map((p) => (
            <li key={p.name} className="stack">
              <span className="t-subhead semibold">{p.name}</span>
              {p.summary && <span className="t-footnote c-2">{p.summary}</span>}
            </li>
          ))}
          {c.suggestions.map((s) => (
            <li key={s} className="row work__idea t-footnote">
              <Lightbulb size={14} strokeWidth={2.4} aria-hidden /> {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function statusLine(c) {
  if (c.status === 'connected') return c.importing ? 'Reading your work…' : c.projects.length ? `${c.projects.length} added to your profile` : 'Connected'
  if (c.status === 'pending') return `Finish signing in on ${c.name}`
  if (c.status === 'revoking') return "Disconnecting didn't finish. Try again."
  return c.reads
}
