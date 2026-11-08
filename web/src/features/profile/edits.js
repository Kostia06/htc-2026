// ProfileEdit.swift: each change is applied to the local copy first and sent to the server as the same patch.
// Lists are merged in on the server; `remove` takes entries out first. Returns [profile, patch] or null.
import { sameText } from '../../lib/format'

const clean = (text) => {
  const t = (text ?? '').trim()
  return t || undefined
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)

const cleanExperience = (e) => {
  const role = clean(e.role)
  const org = clean(e.org)
  if (!role || !org) return null
  return { role, org, start: clean(e.start), end: clean(e.end), ...(e.highlights ? { highlights: e.highlights } : {}) }
}

const cleanEducation = (e) => {
  const school = clean(e.school)
  if (!school) return null
  return { school, program: clean(e.program), year: clean(e.year), expectedGraduation: clean(e.expectedGraduation) }
}

/** Edits keep their place in the list, so a row doesn't jump to the bottom when someone fixes a typo. */
function save(profile, key, row, old) {
  if (!row || (old && same(row, old))) return null
  const rows = [...profile[key]]
  const index = old ? rows.findIndex((r) => same(r, old)) : -1
  if (index >= 0) rows[index] = row
  else rows.push(row)
  return [{ ...profile, [key]: rows }, { [key]: [row], ...(old ? { remove: { [key]: [old] } } : {}) }]
}

export function applyEdit(profile, edit) {
  switch (edit.type) {
    case 'headline': {
      const text = clean(edit.text)
      if (!text || text === profile.headline) return null
      return [{ ...profile, headline: text }, { headline: text }]
    }
    case 'addRole': {
      const text = clean(edit.text)
      if (!text || profile.targetRoles.some((r) => sameText(r, text))) return null
      return [{ ...profile, targetRoles: [...profile.targetRoles, text] }, { targetRoles: [text] }]
    }
    case 'removeRole':
      if (!profile.targetRoles.some((r) => sameText(r, edit.text))) return null
      return [{ ...profile, targetRoles: profile.targetRoles.filter((r) => !sameText(r, edit.text)) }, { remove: { targetRoles: [edit.text] } }]
    case 'addSkill': {
      const text = clean(edit.text)
      if (!text || profile.skills.some((s) => sameText(s.name, text))) return null
      const skill = { name: text, source: 'self-reported' }
      return [{ ...profile, skills: [...profile.skills, skill] }, { skills: [skill] }]
    }
    case 'removeSkill':
      if (!profile.skills.some((s) => sameText(s.name, edit.name))) return null
      return [{ ...profile, skills: profile.skills.filter((s) => !sameText(s.name, edit.name)) }, { remove: { skills: [edit.name] } }]
    case 'saveExperience':
      return save(profile, 'experience', cleanExperience(edit.row), edit.old)
    case 'removeExperience':
      return [{ ...profile, experience: profile.experience.filter((r) => !same(r, edit.row)) }, { remove: { experience: [edit.row] } }]
    case 'saveEducation':
      return save(profile, 'education', cleanEducation(edit.row), edit.old)
    case 'removeEducation':
      return [{ ...profile, education: profile.education.filter((r) => !same(r, edit.row)) }, { remove: { education: [edit.row] } }]
    default:
      return null
  }
}
