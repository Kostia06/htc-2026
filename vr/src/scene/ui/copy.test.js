import { describe, expect, it } from 'vitest'
import { companyName, practiceLine } from './copy.js'

describe('practice line', () => {
  it('names the role and company', () => {
    expect(practiceLine({ role: 'Product Designer', company: 'Shopify' })).toBe('Product Designer at Shopify')
  })

  it('turns a slug into a name and leaves real names alone', () => {
    expect(companyName('arc-teryx')).toBe('Arc Teryx')
    expect(companyName('Example Co.')).toBe('Example Co.')
    expect(companyName('  ')).toBe('')
  })

  it('falls back when the phone sent nothing', () => {
    expect(practiceLine(null)).toBe('')
    expect(practiceLine({ role: 'Developer' })).toBe('Developer')
  })
})
