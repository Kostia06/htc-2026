// Dates and small text helpers, matching RavenKit's RelativeTime and the iOS formatters.

export const parseDate = (iso) => {
  if (!iso) return null
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d
}

/** "just now", "5 min ago", "2 h ago", "3 d ago", then "7 Nov". */
export function relative(iso, now = Date.now()) {
  const date = parseDate(iso)
  if (!date) return null
  const seconds = Math.round((now - date.getTime()) / 1000)
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} h ago`
  if (seconds < 7 * 86400) return `${Math.floor(seconds / 86400)} d ago`
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

/** "Nov 5" */
export const shortDate = (date) => date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

/** "Mon" */
export const weekday = (iso) => parseDate(iso)?.toLocaleDateString(undefined, { weekday: 'short' }) ?? ''

/** "Friday, 7 Nov, 3:42 PM" */
export const fullDate = (iso) =>
  parseDate(iso)?.toLocaleString(undefined, { weekday: 'long', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) ?? ''

/** "Oct 2026" from "2026-10" */
export function monthLabel(month) {
  if (!month) return null
  const d = parseDate(`${month.slice(0, 7)}-01T12:00:00`)
  return d ? d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : null
}

export const capitalized = (text) => (text ? text.charAt(0).toUpperCase() + text.slice(1) : text)

/** Drops ElevenLabs expression tags like [laughs]; AudioTags.swift. */
export const withoutAudioTags = (text) =>
  text
    .replace(/\[[^\]]*\]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s+(?=[,.!?;:])/g, '')
    .trim()

export const sameText = (a = '', b = '') => a.localeCompare(b, undefined, { sensitivity: 'base' }) === 0

/** "yesterday", "2 days ago", "3 hours ago": the named relative phrase iOS uses for finished steps. */
export function namedRelative(iso, now = Date.now()) {
  const date = parseDate(iso)
  if (!date) return null
  const seconds = (date.getTime() - now) / 1000
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
  const units = [
    ['year', 31536000],
    ['month', 2592000],
    ['week', 604800],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ]
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit)
  }
  return rtf.format(0, 'second')
}
