import { describe, expect, it } from 'vitest'
import { fakeWindow } from '../testFakeWindow'
import { sendLiveEvent } from '../sendLiveEvent'

describe('sendLiveEvent', () => {
  it('sends the channel and payload to a live window', () => {
    const live = fakeWindow()
    sendLiveEvent([live.window], { channel: 'a:b', payload: { x: 1 } })
    expect(live.send.mock.calls).toEqual([['a:b', { x: 1 }]])
  })

  it('sends only the channel when there is no payload', () => {
    const live = fakeWindow()
    sendLiveEvent([live.window], { channel: 'a:b' })
    expect(live.send.mock.calls).toEqual([['a:b']])
  })

  it('sends to every live window', () => {
    const first = fakeWindow()
    const second = fakeWindow()
    sendLiveEvent([first.window, second.window], { channel: 'a:b' })
    expect(first.send).toHaveBeenCalledTimes(1)
    expect(second.send).toHaveBeenCalledTimes(1)
  })

  it('skips a window whose web contents are destroyed', () => {
    const gone = fakeWindow({ destroyed: true })
    const live = fakeWindow()
    sendLiveEvent([gone.window, live.window], { channel: 'a:b' })
    expect(gone.send).not.toHaveBeenCalled()
    expect(live.send).toHaveBeenCalledTimes(1)
  })

  it('skips a window that is still loading', () => {
    const loading = fakeWindow({ loading: true })
    sendLiveEvent([loading.window], { channel: 'a:b' })
    expect(loading.send).not.toHaveBeenCalled()
  })

  it('does nothing when there are no windows', () => {
    expect(() => {
      sendLiveEvent([], { channel: 'a:b' })
    }).not.toThrow()
  })
})
