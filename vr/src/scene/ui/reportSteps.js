import { paginate } from '../../theme/layout.js'

// three, not four: tips wrap, and the card must stay between his chin and the desk
export const TIPS_PER_PAGE = 3

/**
 * The end-of-interview report one step at a time instead of one tall card:
 * the score, then the top tips (three to a page), then the moments to replay.
 * A report that isn't scored is a single notice step.
 */
export function reportSteps(summary, { hasMoments = false } = {}) {
  if (!summary || (summary.status && summary.status !== 'scored')) return [{ kind: 'notice' }]
  const pages = paginate(summary.nextSteps ?? [], TIPS_PER_PAGE)
  return [
    { kind: 'score' },
    ...pages.map((items, page) => ({ kind: 'tips', items, page, pages: pages.length })),
    ...(hasMoments ? [{ kind: 'moments' }] : []),
  ]
}

/** What the forward key on a step says. */
export function nextLabel(steps, index) {
  const next = steps[index + 1]
  if (!next) return 'Practice again'
  if (next.kind === 'tips') return steps[index].kind === 'tips' ? 'More tips' : 'Top tips'
  return 'Moments'
}
