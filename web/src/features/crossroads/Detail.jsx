// Everything behind one Crossroads card, matching CrossroadsDetailSheet.swift: the full text, why it's shown, how many
// people, the source, and the card's one action. The line is passed in live, so "Me too" and "Add" update in place.
import { Check, ExternalLink, Hand, Plus } from 'lucide-react'
import { safeUrl } from '../../lib/client'
import { RaisedButton } from '../../ui/Button'
import { Sheet } from '../../ui/Sheet'
import { ExampleTag } from './Cards'
import { KIND_LABELS, ageLabel, isAddable, matchLine } from './links'

function Fact({ label, value }) {
  return (
    <div className="xr-detail__fact">
      <p className="t-caption c-2">{label}</p>
      <p className="t-subhead semibold">{value}</p>
    </div>
  )
}

function Why({ reasons }) {
  return (
    <section className="xr-detail__why">
      <h3 className="t-headline">Why you’re seeing this</h3>
      <ul>
        {reasons.filter(Boolean).map((r) => (
          <li key={r} className="t-subhead c-2">
            {r}
          </li>
        ))}
      </ul>
    </section>
  )
}

function lineReasons(line, match, goal, minPeople) {
  return [
    match && `It ${matchLine(match)}.`,
    line.example
      ? `Skillit wrote this example for the road to ${goal} until people share their own.`
      : `People heading to ${goal} shared this when they landed, or while they were on the way.`,
    !line.people && `Counts show once ${minPeople} people have said the same, so nobody can be singled out.`,
  ]
}

export function CrossroadsDetail({ detail, goal, minPeople, onRoad, onMeToo, onAdd, onClose }) {
  const { type, other, match } = detail
  if (type === 'fact') {
    const url = safeUrl(other.sourceUrl)
    return (
      <Sheet
        onClose={onClose}
        label={other.company}
        footer={
          url && (
            <RaisedButton icon={ExternalLink} onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}>
              Open the source
            </RaisedButton>
          )
        }
      >
        <div className="xr-detail">
          <p className="t-subhead semibold c-2">{other.company}</p>
          <p className="t-title3">{other.text}</p>
          <div className="xr-detail__facts">
            <Fact label="Researched" value={ageLabel(other.ageDays)} />
            <Fact label="Source" value={other.sourceHost} />
          </div>
          <Why
            reasons={[
              match && `It ${matchLine(match)}.`,
              `${other.company} is an employer on your road to ${goal}; Skillit read this from a public source ${ageLabel(other.ageDays)}.`,
            ]}
          />
        </div>
      </Sheet>
    )
  }

  const line = other
  const addable = isAddable(line)
  const footer = addable ? (
    <RaisedButton icon={onRoad ? Check : Plus} disabled={onRoad} onClick={() => onAdd(line)}>
      {onRoad ? 'On your road' : 'Add to my road'}
    </RaisedButton>
  ) : (
    <RaisedButton icon={line.meToo ? Check : Hand} onClick={() => onMeToo(line)} aria-pressed={line.meToo}>
      {line.meToo ? 'You said me too' : 'That’s me too'}
    </RaisedButton>
  )
  return (
    <Sheet onClose={onClose} label={KIND_LABELS[line.kind] ?? line.kind} footer={footer}>
      <div className="xr-detail">
        <p className={`t-subhead semibold xr-card__kind xr-kind--${line.kind}`}>
          {KIND_LABELS[line.kind] ?? line.kind}
          {line.example && <ExampleTag />}
        </p>
        <p className="t-title3">{line.text}</p>
        <div className="xr-detail__facts">
          <Fact label="People" value={line.people ? String(line.people) : `Fewer than ${minPeople}`} />
          <Fact label="From" value={line.example ? 'Skillit example' : 'People on your road'} />
        </div>
        <Why reasons={lineReasons(line, match, goal, minPeople)} />
      </div>
    </Sheet>
  )
}
