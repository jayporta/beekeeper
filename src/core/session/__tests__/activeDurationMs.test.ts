import { describe, expect, it } from 'vitest'
import { ACTIVE_GAP_CUTOFF_MS, activeDurationMs } from '../activeDurationMs'

const SECOND = 1000
const MINUTE = 60 * SECOND

/** A message that started and ended at the given offsets, in milliseconds. */
function message(
  earliestMs: number,
  latestMs: number = earliestMs
): { earliestMs: number; latestMs: number } {
  return { earliestMs, latestMs }
}

describe('activeDurationMs', () => {
  it('is zero when there are no entries', () => {
    expect(activeDurationMs([])).toBe(0)
  })

  it('is zero when no entry has a timestamp', () => {
    expect(
      activeDurationMs([
        { earliestMs: null, latestMs: null },
        { earliestMs: null, latestMs: null }
      ])
    ).toBe(0)
  })

  it('counts a single entry as its own span', () => {
    expect(activeDurationMs([message(1000, 4000)])).toBe(3000)
  })

  it('counts a gap under the cutoff', () => {
    expect(activeDurationMs([message(0), message(5 * MINUTE)])).toBe(5 * MINUTE)
  })

  it('leaves out a gap over the cutoff', () => {
    expect(activeDurationMs([message(0), message(ACTIVE_GAP_CUTOFF_MS + 1)])).toBe(0)
  })

  it('counts a gap exactly at the cutoff', () => {
    expect(activeDurationMs([message(0), message(ACTIVE_GAP_CUTOFF_MS)])).toBe(ACTIVE_GAP_CUTOFF_MS)
  })

  it('adds the entries around an idle stretch without the stretch', () => {
    const entries = [
      message(0, 2 * SECOND),
      message(5 * SECOND, 6 * SECOND),
      message(2 * 60 * MINUTE, 2 * 60 * MINUTE + 4 * SECOND)
    ]

    expect(activeDurationMs(entries)).toBe(2 * SECOND + 3 * SECOND + 1 * SECOND + 4 * SECOND)
  })

  it('orders entries by start time rather than by position', () => {
    const entries = [message(10 * SECOND), message(0), message(4 * SECOND)]

    expect(activeDurationMs(entries)).toBe(10 * SECOND)
  })

  it('does not count overlapping entries twice', () => {
    expect(activeDurationMs([message(0, 10 * SECOND), message(4 * SECOND, 6 * SECOND)])).toBe(
      10 * SECOND
    )
  })

  it('counts only the part of an overlapping entry past the earlier one', () => {
    expect(activeDurationMs([message(0, 10 * SECOND), message(4 * SECOND, 15 * SECOND)])).toBe(
      15 * SECOND
    )
  })

  it('measures a gap from the latest end so far, not the previous entry', () => {
    const entries = [message(0, 30 * MINUTE), message(MINUTE, 2 * MINUTE), message(35 * MINUTE)]

    expect(activeDurationMs(entries)).toBe(35 * MINUTE)
  })

  it('skips entries without timestamps among those with them', () => {
    const entries = [message(0), { earliestMs: null, latestMs: null }, message(3 * SECOND)]

    expect(activeDurationMs(entries)).toBe(3 * SECOND)
  })
})

describe('ACTIVE_GAP_CUTOFF_MS', () => {
  it('is the Bash tool maximum foreground timeout of 10 minutes', () => {
    expect(ACTIVE_GAP_CUTOFF_MS).toBe(10 * MINUTE)
  })
})
