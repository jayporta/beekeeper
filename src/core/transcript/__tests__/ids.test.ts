import { describe, expect, it } from 'vitest'
import { toAgentId, toProjectDirName, toSessionId } from '../ids'

describe('toProjectDirName', () => {
  it('brands a non-empty folder name', () => {
    expect(toProjectDirName('-apps-beekeeper')).toBe('-apps-beekeeper')
  })

  it('throws on an empty folder name', () => {
    expect(() => toProjectDirName('')).toThrow()
  })
})

describe('toSessionId', () => {
  it('brands a non-empty filename stem', () => {
    expect(toSessionId('a1b2c3')).toBe('a1b2c3')
  })

  it('throws on an empty session id', () => {
    expect(() => toSessionId('')).toThrow()
  })
})

describe('toAgentId', () => {
  it('brands a non-hex agent id', () => {
    expect(toAgentId('atask8-review')).toBe('atask8-review')
  })

  it('throws on an empty agent id', () => {
    expect(() => toAgentId('')).toThrow()
  })
})
