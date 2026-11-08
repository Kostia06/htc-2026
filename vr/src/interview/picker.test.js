import { describe, expect, it } from 'vitest'
import { companiesOf, isLaunch, launchOf, summaryOf, targetsOf } from './picker.js'

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
    expect(summaryOf({}, companies)).toBe('Pick a role or posting')
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
