import { describe, expect, it } from 'vitest'
import { isBeforeTotalsWindow } from '../isBeforeTotalsWindow'

const DAY = 24 * 60 * 60 * 1000
const NOW = 1000 * DAY

describe('isBeforeTotalsWindow', () => {
  const cutoff = NOW - 7 * DAY

  it('is false at the cutoff and true a millisecond before, by the last message', () => {
    expect(isBeforeTotalsWindow({ latestMs: cutoff, mtimeMs: 0 }, cutoff)).toBe(false)
    expect(isBeforeTotalsWindow({ latestMs: cutoff - 1, mtimeMs: NOW }, cutoff)).toBe(true)
  })

  it('goes by the file time when there is no last message', () => {
    expect(isBeforeTotalsWindow({ latestMs: null, mtimeMs: cutoff }, cutoff)).toBe(false)
    expect(isBeforeTotalsWindow({ latestMs: null, mtimeMs: cutoff - 1 }, cutoff)).toBe(true)
  })
})
