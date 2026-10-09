import { describe, expect, it } from 'vitest'
import { lastActivityMs } from '../lastActivityMs'

describe('lastActivityMs', () => {
  it('is the later of the latest message and the modification time', () => {
    expect(lastActivityMs({ activityLatestMs: 5_000, modifiedMs: 9_000 })).toBe(9_000)
    expect(lastActivityMs({ activityLatestMs: 9_000, modifiedMs: 5_000 })).toBe(9_000)
  })

  it('is the modification time when no message has a timestamp', () => {
    expect(lastActivityMs({ activityLatestMs: null, modifiedMs: 5_000 })).toBe(5_000)
  })

  it('is the latest message when the modification time is unknown', () => {
    expect(lastActivityMs({ activityLatestMs: 5_000, modifiedMs: null })).toBe(5_000)
  })

  it('is null when both are unknown', () => {
    expect(lastActivityMs({ activityLatestMs: null, modifiedMs: null })).toBeNull()
  })
})
