import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { useWindowControlsOverlay } from '../useWindowControlsOverlay'

interface FakeOverlay extends EventTarget {
  visible: boolean
}

function installOverlay(visible: boolean): FakeOverlay {
  const overlay = Object.assign(new EventTarget(), { visible })
  Object.defineProperty(navigator, 'windowControlsOverlay', { value: overlay, configurable: true })
  return overlay
}

afterEach(() => {
  Reflect.deleteProperty(navigator, 'windowControlsOverlay')
})

describe('useWindowControlsOverlay', () => {
  it('is false where the page has no overlay', () => {
    const { result } = renderHook(() => useWindowControlsOverlay())

    expect(result.current).toBe(false)
  })

  it('is true while the overlay is visible', () => {
    installOverlay(true)

    const { result } = renderHook(() => useWindowControlsOverlay())

    expect(result.current).toBe(true)
  })

  it('follows the overlay when its geometry changes', () => {
    const overlay = installOverlay(true)
    const { result } = renderHook(() => useWindowControlsOverlay())

    act(() => {
      overlay.visible = false
      overlay.dispatchEvent(new Event('geometrychange'))
    })

    expect(result.current).toBe(false)
  })
})
