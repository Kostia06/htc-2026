// SkillsDraft.swift: the skill list while someone edits it, sent as one patch on Done.
// Untouched skills keep their source and evidence; a new skill or a new name is self-reported, because the
// resume quote backed the old wording, not whatever it's renamed to.
import { sameText } from '../../lib/format'

/** The server keeps at most this many skills and drops the rest silently, so the editor stops here instead. */
export const SKILL_LIMIT = 50

let nextId = 0
const row = (name, original) => ({ id: `skill-${nextId++}`, name, original })
const clean = (text) => (text ?? '').trim()

export const isUntouched = (r) => r.original?.name === r.name
export const sourceOf = (r) => (isUntouched(r) ? r.original.source : 'self-reported')
const skillOf = (r) => (isUntouched(r) ? r.original : { name: r.name, source: 'self-reported' })
const isListed = (rows, original) => rows.some((r) => r.original === original)

export const draftFrom = (skills) => ({ originals: skills, rows: skills.map((s) => row(s.name, s)) })
export const canAdd = (draft) => draft.rows.length < SKILL_LIMIT
export const contains = (draft, name, exceptId) => draft.rows.some((r) => r.id !== exceptId && sameText(r.name, name))
export const skillsOf = (draft) => draft.rows.map(skillOf)

/** The draft with the skill added, or null when it's blank or already listed. Re-adding a removed one restores it. */
export function addSkill(draft, text) {
  const name = clean(text)
  if (!canAdd(draft) || !name || contains(draft, name)) return null
  const removed = draft.originals.find((s) => sameText(s.name, name) && !isListed(draft.rows, s))
  return { ...draft, rows: [...draft.rows, row(removed?.name ?? name, removed)] }
}

/** The draft with the row renamed, or null when the name is blank, unchanged or taken by another row. */
export function renameSkill(draft, id, text) {
  const name = clean(text)
  const current = draft.rows.find((r) => r.id === id)
  if (!current || !name || name === current.name || contains(draft, name, id)) return null
  return { ...draft, rows: draft.rows.map((r) => (r.id === id ? { ...r, name } : r)) }
}

export const removeSkill = (draft, id) => ({ ...draft, rows: draft.rows.filter((r) => r.id !== id) })

/** Known skills not listed yet, narrowed by what's typed. Ones removed in this draft come first, to undo a slip. */
export function suggestions(draft, text, known, count = 6) {
  const query = clean(text).toLowerCase()
  const removed = draft.originals.filter((s) => !isListed(draft.rows, s)).map((s) => s.name)
  const seen = new Set()
  return [...removed, ...known]
    .filter((name) => !query || name.toLowerCase().includes(query))
    .filter((name) => !contains(draft, name) && !sameText(name, query) && !seen.has(name.toLowerCase()) && seen.add(name.toLowerCase()))
    .slice(0, count)
}

/** The one patch that makes the server match, or null. The server removes before it adds, so a rename is both. */
export function skillsPatch(draft) {
  const kept = draft.rows.filter(isUntouched)
  const removed = draft.originals.filter((s) => !kept.some((r) => r.original === s)).map((s) => s.name)
  const added = draft.rows.filter((r) => !isUntouched(r)).map(skillOf)
  if (!removed.length && !added.length) return null
  return { ...(added.length ? { skills: added } : {}), ...(removed.length ? { remove: { skills: removed } } : {}) }
}
