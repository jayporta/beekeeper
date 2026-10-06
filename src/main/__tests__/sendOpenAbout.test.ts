import type { BrowserWindow } from 'electron'
import { describe, expect, it, vi } from 'vitest'
import { IPC_EVENTS } from '../../shared/ipc/channels'
import { sendOpenAbout } from '../sendOpenAbout'

interface FakeWindow {
  readonly window: BrowserWindow
  readonly calls: string[]
  readonly send: ReturnType<typeof vi.fn>
}

/** A window stub that records the order of the calls made on it. */
function fakeWindow({
  minimized = false,
  destroyed = false
}: { minimized?: boolean; destroyed?: boolean } = {}): FakeWindow {
  const calls: string[] = []
  const send = vi.fn((...args: unknown[]) => {
    calls.push(`send:${args.length}`)
  })
  const window = {
    isMinimized: () => minimized,
    restore: () => calls.push('restore'),
    show: () => calls.push('show'),
    focus: () => calls.push('focus'),
    webContents: { isDestroyed: () => destroyed, send }
  } as unknown as BrowserWindow
  return { window, calls, send }
}

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
})
