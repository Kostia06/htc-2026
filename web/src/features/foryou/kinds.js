import { BookOpen, Briefcase, Trophy, Users } from 'lucide-react'
import { capitalized, parseDate, shortDate } from '../../lib/format'

export const SECTIONS = [
  { id: 'all', title: 'For you' },
  { id: 'jobs', title: 'Jobs' },
  { id: 'events', title: 'Events' },
  { id: 'hackathons', title: 'Hackathons' },
  { id: 'courses', title: 'Courses' },
  { id: 'saved', title: 'Saved' },
]

// FeedKind+Style.swift: a glyph and a tint per kind; an unknown kind shows as an event
export const FEED_KINDS = {
  job: { icon: Briefcase, tint: 'var(--kind-job)', name: 'Job', cta: 'Apply on website' },
  hackathon: { icon: Trophy, tint: 'var(--kind-hackathon)', name: 'Hackathon', cta: 'Register on website' },
  course: { icon: BookOpen, tint: 'var(--kind-course)', name: 'Course', cta: 'Open course' },
  event: { icon: Users, tint: 'var(--kind-event)', name: 'Event', cta: 'Register on website' },
}
export const feedKind = (card) => FEED_KINDS[card.kind] ?? FEED_KINDS.event

/** A full timestamp or a day-only date; a label such as "ongoing" has no date. */
export function cardDate(card) {
  if (!card.when) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(card.when)) return parseDate(`${card.when}T12:00:00`)
  return /^\d{4}-\d{2}-\d{2}T/.test(card.when) ? parseDate(card.when) : null
}

/** "Posted Nov 5" for jobs, "Jan 26" for the rest, or the source's own label like "Ongoing". */
export function whenText(card) {
  const date = cardDate(card)
  if (date) return card.kind === 'job' ? `Posted ${shortDate(date)}` : shortDate(date)
  return card.when ? capitalized(card.when) : null
}
