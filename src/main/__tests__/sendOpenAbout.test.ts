import { describe, expect, it } from 'vitest'
import { IPC_EVENTS } from '../../shared/ipc/channels'
import { sendOpenAbout } from '../sendOpenAbout'
import { fakeWindow } from '../testFakeWindow'

// Which windows are surfaced, and when, is covered in surfaceWindows.test.ts.
describe('sendOpenAbout', () => {
  it('sends the open-about event with no payload to a live window', () => {
    const live = fakeWindow()

    sendOpenAbout([live.window])

    expect(live.send.mock.calls).toEqual([[IPC_EVENTS.openAbout]])
  })

  it('shows and focuses a window before sending', () => {
    const live = fakeWindow()

    sendOpenAbout([live.window])

    expect(live.calls).toEqual(['show', 'focus', 'send:1'])
  })
})
