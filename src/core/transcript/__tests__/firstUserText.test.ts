import { describe, expect, it } from 'vitest'
import { firstUserText } from '../firstUserText'
import { buildTextBlock, buildUserRecord } from '../testFixtures'

const withContent = (content: unknown): Record<string, unknown> => buildUserRecord({ content })

describe('firstUserText', () => {
  it('returns string content as is', () => {
    expect(firstUserText(withContent('hello'))).toBe('hello')
  })

  it('returns the text of the first text block', () => {
    expect(firstUserText(withContent([buildTextBlock('a'), buildTextBlock('b')]))).toBe('a')
  })

  it('skips blocks that are not text blocks to reach the first text block', () => {
    expect(firstUserText(withContent([{ type: 'image' }, null, buildTextBlock('a')]))).toBe('a')
  })

  it('returns null when the first text block has no string text, without scanning further', () => {
    expect(firstUserText(withContent([{ type: 'text' }, buildTextBlock('later')]))).toBeNull()
    expect(
      firstUserText(withContent([{ type: 'text', text: 5 }, buildTextBlock('later')]))
    ).toBeNull()
  })

  it('returns null for no content, empty blocks, or a missing message', () => {
    expect(firstUserText(withContent(null))).toBeNull()
    expect(firstUserText(withContent([]))).toBeNull()
    expect(firstUserText({ type: 'user' })).toBeNull()
  })
})
