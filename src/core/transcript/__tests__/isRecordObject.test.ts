import { describe, expect, it } from 'vitest'
import { isRecordObject } from '../isRecordObject'

describe('isRecordObject', () => {
  it('accepts a keyed object', () => {
    expect(isRecordObject({ type: 'assistant' })).toBe(true)
  })

  it('rejects null, which typeof reports as an object', () => {
    expect(isRecordObject(null)).toBe(false)
  })

  it('rejects an array', () => {
    expect(isRecordObject([{ type: 'assistant' }])).toBe(false)
  })

  it('rejects a primitive', () => {
    expect(isRecordObject('assistant')).toBe(false)
  })
})
