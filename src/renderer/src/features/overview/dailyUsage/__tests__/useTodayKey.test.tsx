import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useTodayKey } from '../useTodayKey'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 2, 10, 23, 59, 30))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useTodayKey', () => {
  it('is the local day', () => {
    const { result } = renderHook(() => useTodayKey())

    expect(result.current).toBe('2026-03-10')
  })

  it('moves to the next day when local midnight passes', () => {
    const { result } = renderHook(() => useTodayKey())

    act(() => {
      vi.advanceTimersByTime(31_000)
    })

    expect(result.current).toBe('2026-03-11')
  })

  it('keeps following the day after the first midnight', () => {
    const { result } = renderHook(() => useTodayKey())
    act(() => {
      vi.advanceTimersByTime(31_000)
    })

    act(() => {
      vi.advanceTimersByTime(24 * 60 * 60 * 1000)
    })

    expect(result.current).toBe('2026-03-12')
  })

  it('catches up on window focus, as after the machine slept through midnight', () => {
    const { result } = renderHook(() => useTodayKey())
    // A sleeping machine runs no timers, so the clock moves with the timer unfired.
    vi.setSystemTime(new Date(2026, 2, 13, 8, 0))

    act(() => {
      window.dispatchEvent(new Event('focus'))
    })

    expect(result.current).toBe('2026-03-13')
  })

  it('stops its timer and listener when unmounted', () => {
    const remove = vi.spyOn(window, 'removeEventListener')
    const { unmount } = renderHook(() => useTodayKey())

    unmount()

    expect(vi.getTimerCount()).toBe(0)
    expect(remove).toHaveBeenCalledWith('focus', expect.any(Function))
  })
})
