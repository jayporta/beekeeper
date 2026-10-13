import { describe, expect, it } from 'vitest'
import { pickLanguage } from '../pickLanguage'

describe('pickLanguage', () => {
  it.each(['en', 'en-US', 'en-GB'])('keeps the supported language %s with its region', (tag) => {
    expect(pickLanguage(tag)).toBe(tag)
  })

  it.each(['de-DE', 'fr', 'zh-Hans-CN'])('falls back to English for unsupported %s', (tag) => {
    expect(pickLanguage(tag)).toBe('en')
  })

  it.each(['', 'C', 'en_US', 'not a tag'])(
    'falls back to English for the invalid tag %j',
    (tag) => {
      expect(pickLanguage(tag)).toBe('en')
    }
  )
})
