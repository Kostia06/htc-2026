// Small pieces every AI panel shares.

export function Thinking({ children = 'Raven is working on it…' }) {
  return (
    <div className="db__thinking" role="status">
      <span className="ob__spinner" aria-hidden="true" />
      <div>
        <p>{children}</p>
        <p className="db__muted">This can take up to a minute while the agent reads and checks its sources.</p>
      </div>
    </div>
  )
}

export function Problem({ error, onRetry }) {
  if (!error) return null
  return (
    <div className="db__problem" role="alert">
      <p>Couldn't finish: {error.message ?? String(error)}.</p>
      {onRetry && <button type="button" className="db__ghost" onClick={onRetry}>Try again</button>}
    </div>
  )
}

export function Steps({ items = [] }) {
  if (!items.length) return null
  return (
    <ol className="db__steps">
      {items.map((s, i) => (
        <li key={i}>
          <strong>{s.step}</strong>
          {s.why && <span>{s.why}</span>}
        </li>
      ))}
    </ol>
  )
}

export function Updated({ at, onRefresh, busy }) {
  if (!at) return null
  return (
    <p className="db__updated">
      Made {new Date(at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
      {onRefresh && (
        <button type="button" className="db__link" onClick={onRefresh} disabled={busy}>Refresh</button>
      )}
    </p>
  )
}
