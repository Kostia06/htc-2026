import { describe, expect, it } from 'vitest'
import { companiesOf, isLaunch, launchOf, postingTextOf, summaryOf, targetsOf } from './picker.js'

const postings = [{ id: 'p1', title: 'Analyst', company: 'ATB' }]
const companies = [{ slug: 'helcim', name: 'Helcim' }, { slug: 'atb', name: 'ATB' }]

describe('interview picker', () => {
  it('lists saved postings first, then target roles, without duplicates', () => {
    const targets = targetsOf({ postings, targetRoles: ['Designer', 'Designer', ''] })
    expect(targets.map((t) => t.key)).toEqual(['posting:p1', 'role:Designer'])
  })

  it('sends a posting by id, like the phone, and ignores a local company for it', () => {
    const [posting] = targetsOf({ postings })
    expect(launchOf({ target: posting, companySlug: 'helcim', difficulty: 'hard', length: 'full' })).toEqual({
      difficulty: 'hard',
      postingId: 'p1',
      role: 'Analyst',
    })
  })

  it('sends a role with the local company and a quick length', () => {
    const target = targetsOf({ targetRoles: ['Barista'] })[0]
    expect(launchOf({ target, companySlug: 'helcim', difficulty: 'easy', length: 'quick' })).toEqual({
      difficulty: 'easy',
      length: 'quick',
      role: 'Barista',
      companySlug: 'helcim',
    })
  })

  it('with nothing picked lets the server choose the role', () => {
    expect(launchOf()).toEqual({ difficulty: 'standard' })
    expect(launchOf({ difficulty: 'nonsense' })).toEqual({ difficulty: 'standard' })
  })

  it('says what the interview is for', () => {
    const [posting, role] = targetsOf({ postings, targetRoles: ['Designer'] })
    expect(summaryOf({ target: posting }, companies)).toBe('Analyst at ATB')
    expect(summaryOf({ target: role, companySlug: 'helcim' }, companies)).toBe('Designer at Helcim')
    expect(summaryOf({}, companies)).toBe('A general interview, or pick a job')
  })

  it('treats a picker choice as a launch but not a click event', () => {
    expect(isLaunch(launchOf())).toBe(true)
    expect(isLaunch({ type: 'click', target: {} })).toBe(false)
    expect(isLaunch(undefined)).toBe(false)
  })

  it('keeps only usable companies', () => {
    expect(companiesOf([{ slug: 'x' }, ...companies])).toEqual(companies)
  })
})

describe('real jobs near the person', () => {
  const jobs = [{ id: 'j1', title: 'Junior Developer', org: 'Helcim', where: 'Calgary', summary: 'Build APIs', url: 'https://example.com/j1' }, { id: '', title: 'x' }]

  it('lists nearby jobs after saved postings, dropping broken ones', () => {
    const targets = targetsOf({ postings, jobs })
    expect(targets.map((t) => t.key)).toEqual(['posting:p1', 'job:j1'])
    expect(targets[1]).toMatchObject({ kind: 'job', title: 'Junior Developer', company: 'Helcim' })
  })

  it('a job is never launched as it is: it becomes a posting first', () => {
    const [job] = targetsOf({ jobs })
    expect(launchOf({ target: job })).toEqual({ difficulty: 'standard' })
  })

  it('gives the posting import the job card when its page cannot be read', () => {
    expect(postingTextOf(jobs[0])).toBe('Junior Developer at Helcim\nLocation: Calgary\nBuild APIs')
  })
})
