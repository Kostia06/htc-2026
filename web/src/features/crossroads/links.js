// Turning the Crossroads payload into what the page says: matches, why each item is shown, and the path insight.

/** Every link to a line or fact still on the page, strongest first (links arrive sorted), as { you, other, type }. */
export function matchesOf(data) {
  const yours = new Map(data.you.map((y) => [y.id, y]))
  const lines = new Map(data.everyone.map((l) => [l.id, l]))
  const facts = new Map(data.research.map((f) => [f.id, f]))
  return data.links.flatMap((link) => {
    const you = yours.get(link.you)
    if (!you) return []
    if (lines.has(link.everyone)) return [{ id: `${you.id}>${link.everyone}`, you, other: lines.get(link.everyone), type: 'line' }]
    if (facts.has(link.everyone)) return [{ id: `${you.id}>${link.everyone}`, you, other: facts.get(link.everyone), type: 'fact' }]
    return []
  })
}

/** Things on either side that match nothing, so the page never shows the same item twice. */
export function unlinked(data) {
  const linkedYou = new Set(data.links.map((l) => l.you))
  const linkedOther = new Set(data.links.map((l) => l.everyone))
  return {
    yours: data.you.filter((y) => !linkedYou.has(y.id)),
    lines: data.everyone.filter((l) => !linkedOther.has(l.id)),
    facts: data.research.filter((f) => !linkedOther.has(f.id)),
  }
}

const NOUNS = { goal: 'goal', skill: 'skill', weakness: 'struggle', preference: 'preference', note: 'note' }

/** "matches your struggle “Froze on SQL joins…”", short enough for one line under a card. */
export function matchLine(item) {
  const words = item.text.split(/\s+/)
  const short = words.length > 5 ? `${words.slice(0, 5).join(' ')}…` : item.text
  return `matches your ${NOUNS[item.kind] ?? 'note'} “${short}”`
}

const COUNTS = {
  struggle: (n) => `${n} people hit this`,
  tip: (n) => `${n} people say it worked`,
  interview: (n) => `${n} people were asked this`,
  win: (n) => `${n} people got in this way`,
}

/** Why a line is on the page: a real count, and what of the person's it matches. Examples never read as people. */
export function lineReason(line, match) {
  let count = null
  if (line.people) count = line.example ? `${line.people} said me too` : (COUNTS[line.kind] ?? COUNTS.tip)(line.people)
  return [count, match && matchLine(match)].filter(Boolean).join(' · ')
}

export const factReason = (fact, match) => [`Researched ${ageLabel(fact.ageDays)}`, match && matchLine(match)].filter(Boolean).join(' · ')

/** Lived things get "That's me too"; things to do get "Add to my road". */
export const isAddable = (line) => line.kind === 'tip' || line.kind === 'interview'

/** The path from the first trail (the server ranks the person's own role first) and how much of it they've done. */
export function pathInsight(data) {
  const trail = data.trails[0]
  if (!trail) return null
  const steps = [...new Set(trail.steps.filter((s) => s !== 'explore_memory'))]
  if (steps.length === 0) return null
  const done = new Set((data.yourRoad?.done ?? []).filter((k) => steps.includes(k)))
  return { id: trail.id, role: trail.role, people: trail.example ? null : trail.people, steps, done, next: steps.find((s) => !done.has(s)) }
}

/** A fact's age as people say it; the server sends whole days. */
export function ageLabel(days) {
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days} days ago`
  const months = Math.round(days / 30)
  return months <= 1 ? 'a month ago' : `${months} months ago`
}

export const KIND_LABELS = {
  goal: 'Goal',
  skill: 'Skill',
  weakness: 'Working on',
  preference: 'Preference',
  note: 'Note',
  struggle: 'Common struggle',
  tip: 'What worked',
  interview: 'Asked in interviews',
  win: 'Way in',
}
