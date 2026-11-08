// The overlaps between the person's lane and everyone's, as lookups the lanes can ask cheaply on every hover.

/** id -> ids it overlaps with, in both directions, so either side can light up the other */
export function partnerMap(links) {
  const map = new Map()
  const add = (a, b) => map.set(a, [...(map.get(a) ?? []), b])
  for (const link of links) {
    add(link.you, link.everyone)
    add(link.everyone, link.you)
  }
  return map
}

/** What lights up while `active` is hovered or focused: the item itself and everything it overlaps with. */
export function litIds(active, partners) {
  if (!active) return new Set()
  return new Set([active, ...(partners.get(active) ?? [])])
}

/** A fact's age as people say it; the server sends whole days. */
export function ageLabel(days) {
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days} days ago`
  const months = Math.round(days / 30)
  return months <= 1 ? 'a month ago' : `${months} months ago`
}

/** "7 people" for a real count; examples never get one. */
export const peopleLabel = (people) => (people === 1 ? '1 person' : `${people} people`)

export const KIND_LABELS = {
  goal: 'Goal',
  skill: 'Skill',
  weakness: 'Working on',
  preference: 'Preference',
  note: 'Note',
  struggle: 'Common struggle',
  tip: 'What helped',
  interview: 'Interview question',
  win: 'How it ended',
}
