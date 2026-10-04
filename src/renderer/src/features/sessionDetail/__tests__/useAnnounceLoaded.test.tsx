import { act, renderHook, type RenderHookResult } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LIVE_COPY_CLEAR_MS } from '@renderer/components/liveCopyClearMs'
import { useAnnounceLoaded } from '../useAnnounceLoaded'

afterEach(() => {
  vi.useRealTimers()
})

/** The hook's inputs. */
interface AnnounceInputs {
  readonly loaded: boolean
  readonly settled: boolean
}

/** Renders the hook with the given inputs, which `rerender` can change. */
function renderAnnounce(initial: AnnounceInputs): RenderHookResult<boolean, AnnounceInputs> {
  return renderHook(({ loaded, settled }) => useAnnounceLoaded(loaded, settled), {
    initialProps: initial
  })
}

describe('useAnnounceLoaded', () => {
  it('does not announce while the view is loading', () => {
    const { result } = renderAnnounce({ loaded: false, settled: true })

    expect(result.current).toBe(false)
  })

  it('announces once the data has loaded after loading was on screen', () => {
    const { result, rerender } = renderAnnounce({ loaded: false, settled: true })

    rerender({ loaded: true, settled: true })

    expect(result.current).toBe(true)
  })

  it('does not announce data that was already there when the view mounted', () => {
    const { result } = renderAnnounce({ loaded: true, settled: true })

    expect(result.current).toBe(false)
  })

  it('waits until what it names has settled', () => {
    const { result, rerender } = renderAnnounce({ loaded: false, settled: false })

    rerender({ loaded: true, settled: false })
    expect(result.current).toBe(false)

    rerender({ loaded: true, settled: true })
    expect(result.current).toBe(true)
  })

  it('stops announcing after the live copy delay, and does not start again when it unsettles and settles', () => {
    vi.useFakeTimers()
    const { result, rerender } = renderAnnounce({ loaded: false, settled: true })
    rerender({ loaded: true, settled: true })

    act(() => {
      vi.advanceTimersByTime(LIVE_COPY_CLEAR_MS)
    })
    expect(result.current).toBe(false)

    rerender({ loaded: true, settled: false })
    rerender({ loaded: true, settled: true })
    expect(result.current).toBe(false)
  })
})
