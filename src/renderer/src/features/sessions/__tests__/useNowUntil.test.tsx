import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MAX_TIMER_DELAY_MS, useNowUntil } from '../useNowUntil'

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

  it('sets no timer for a deadline beyond the longest timer delay', () => {
    renderHook(() => useNowUntil(START + MAX_TIMER_DELAY_MS + 1))
    expect(vi.getTimerCount()).toBe(0)
  })

  it('sets a timer for a deadline exactly at the longest timer delay', () => {
    renderHook(() => useNowUntil(START + MAX_TIMER_DELAY_MS))
    expect(vi.getTimerCount()).toBe(1)
  })

  it('clears the timer on unmount', () => {
    const { unmount } = renderHook(() => useNowUntil(START + 60_000))
    expect(vi.getTimerCount()).toBe(1)
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})
