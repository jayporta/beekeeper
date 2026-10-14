import { act, fireEvent, render, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ModalDialog } from '@renderer/components/ModalDialog'
import { installBeekeeperApi } from '@renderer/testBeekeeperApi'
import { useBackShortcuts } from '../useBackShortcuts'

/** Mounts the hook with the preload stub installed. */
function mount(goBack: () => void = vi.fn()): {
  api: ReturnType<typeof installBeekeeperApi>
  goBack: () => void
  unmount: () => void
  rerender: (next: () => void) => void
} {
  const api = installBeekeeperApi()
  const { unmount, rerender } = renderHook(
    ({ current }) => {
      useBackShortcuts(current)
    },
    { initialProps: { current: goBack } }
  )
  return {
    api,
    goBack,
    unmount,
    rerender: (next) => {
      rerender({ current: next })
    }
  }
}

/** Presses Alt and the left arrow on `target`, and returns whether the event was left uncancelled. */
function pressAltLeft(target: Element | Window = window, init: KeyboardEventInit = {}): boolean {
  return fireEvent.keyDown(target, { key: 'ArrowLeft', altKey: true, ...init })
}

describe('useBackShortcuts from the menu', () => {
  it('goes back when the View menu asks for it', () => {
    const { api, goBack } = mount()

    act(() => {
      api.fireGoBack()
    })

    expect(goBack).toHaveBeenCalledOnce()
  })

  it('stops listening for the menu once unmounted', () => {
    const { api, goBack, unmount } = mount()

    unmount()
    act(() => {
      api.fireGoBack()
    })

    expect(goBack).not.toHaveBeenCalled()
  })

  it('calls the latest goBack, without resubscribing to the menu', () => {
    const { api, rerender } = mount()
    const latest = vi.fn()

    rerender(latest)
    act(() => {
      api.fireGoBack()
    })

    expect(latest).toHaveBeenCalledOnce()
    expect(api.onGoBack).toHaveBeenCalledOnce()
  })
})

describe('useBackShortcuts from the menu while the accelerator repeats', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  /** Mounts the hook under fake timers and returns a function that asks for Back from the menu after `ms` more. */
  function mountWithClock(): { goBack: () => void; askAfter: (ms: number) => void } {
    vi.useFakeTimers()
    const { api, goBack } = mount()
    return {
      goBack,
      askAfter: (ms) => {
        act(() => {
          vi.advanceTimersByTime(ms)
          api.fireGoBack()
        })
      }
    }
  }

  it('goes back once for two requests 50 ms apart, which are a held key repeating', () => {
    const { goBack, askAfter } = mountWithClock()

    askAfter(0)
    askAfter(50)

    expect(goBack).toHaveBeenCalledOnce()
  })

  it('goes back twice for two requests 400 ms apart, which are two presses', () => {
    const { goBack, askAfter } = mountWithClock()

    askAfter(0)
    askAfter(400)

    expect(goBack).toHaveBeenCalledTimes(2)
  })

  it('keeps ignoring a key held down for a second, however long it repeats', () => {
    const { goBack, askAfter } = mountWithClock()

    askAfter(0)
    for (let i = 0; i < 5; i += 1) askAfter(200)

    expect(goBack).toHaveBeenCalledOnce()
  })
})

describe('useBackShortcuts from the keyboard', () => {
  it('goes back on Alt and the left arrow, and cancels the key', () => {
    const { goBack } = mount()

    const notCancelled = pressAltLeft(document.body)

    expect(goBack).toHaveBeenCalledOnce()
    expect(notCancelled).toBe(false)
  })

  it('does not go back when the key is pressed in a text field', () => {
    const { goBack } = mount()
    const field = document.createElement('input')
    document.body.append(field)

    const notCancelled = pressAltLeft(field)
    field.remove()

    expect(goBack).not.toHaveBeenCalled()
    expect(notCancelled).toBe(true)
  })

  it('does not go back on the left arrow alone', () => {
    const { goBack } = mount()

    pressAltLeft(document.body, { altKey: false })

    expect(goBack).not.toHaveBeenCalled()
  })

  it('calls the latest goBack', () => {
    const { rerender } = mount()
    const latest = vi.fn()

    rerender(latest)
    pressAltLeft(document.body)

    expect(latest).toHaveBeenCalledOnce()
  })

  it('stops listening for the key once unmounted', () => {
    const { goBack, unmount } = mount()

    unmount()
    pressAltLeft(document.body)

    expect(goBack).not.toHaveBeenCalled()
  })
})

