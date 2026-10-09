import { describe, expect, it, vi } from 'vitest'
import { surfaceWindows } from '../surfaceWindows'
import { fakeWindow } from '../testFakeWindow'

describe('surfaceWindows', () => {
  it('shows and focuses a live window without sending anything', () => {
    const live = fakeWindow()

    surfaceWindows([live.window])

    expect(live.calls).toEqual(['show', 'focus'])
  })

  it('restores a minimized window before showing it', () => {
    const minimized = fakeWindow({ minimized: true })

    surfaceWindows([minimized.window])

    expect(minimized.calls).toEqual(['restore', 'show', 'focus'])
  })

  it('surfaces every live window', () => {
    const first = fakeWindow()
    const second = fakeWindow()

    surfaceWindows([first.window, second.window])

    expect([first.calls, second.calls]).toEqual([
      ['show', 'focus'],
      ['show', 'focus']
    ])
  })

  it('skips a window whose web contents are destroyed', () => {
    const gone = fakeWindow({ destroyed: true })
    const live = fakeWindow()

    surfaceWindows([gone.window, live.window])

    expect([gone.calls, live.calls]).toEqual([[], ['show', 'focus']])
  })

  it('does nothing when there are no windows', () => {
    const afterSurfaced = vi.fn()

    expect(() => {
      surfaceWindows([], afterSurfaced)
    }).not.toThrow()
    expect(afterSurfaced).not.toHaveBeenCalled()
  })

  it('calls back with the window after it has been shown and focused', () => {
    const live = fakeWindow()
    const afterSurfaced = vi.fn(() => {
      live.calls.push('callback')
    })

    surfaceWindows([live.window], afterSurfaced)

    expect(live.calls).toEqual(['show', 'focus', 'callback'])
    expect(afterSurfaced).toHaveBeenCalledWith(live.window)
  })

  it('does not call back for a destroyed window', () => {
    const gone = fakeWindow({ destroyed: true })
    const afterSurfaced = vi.fn()

    surfaceWindows([gone.window], afterSurfaced)

    expect(afterSurfaced).not.toHaveBeenCalled()
  })

  describe('a window that is still loading', () => {
    it('waits for the page to finish loading before doing anything', () => {
      const loading = fakeWindow({ loading: true })

      surfaceWindows([loading.window])

      expect(loading.waitedFor).toEqual(['did-finish-load'])
      expect(loading.calls).toEqual([])
    })

    it('shows and focuses once the page has loaded', () => {
      const loading = fakeWindow({ loading: true })
      surfaceWindows([loading.window])

      loading.finishLoad()

      expect(loading.calls).toEqual(['show', 'focus'])
    })

    it('calls back only once the page has loaded', () => {
      const loading = fakeWindow({ loading: true })
      const afterSurfaced = vi.fn()
      surfaceWindows([loading.window], afterSurfaced)

      expect(afterSurfaced).not.toHaveBeenCalled()
      loading.finishLoad()

      expect(afterSurfaced).toHaveBeenCalledWith(loading.window)
    })

    it('does not wait when the window is not loading', () => {
      const live = fakeWindow()

      surfaceWindows([live.window])

      expect(live.waitedFor).toEqual([])
    })

    it('does nothing when the window was destroyed while it loaded', () => {
      const loading = fakeWindow({ loading: true })
      const afterSurfaced = vi.fn()
      surfaceWindows([loading.window], afterSurfaced)

      loading.destroy()
      loading.finishLoad()

      expect(loading.calls).toEqual([])
      expect(afterSurfaced).not.toHaveBeenCalled()
    })

    it('surfaces a ready window right away while another still loads', () => {
      const loading = fakeWindow({ loading: true })
      const ready = fakeWindow()

      surfaceWindows([loading.window, ready.window])

      expect([loading.calls, ready.calls]).toEqual([[], ['show', 'focus']])
    })
  })
})
