import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RECHECK_INTERVAL_MS, useNowUntil } from '../useNowUntil'

const START = Date.parse('2026-01-01T00:00:00Z')

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(START)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useNowUntil', () => {
  it('returns the time the hook mounted at', () => {
    const { result } = renderHook(() => useNowUntil(null))
    expect(result.current).toBe(START)
  })

  it('moves the time to the deadline once it arrives', () => {
    const { result } = renderHook(() => useNowUntil(START + 60_000))
    act(() => {
      vi.advanceTimersByTime(59_999)
    })
    expect(result.current).toBe(START)
    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(result.current).toBe(START + 60_000)
  })

  it('sets no timer without a deadline', () => {
    renderHook(() => useNowUntil(null))
    expect(vi.getTimerCount()).toBe(0)
  })

  it('sets no timer for a deadline that has passed', () => {
    renderHook(() => useNowUntil(START - 1))
    expect(vi.getTimerCount()).toBe(0)
  })

  it('keeps one timer pending while a far deadline approaches, then moves the time past it', () => {
    const farMs = 3 * 24 * 60 * 60 * 1000
    const deadline = START + farMs
    const { result } = renderHook(() => useNowUntil(deadline))
    const steps = farMs / RECHECK_INTERVAL_MS
    for (let step = 1; step <= steps; step++) {
      expect(result.current).toBeLessThan(deadline)
      expect(vi.getTimerCount()).toBe(1)
      act(() => {
        vi.advanceTimersByTime(RECHECK_INTERVAL_MS)
      })
    }
    expect(result.current).toBeGreaterThanOrEqual(deadline)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('notices a deadline within one interval after the clock jumps past it, as after sleep', () => {
    const deadline = START + 10 * 60_000
    const { result } = renderHook(() => useNowUntil(deadline))
    vi.setSystemTime(deadline + 60_000)
    act(() => {
      vi.advanceTimersByTime(RECHECK_INTERVAL_MS)
    })
    expect(result.current).toBeGreaterThanOrEqual(deadline)
  })

  it('clears the timer on unmount', () => {
    const { unmount } = renderHook(() => useNowUntil(START + 60_000))
    expect(vi.getTimerCount()).toBe(1)
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})
