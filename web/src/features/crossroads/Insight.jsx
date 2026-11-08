// The top of Crossroads: a first-visit explainer, and the one insight (the usual path and how much of it is done).
import { ArrowRightCircle, Check, Hand, Lock, Users, X } from 'lucide-react'
import { KINDS } from '../roadmap/page'
import { ExampleTag } from './Cards'

const kindOf = (kind) => KINDS[kind] ?? KINDS.project

const STEPS = [
  { icon: Lock, title: 'Your notes stay private', detail: 'What you practise and finish is saved for you only.' },
  { icon: Users, title: 'We match them to people like you', detail: (goal) => `Others heading to ${goal} shared what happened.` },
  { icon: Hand, title: 'Act on what fits', detail: 'Say “That’s me too”, add a tip to your road, or ask below.' },
]

export function Explainer({ goal, onDismiss }) {
  return (
    <section className="xr-explainer" aria-labelledby="xr-explainer">
      <div className="xr-explainer__head">
        <h2 id="xr-explainer" className="t-headline">How Crossroads works</h2>
        <button type="button" className="xr-close" onClick={onDismiss} aria-label="Dismiss">
          <X size={18} strokeWidth={2.4} aria-hidden />
        </button>
      </div>
      <ol className="xr-explainer__steps">
        {STEPS.map(({ icon: Icon, title, detail }) => (
          <li key={title}>
            <span className="xr-explainer__icon" aria-hidden>
              <Icon size={16} strokeWidth={2.4} />
            </span>
            <span>
              <span className="t-subhead semibold xr-block">{title}</span>
              <span className="t-footnote c-2">{typeof detail === 'function' ? detail(goal) : detail}</span>
            </span>
          </li>
        ))}
      </ol>
      <button type="button" className="glass-prominent xr-gotit" onClick={onDismiss}>
        Got it
      </button>
    </section>
  )
}

export function PathInsight({ insight, otherRoles, cited }) {
  const lead = insight.people ? `${insight.people} people who got ${insight.role} took this path` : `A typical path to ${insight.role}`
  return (
    <section className={`xr-insight${cited ? ' is-cited' : ''}`} aria-label="Your progress on the usual path">
      <p className="t-subhead c-2 xr-insight__lead">
        {lead}
        {insight.people === null && <ExampleTag />}
      </p>
      <p className="t-title2 bold">
        You’ve done {insight.done.size} of {insight.steps.length}
      </p>
      <ol className="xr-path" aria-label="Steps on this path">
        {insight.steps.map((step) => {
          const { icon: Icon, name } = kindOf(step)
          const done = insight.done.has(step)
          return (
            <li key={step} className={`xr-path__step${done ? ' is-done' : ''}`}>
              {done ? <Check size={14} strokeWidth={2.8} aria-hidden /> : <Icon size={14} strokeWidth={2.2} aria-hidden />}
              {name}
              {done && <span className="xr-sr">, done</span>}
            </li>
          )
        })}
      </ol>
      {insight.next && (
        <p className="t-subhead semibold c-action xr-next">
          <ArrowRightCircle size={18} aria-hidden /> Next on this path: {kindOf(insight.next).name}
        </p>
      )}
      {otherRoles.length > 0 && <p className="t-footnote c-2">Also worked: {otherRoles.join(', ')}</p>}
    </section>
  )
}
