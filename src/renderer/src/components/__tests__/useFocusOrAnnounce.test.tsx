import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LIVE_COPY_CLEAR_MS } from '../liveCopyClearMs'
import { useFocusOrAnnounce } from '../useFocusOrAnnounce'

afterEach(() => {
  vi.useRealTimers()
  document.body.replaceChildren()
})

/** Mounts the hook on a focusable target, and records what each render returned. */
function mountOnTarget(): {
  target: HTMLElement
  seen: boolean[]
  rerender: (trigger: string) => void
  result: { readonly current: boolean }
  unmount: () => void
} {
  const target = document.createElement('div')
  target.tabIndex = -1
  document.body.append(target)
  const ref = { current: target }
  const seen: boolean[] = []
  const { result, rerender, unmount } = renderHook(
    ({ trigger }) => {
      const announce = useFocusOrAnnounce(ref, trigger)
      seen.push(announce)
      return announce
    },
    { initialProps: { trigger: '' } }
  )
  return { target, seen, result, unmount, rerender: (trigger) => rerender({ trigger }) }
}

/** Focuses a new button, so the page has seen focus, and returns it. */
function focusNewButton(): HTMLButtonElement {
  const button = document.createElement('button')
  document.body.append(button)
  button.focus()
  return button
}

describe('useFocusOrAnnounce', () => {
  it('focuses the target and does not announce when the focused element left the page', () => {
    const { target, result, rerender } = mountOnTarget()
    focusNewButton().remove()

    rerender('gone')

    expect(document.activeElement).toBe(target)
    expect(result.current).toBe(false)
  })

  it('announces and leaves focus alone when focus is still on an element', () => {
    const { result, rerender } = mountOnTarget()
    const button = focusNewButton()

    rerender('gone')

    expect(document.activeElement).toBe(button)
    expect(result.current).toBe(true)
  })

  it('announces and leaves focus on the page when nothing was ever focused', () => {
    const { result, rerender } = mountOnTarget()

    rerender('gone')

    expect(document.activeElement).toBe(document.body)
    expect(result.current).toBe(true)
  })

  it('announces a changed trigger after taking focus for the one before', () => {
    const { target, result, rerender } = mountOnTarget()
    focusNewButton().remove()
    rerender('first')

    rerender('second')

    expect(document.activeElement).toBe(target)
    expect(result.current).toBe(true)
  })

  it('moves focus nowhere and announces nothing when the trigger turns empty', () => {
    const { target, result, rerender } = mountOnTarget()
    const button = focusNewButton()
    rerender('first')
    button.remove()

    rerender('')

    expect(document.activeElement).not.toBe(target)
    expect(result.current).toBe(false)
  })

  it('keeps announcing until the live copy has been up for its whole delay', () => {
    vi.useFakeTimers()
    const { result, rerender } = mountOnTarget()
    rerender('gone')

    act(() => {
      vi.advanceTimersByTime(LIVE_COPY_CLEAR_MS - 1)
    })

    expect(result.current).toBe(true)
  })

  it('stops announcing once the live copy delay has passed', () => {
    vi.useFakeTimers()
    const { result, rerender } = mountOnTarget()
    rerender('gone')

    act(() => {
      vi.advanceTimersByTime(LIVE_COPY_CLEAR_MS)
    })

    expect(result.current).toBe(false)
  })

  it('starts the delay over when the trigger changes', () => {
    vi.useFakeTimers()
    const { result, rerender } = mountOnTarget()
    rerender('first')
    act(() => {
      vi.advanceTimersByTime(LIVE_COPY_CLEAR_MS - 1)
    })
    rerender('second')

    act(() => {
      vi.advanceTimersByTime(1)
    })

    expect(result.current).toBe(true)
  })

  it('leaves no timer running after it unmounts', () => {
    vi.useFakeTimers()
    const { unmount, rerender } = mountOnTarget()
    rerender('gone')

    unmount()

    expect(vi.getTimerCount()).toBe(0)
  })

  it('never reports a returning trigger as announced before deciding it again', () => {
    const { seen, result, rerender } = mountOnTarget()
    rerender('gone')
    expect(result.current).toBe(true)
    rerender('')
    focusNewButton().remove()
    const before = seen.length

    rerender('gone')

    expect(seen.slice(before)).not.toContain(true)
    expect(result.current).toBe(false)
  })
})
