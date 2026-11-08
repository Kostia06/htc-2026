// ProfileNextMove.swift: the one thing the Profile page suggests next. Earlier rules win: without a target role
// nothing else can be judged, and a resume missing what a job asks for costs more than an unproven skill.

/** The tailored resume covering the smallest share of its posting; ties go to the newest (the list is newest first). */
export function weakestTailored(items) {
  let weakest = null
  for (const item of items) {
    if (!(item.total > 0 && item.covered < item.total)) continue
    if (!weakest || item.covered / item.total < weakest.covered / weakest.total) weakest = item
  }
  return weakest
}

/** { type, ... } or null when nothing is worth suggesting. */
export function pickNextMove({ profile, tailored, postings, missingTopic }) {
  if (!profile.targetRoles.length) return { type: 'chooseRole' }
  const weakest = weakestTailored(tailored)
  if (weakest) return { type: 'closeGap', tailoredId: weakest.id, company: weakest.company, topic: missingTopic ?? null }
  const tailoredPostings = new Set(tailored.map((t) => t.postingId))
  const posting = postings.find((p) => !tailoredPostings.has(p.id))
  if (posting) return { type: 'tailor', postingId: posting.id, company: posting.company }
  if (!profile.experience.length) return { type: 'addExperience' }
  const unproven = profile.skills.find((s) => !s.evidence)
  if (unproven) return { type: 'backUpSkill', skill: unproven.name }
  return null
}

/** What the card says and where its button goes. */
export function describeMove(move) {
  switch (move.type) {
    case 'chooseRole':
      return { title: "Pick the role you're aiming for", detail: 'Your road, resume and practice are all measured against it.', button: 'Choose a role', to: '/profile/details' }
    case 'closeGap':
      return {
        title: move.topic ? `Your ${move.company} resume is missing ${move.topic} evidence` : `Your ${move.company} resume misses some of what they ask for`,
        detail: move.topic ? "Accept Skillit's changes or add a line that shows it, before you apply." : "See what's missing and close the gap before you apply.",
        button: 'Close the gap',
        to: `/resume/tailored/${move.tailoredId}`,
      }
    case 'tailor':
      return { title: `Tailor your resume for ${move.company}`, detail: 'You saved their posting. A tailored copy shows what they asked for.', button: 'Tailor it', to: '/resume/tailor' }
    case 'addExperience':
      return { title: "Add where you've worked", detail: 'Jobs, internships and volunteering all count as evidence.', button: 'Add experience', to: '/profile/details/experience/new' }
    default:
      return { title: `Back up ${move.skill} with proof`, detail: 'One line on where you used it: a project, a job, a course.', button: 'Add proof', to: '/profile/details/skills' }
  }
}
