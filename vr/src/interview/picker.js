// "Interview for": the phone's target picker, as plain data for the VR menu.
// A target is a saved posting or a target role. Only a role has no employer,
// so only a role (or nothing picked) can take a local company. The request is
// the one the phone's InterviewTarget.request(difficulty:at:) builds.

export const DIFFICULTIES = ['easy', 'standard', 'hard']
export const LENGTHS = ['quick', 'full']

const MAX_POSTINGS = 3
const MAX_ROLES = 4
const MAX_COMPANIES = 6

export function targetsOf({ postings = [], targetRoles = [] } = {}) {
  const fromPostings = postings
    .filter((p) => p?.id && p?.title)
    .slice(0, MAX_POSTINGS)
    .map((p) => ({ kind: 'posting', key: `posting:${p.id}`, id: p.id, title: p.title, company: p.company ?? null }))
  const fromRoles = [...new Set(targetRoles.filter((r) => typeof r === 'string' && r.trim()))]
    .slice(0, MAX_ROLES)
    .map((role) => ({ kind: 'role', key: `role:${role}`, title: role }))
  return [...fromPostings, ...fromRoles]
}

export const companiesOf = (companies = []) => companies.filter((c) => c?.slug && c?.name).slice(0, MAX_COMPANIES)

export const canAddCompany = (target) => !target || target.kind === 'role'

/** The POST /api/voice/sessions fields for a choice; session.js adds mode. */
export function launchOf({ target = null, companySlug = null, difficulty = 'standard', length = 'full' } = {}) {
  const launch = { difficulty: DIFFICULTIES.includes(difficulty) ? difficulty : 'standard' }
  // a full interview is the server's default, so like the phone only quick is sent
  if (length === 'quick') launch.length = 'quick'
  if (target?.kind === 'posting') {
    launch.postingId = target.id
    // the server takes the role from the posting; this only labels the session here
    launch.role = target.title
  } else if (target?.kind === 'role') {
    launch.role = target.title
  }
  if (canAddCompany(target) && companySlug) launch.companySlug = companySlug
  return launch
}

/** The one line that says what the interview is for. */
export function summaryOf({ target = null, companySlug = null } = {}, companies = []) {
  if (!target) return 'Pick a role or posting'
  if (target.kind === 'posting') return target.company ? `${target.title} at ${target.company}` : target.title
  const company = companySlug && companies.find((c) => c.slug === companySlug)
  return company ? `${target.title} at ${company.name}` : target.title
}

// Begin, the keyboard and the phone all call begin(); only a real choice is a
// launch, never a click or key event that happened to be passed along.
const LAUNCH_KEYS = ['mode', 'length', 'role', 'postingId', 'companySlug', 'difficulty', 'stepId']
export const isLaunch = (value) => Boolean(value) && typeof value === 'object' && LAUNCH_KEYS.some((key) => typeof value[key] === 'string' && value[key])
