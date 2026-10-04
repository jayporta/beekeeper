import { renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { useFocusOrAnnounce } from '../useFocusOrAnnounce'

afterEach(() => {
  document.body.replaceChildren()
})

/** Mounts the hook on a focusable target, and records what each render returned. */
function mountOnTarget(): {
  target: HTMLElement
  seen: boolean[]
  rerender: (trigger: string) => void
  result: { readonly current: boolean }
} {
  const target = document.createElement('div')
  target.tabIndex = -1
  document.body.append(target)
  const ref = { current: target }
  const seen: boolean[] = []
  const { result, rerender } = renderHook(
    ({ trigger }) => {
      const announce = useFocusOrAnnounce(ref, trigger)
      seen.push(announce)
      return announce
    },
    { initialProps: { trigger: '' } }
  )
  return { target, seen, result, rerender: (trigger) => rerender({ trigger }) }
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

  it('announces nothing for an empty trigger', () => {
    const { result, rerender } = mountOnTarget()
    focusNewButton().remove()

    rerender('')

    expect(result.current).toBe(false)
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
