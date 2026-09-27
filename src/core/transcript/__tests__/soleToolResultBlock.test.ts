import { describe, expect, it } from 'vitest'
import { parseSoleToolResultBlock } from '../soleToolResultBlock'

const block = (id: string): Record<string, unknown> => ({ type: 'tool_result', tool_use_id: id })

describe('parseSoleToolResultBlock', () => {
  it('returns the one tool_result block', () => {
    expect(parseSoleToolResultBlock([{ type: 'text' }, block('a')])?.tool_use_id).toBe('a')
  })

  it('returns null when there is none', () => {
    expect(parseSoleToolResultBlock([{ type: 'text' }, 'x', null])).toBeNull()
  })

  it('returns null when there is more than one', () => {
    expect(parseSoleToolResultBlock([block('a'), block('b')])).toBeNull()
  })
})
