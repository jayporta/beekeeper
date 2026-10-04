import { renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { useFocusWhenFocusLost } from '../useFocusWhenFocusLost'

afterEach(() => {
  document.body.replaceChildren()
})

describe('useFocusWhenFocusLost', () => {
  it('does not report a returning trigger as having taken focus when focus was not lost', () => {
    const target = document.createElement('div')
    target.tabIndex = -1
    document.body.append(target)
    const { result, rerender } = renderHook(
      ({ trigger }) => useFocusWhenFocusLost({ current: target }, trigger),
      { initialProps: { trigger: '' } }
    )
    const button = document.createElement('button')
    document.body.append(button)
    button.focus()
    button.remove()

    rerender({ trigger: 'gone' })
    expect(result.current).toBe(true)
    expect(document.activeElement).toBe(target)

    rerender({ trigger: '' })
    rerender({ trigger: 'gone' })

    expect(result.current).toBe(false)
  })
})