describe('useBackShortcuts from the mouse', () => {
  it('goes back when the back button is released, and cancels it so the browser does not', () => {
    const { goBack } = mount()

    const notCancelled = fireEvent.mouseUp(document.body, { button: 3 })

    expect(goBack).toHaveBeenCalledOnce()
    expect(notCancelled).toBe(false)
  })

  it('cancels the back button click that follows, without going back a second time', () => {
    const { goBack } = mount()

    const notCancelled = fireEvent(
      document.body,
      new MouseEvent('auxclick', { button: 3, bubbles: true, cancelable: true })
    )

    expect(notCancelled).toBe(false)
    expect(goBack).not.toHaveBeenCalled()
  })

  it.each([
    ['primary', 0],
    ['middle', 1],
    ['secondary', 2],
    ['forward', 4]
  ])('ignores the %s button', (_name, button) => {
    const { goBack } = mount()

    const mouseUpNotCancelled = fireEvent.mouseUp(document.body, { button })
    const auxClickNotCancelled = fireEvent(
      document.body,
      new MouseEvent('auxclick', { button, bubbles: true, cancelable: true })
    )

    expect(goBack).not.toHaveBeenCalled()
    expect(mouseUpNotCancelled).toBe(true)
    expect(auxClickNotCancelled).toBe(true)
  })

  it('stops listening for the mouse once unmounted', () => {
    const { goBack, unmount } = mount()

    unmount()
    fireEvent.mouseUp(document.body, { button: 3 })

    expect(goBack).not.toHaveBeenCalled()
  })
})

/** Opens a modal dialog on the page, as the About dialog does. */
function openModalDialog(): { close: () => void } {
  const dialog = (open: boolean): React.JSX.Element => (
    <ModalDialog open={open} onClose={() => undefined} labelledBy="dialog-heading">
      <h2 id="dialog-heading">Dialog</h2>
    </ModalDialog>
  )
  const { rerender } = render(dialog(true))
  return {
    close: () => {
      rerender(dialog(false))
    }
  }
}

describe('useBackShortcuts while a modal dialog is open', () => {
  it('ignores the View menu, so the page behind the dialog does not change', () => {
    const { api, goBack } = mount()
    openModalDialog()

    act(() => {
      api.fireGoBack()
    })

    expect(goBack).not.toHaveBeenCalled()
  })

  it('ignores Alt and the left arrow, and leaves the key uncancelled', () => {
    const { goBack } = mount()
    openModalDialog()

    const notCancelled = pressAltLeft(document.body)

    expect(goBack).not.toHaveBeenCalled()
    expect(notCancelled).toBe(true)
  })

  it('ignores the mouse back button, but still cancels it so the browser does not move', () => {
    const { goBack } = mount()
    openModalDialog()

    const notCancelled = fireEvent.mouseUp(document.body, { button: 3 })

    expect(goBack).not.toHaveBeenCalled()
    expect(notCancelled).toBe(false)
  })

  it.each([
    ['the View menu', (api: ReturnType<typeof installBeekeeperApi>) => api.fireGoBack()],
    ['Alt and the left arrow', () => pressAltLeft(document.body)],
    ['the mouse back button', () => fireEvent.mouseUp(document.body, { button: 3 })]
  ])('goes back from %s again once the dialog closes', (_name, trigger) => {
    const { api, goBack } = mount()
    const dialog = openModalDialog()
    dialog.close()

    act(() => {
      trigger(api)
    })

    expect(goBack).toHaveBeenCalledOnce()
  })
})
