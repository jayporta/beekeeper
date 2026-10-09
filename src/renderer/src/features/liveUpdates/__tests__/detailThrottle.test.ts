import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createDetailThrottle,
  DETAIL_LIVE_INTERVAL_MS,
  type DetailThrottle
} from '../detailThrottle'
import type { Families } from '../invalidationPlan'

let flushed: Families[]
let throttle: DetailThrottle

beforeEach(() => {
  vi.useFakeTimers()
  flushed = []
  throttle = createDetailThrottle({
    onFlush: (families) => flushed.push(families),
    setTimer: (run, ms) => setTimeout(run, ms),
    clearTimer: (handle) => {
      clearTimeout(handle as ReturnType<typeof setTimeout>)
    }
  })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('createDetailThrottle', () => {
  it('flushes nothing before the interval has passed', () => {
    throttle.add(new Set(['a']))
    vi.advanceTimersByTime(DETAIL_LIVE_INTERVAL_MS - 1)
    expect(flushed).toEqual([])
  })

  it('flushes the families once the interval has passed', () => {
    throttle.add(new Set(['a']))
    vi.advanceTimersByTime(DETAIL_LIVE_INTERVAL_MS)
    expect(flushed).toEqual([new Set(['a'])])
  })

  it('merges the families of several adds into one flush', () => {
    throttle.add(new Set(['a']))
    vi.advanceTimersByTime(3000)
    throttle.add(new Set(['b', 'a']))
    vi.advanceTimersByTime(DETAIL_LIVE_INTERVAL_MS - 3000)
    expect(flushed).toEqual([new Set(['a', 'b'])])
  })

  it('counts the interval from the first add, not the last', () => {
    throttle.add(new Set(['a']))
    vi.advanceTimersByTime(DETAIL_LIVE_INTERVAL_MS - 1)
    throttle.add(new Set(['b']))
    vi.advanceTimersByTime(1)
    expect(flushed).toHaveLength(1)
  })

  it.each([
    ['after a set', [new Set(['a']), 'all'] as Families[]],
    ['before a set', ['all', new Set(['a'])] as Families[]]
  ])('flushes all when an add of all comes %s', (_label, adds) => {
    for (const families of adds) throttle.add(families)
    vi.advanceTimersByTime(DETAIL_LIVE_INTERVAL_MS)
    expect(flushed).toEqual(['all'])
  })

  it('starts a new interval for an add after a flush', () => {
    throttle.add(new Set(['a']))
    vi.advanceTimersByTime(DETAIL_LIVE_INTERVAL_MS)
    throttle.add(new Set(['b']))
    vi.advanceTimersByTime(DETAIL_LIVE_INTERVAL_MS - 1)
    expect(flushed).toEqual([new Set(['a'])])
    vi.advanceTimersByTime(1)
    expect(flushed).toEqual([new Set(['a']), new Set(['b'])])
  })

  it('flushes at once on flush, and not again when the interval ends', () => {
    throttle.add(new Set(['a']))
    throttle.flush()
    expect(flushed).toEqual([new Set(['a'])])
    vi.advanceTimersByTime(DETAIL_LIVE_INTERVAL_MS * 2)
    expect(flushed).toHaveLength(1)
  })

  it('flushes nothing on flush when nothing is waiting', () => {
    throttle.flush()
    expect(flushed).toEqual([])
  })

  it('drops what is waiting on cancel', () => {
    throttle.add(new Set(['a']))
    throttle.cancel()
    vi.advanceTimersByTime(DETAIL_LIVE_INTERVAL_MS * 2)
    expect(flushed).toEqual([])
  })

  it('does not let a cancelled round’s timer end the next round early', () => {
    throttle.add(new Set(['a']))
    vi.advanceTimersByTime(5000)
    throttle.add(new Set(['b']))
    throttle.cancel()
    throttle.add(new Set(['c']))

    vi.advanceTimersByTime(DETAIL_LIVE_INTERVAL_MS - 5000)
    expect(flushed).toEqual([])
    vi.advanceTimersByTime(5000)
    expect(flushed).toEqual([new Set(['c'])])
  })

  it('works again after a cancel, without the cancelled families', () => {
    throttle.add(new Set(['a']))
    throttle.cancel()
    throttle.add(new Set(['b']))
    vi.advanceTimersByTime(DETAIL_LIVE_INTERVAL_MS)
    expect(flushed).toEqual([new Set(['b'])])
  })
})
