// Example questions only. Everything here is isSeeded: true and the panels render
// an EXAMPLE badge for it — the privacy rules forbid presenting seeded rows as
// real reports. The live API marks real ones with `reported: true` instead, and
// createApiSession maps that across.
export const EXAMPLE_QUESTIONS = [
  {
    id: 'q1',
    text: 'Walk me through a project where you had to learn a new technology under a deadline.',
    isSeeded: true,
  },
  {
    id: 'q2',
    text: 'Tell me about a time you disagreed with a teammate. How did you resolve it?',
    isSeeded: true,
  },
  {
    id: 'q3',
    text: 'Describe a bug you could not reproduce. What did you do about it?',
    isSeeded: true,
  },
  {
    id: 'q4',
    text: 'Why this company, and why this role specifically?',
    isSeeded: true,
  },
]

// Shaped exactly like the Worker's AnswerScore so the panels never need to change.
export const EXAMPLE_SCORES = {
  q1: {
    structure: 4,
    clarity: 4,
    confidence: 3,
    relevance: 4,
    fillerWords: 7,
    wpm: 148,
    strongerAnswer:
      'I had four days to ship a payments integration in a language I had not used. I spent the first morning reading the reference implementation, built a throwaway prototype by noon, then rewrote it with tests. It shipped on day three and handled about twelve hundred transactions in its first week with no rollbacks.',
    tip: 'You named the technology but the result stayed vague. Close with one number.',
    transcript: '',
  },
  q2: {
    structure: 3,
    clarity: 4,
    confidence: 3,
    relevance: 3,
    fillerWords: 12,
    wpm: 171,
    strongerAnswer:
      'We disagreed on whether to rewrite the sync layer. I thought we should; she thought it was premature. We agreed to measure first, found the real cost was in one query, and fixed that in an afternoon instead of spending two weeks rewriting. I was wrong, and the measurement settled it.',
    tip: 'You described the disagreement but not the resolution. Say what changed your mind.',
    transcript: '',
  },
}

export const DEFAULT_SCORE = {
  structure: 4,
  clarity: 4,
  confidence: 3,
  relevance: 4,
  fillerWords: 9,
  wpm: 156,
  strongerAnswer:
    'Lead with the situation in one sentence, spend most of the answer on what you personally did, and close with a measurable outcome.',
  tip: 'Cut the preamble and get to your own actions faster.',
  transcript: '',
}
