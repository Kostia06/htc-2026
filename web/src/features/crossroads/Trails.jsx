// "Paths that worked": each road that ended in a job as a mini trail of step kinds, in the order people took them.
import { KINDS } from '../roadmap/page'
import { peopleLabel } from './links'
import './trails.css'

const kindOf = (kind) => KINDS[kind] ?? KINDS.project

function MiniTrail({ trail, cited }) {
  const names = trail.steps.map((s) => kindOf(s).name)
  return (
    <li className={`xr-trail card${cited.has(trail.id) ? ' is-cited' : ''}`}>
      <p className="t-subhead semibold">{trail.role}</p>
      <p className="t-caption c-2">
        {trail.example ? <span className="xr-tag">Example</span> : peopleLabel(trail.people)}
      </p>
      <ol className="xr-trail__steps" aria-label={`Steps: ${names.join(', then ')}`}>
        {trail.steps.map((step, i) => {
          const { icon: Icon, name } = kindOf(step)
          return (
            // the same step kind can come twice in one trail, so the position is part of the key
            <li key={`${step}-${i}`} className="xr-trail__node" title={name}>
              <Icon size={15} strokeWidth={2.2} aria-hidden />
            </li>
          )
        })}
      </ol>
      {trail.skills.length > 0 && <p className="t-caption c-2 xr-trail__skills">{trail.skills.join(' · ')}</p>}
    </li>
  )
}

export function Trails({ trails, badges, cited }) {
  if (trails.length === 0) return null
  return (
    <section className="xr-trails" aria-labelledby="xr-trails">
      <h2 id="xr-trails" className="t-title3">Paths that worked</h2>
      {badges.length > 0 && (
        <p className="t-footnote c-positive">
          {badges
            .slice(0, 3)
            .map((b) => `${kindOf(b.kind).name}: taken by ${peopleLabel(b.people)} who reached ${b.reached}`)
            .join(' · ')}
        </p>
      )}
      <ul className="xr-trails__strip">
        {trails.map((trail) => (
          <MiniTrail key={trail.id} trail={trail} cited={cited} />
        ))}
      </ul>
    </section>
  )
}
