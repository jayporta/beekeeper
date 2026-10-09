import { describe, expect, it } from 'vitest'
import { IPC_EVENTS } from '../../shared/ipc/channels'
import { sendOpenAbout } from '../sendOpenAbout'
import { fakeWindow } from '../testFakeWindow'

describe('sendOpenAbout', () => {
  it('sends the open-about event with no payload to a live window', () => {
    const live = fakeWindow()

    sendOpenAbout([live.window])

    expect(live.send.mock.calls).toEqual([[IPC_EVENTS.openAbout]])
  })

  it('sends to every live window', () => {
    const first = fakeWindow()
    const second = fakeWindow()

    sendOpenAbout([first.window, second.window])

    expect(first.send).toHaveBeenCalledTimes(1)
    expect(second.send).toHaveBeenCalledTimes(1)
  })

  it('skips a window whose web contents are destroyed', () => {
    const gone = fakeWindow({ destroyed: true })
    const live = fakeWindow()

    sendOpenAbout([gone.window, live.window])

    expect(gone.calls).toEqual([])
    expect(live.send).toHaveBeenCalledTimes(1)
  })

  it('shows and focuses a window before sending', () => {
    const live = fakeWindow()

    sendOpenAbout([live.window])

    expect(live.calls).toEqual(['show', 'focus', 'send:1'])
  })

  it('restores a minimized window before showing it', () => {
    const minimized = fakeWindow({ minimized: true })

    sendOpenAbout([minimized.window])

    expect(minimized.calls).toEqual(['restore', 'show', 'focus', 'send:1'])
  })

  it('does nothing when there are no windows', () => {
    expect(() => {
      sendOpenAbout([])
    }).not.toThrow()
  })

  describe('a window that is still loading', () => {
    it('waits for the page to finish loading before doing anything', () => {
      const loading = fakeWindow({ loading: true })

      sendOpenAbout([loading.window])

      expect(loading.waitedFor).toEqual(['did-finish-load'])
      expect(loading.calls).toEqual([])
    })

    it('shows, focuses, and sends once the page has loaded', () => {
      const loading = fakeWindow({ loading: true })
      sendOpenAbout([loading.window])

      loading.finishLoad()

      expect(loading.calls).toEqual(['show', 'focus', 'send:1'])
    })

    it('does not wait when the window is not loading', () => {
      const live = fakeWindow()

      sendOpenAbout([live.window])

      expect(live.waitedFor).toEqual([])
    })

    it('sends nothing when the window was destroyed while it loaded', () => {
      const loading = fakeWindow({ loading: true })
      sendOpenAbout([loading.window])

      loading.destroy()
      loading.finishLoad()

      expect(loading.calls).toEqual([])
    })

    it('sends to a ready window right away while another still loads', () => {
      const loading = fakeWindow({ loading: true })
      const ready = fakeWindow()

      sendOpenAbout([loading.window, ready.window])

      expect(ready.send).toHaveBeenCalledTimes(1)
      expect(loading.send).not.toHaveBeenCalled()
    })
  })
})
