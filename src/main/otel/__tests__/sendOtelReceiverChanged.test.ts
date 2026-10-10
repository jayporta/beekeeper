import { describe, expect, it } from 'vitest'
import { IPC_EVENTS } from '../../../shared/ipc/channels'
import { fakeWindow } from '../../testFakeWindow'
import { sendOtelReceiverChanged } from '../sendOtelReceiverChanged'

describe('sendOtelReceiverChanged', () => {
  it('sends the receiver-changed event with no payload to a loaded window', () => {
    const loaded = fakeWindow()

    sendOtelReceiverChanged([loaded.window])

    expect(loaded.send.mock.calls).toEqual([[IPC_EVENTS.otelReceiverChanged]])
  })

  it('sends to a window that is still loading', () => {
    const loading = fakeWindow({ loading: true })

    sendOtelReceiverChanged([loading.window])

    expect(loading.send.mock.calls).toEqual([[IPC_EVENTS.otelReceiverChanged]])
  })

  it('skips a window whose web contents are destroyed', () => {
    const gone = fakeWindow({ destroyed: true })
    const live = fakeWindow()

    sendOtelReceiverChanged([gone.window, live.window])

    expect(gone.send).not.toHaveBeenCalled()
    expect(live.send).toHaveBeenCalledTimes(1)
  })

  it('does nothing when there are no windows', () => {
    expect(() => {
      sendOtelReceiverChanged([])
    }).not.toThrow()
  })
})
