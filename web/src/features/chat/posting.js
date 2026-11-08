// PostingDetection in SkillitKit/Postings.swift: a pasted job link (or a pasted ad) in the update chat is imported
// as a posting instead of read as an update.
const LONG_TEXT = 600
const SHORT_TEXT = 250
const POSTING_WORDS = ['requirements', 'qualifications', 'responsibilities', "what you'll do", 'what you will do', 'about the role', 'job description']

function link(text) {
  if (/\s/.test(text)) return null
  try {
    const url = new URL(text)
    return ['http:', 'https:'].includes(url.protocol) && url.host ? url.href : null
  } catch {
    return null
  }
}

/** { url } or { text } for POST /api/postings, or null for an ordinary update. */
export function detectPosting(message) {
  const trimmed = message.trim()
  const url = link(trimmed)
  if (url) return { url }
  if (trimmed.length >= LONG_TEXT) return { text: trimmed }
  const lower = trimmed.toLowerCase()
  if (trimmed.length >= SHORT_TEXT && POSTING_WORDS.some((w) => lower.includes(w))) return { text: trimmed }
  return null
}

/** Skillit's line for an imported posting, like QuickUpdateModel.handle(_: JobPosting). */
export function postingReply(posting) {
  const requirements = posting.requirements ?? []
  const have = requirements.filter((r) => r.have).length
  const line = requirements.length ? `${have} of ${requirements.length} requirements` : 'No requirements listed'
  return `Got it: ${posting.title} at ${posting.company}. You have ${line}.`
}

/** PostingPrefill.appliedChanges: what the import set up, typed like a quick update's changes. */
export function postingChanges(posting) {
  const { targetRole, company, steps = [] } = posting.prefilled ?? {}
  const changes = []
  if (targetRole) changes.push({ type: 'add_target_role', summary: `Added target role ${targetRole}` })
  if (company) changes.push({ type: 'add_company', summary: company.researchQueued ? `Researching ${company.name}` : `Added ${company.name}` })
  for (const step of steps) changes.push({ type: 'add_step', summary: `Added step "${step}"` })
  return changes
}
