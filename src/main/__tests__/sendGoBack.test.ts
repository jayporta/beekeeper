import { describe, expect, it } from 'vitest'
import { IPC_EVENTS } from '../../shared/ipc/channels'
import { sendGoBack } from '../sendGoBack'
import { fakeWindow } from '../testFakeWindow'

describe('sendGoBack', () => {
  it('sends the go-back event with no payload to the window', () => {
    const target = fakeWindow()

    sendGoBack(target.window)

    expect(target.send.mock.calls).toEqual([[IPC_EVENTS.goBack]])
  })

  it('does not restore, show or focus the window, which the person is already using', () => {
    const target = fakeWindow({ minimized: true })

    sendGoBack(target.window)

    expect(target.calls).toEqual(['send:1'])
  })

  it('sends nothing to a window whose web contents are destroyed', () => {
    const target = fakeWindow({ destroyed: true })

    sendGoBack(target.window)

    expect(target.send).not.toHaveBeenCalled()
  })
})
