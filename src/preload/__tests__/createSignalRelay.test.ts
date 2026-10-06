import { describe, expect, it, vi } from 'vitest'
import { createSignalRelay } from '../createSignalRelay'

describe('createSignalRelay', () => {
  it('calls a subscribed listener with no arguments each time a signal arrives', () => {
    const relay = createSignalRelay()
    const listener = vi.fn()
    relay.subscribe(listener)

    relay.signal()
    relay.signal()

    expect(listener.mock.calls).toEqual([[], []])
  })

  it('calls every subscribed listener', () => {
    const relay = createSignalRelay()
    const first = vi.fn()
    const second = vi.fn()
    relay.subscribe(first)
    relay.subscribe(second)

    relay.signal()

    expect(first).toHaveBeenCalledTimes(1)
    expect(second).toHaveBeenCalledTimes(1)
  })

  it('delivers a signal that arrived before anyone subscribed to the first listener', () => {
    const relay = createSignalRelay()
    relay.signal()
    const listener = vi.fn()

    relay.subscribe(listener)

    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('delivers an early signal once, not to a later listener', () => {
    const relay = createSignalRelay()
    relay.signal()
    const first = vi.fn()
    const second = vi.fn()

    relay.subscribe(first)
    relay.subscribe(second)

    expect(first).toHaveBeenCalledTimes(1)
    expect(second).not.toHaveBeenCalled()
  })

  it('remembers several early signals as one request', () => {
    const relay = createSignalRelay()
    relay.signal()
    relay.signal()
    const listener = vi.fn()

    relay.subscribe(listener)

    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('does not call a listener after it unsubscribes', () => {
    const relay = createSignalRelay()
    const listener = vi.fn()
    const unsubscribe = relay.subscribe(listener)

    unsubscribe()
    relay.signal()

    expect(listener).not.toHaveBeenCalled()
  })

  it('removes only the listener that unsubscribed', () => {
    const relay = createSignalRelay()
    const stays = vi.fn()
    const leaves = vi.fn()
    relay.subscribe(stays)
    relay.subscribe(leaves)()

    relay.signal()

    expect(stays).toHaveBeenCalledTimes(1)
    expect(leaves).not.toHaveBeenCalled()
  })

  it('removes one subscription when the same function subscribed twice', () => {
    const relay = createSignalRelay()
    const listener = vi.fn()
    const unsubscribeFirst = relay.subscribe(listener)
    relay.subscribe(listener)

    unsubscribeFirst()
    relay.signal()

    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('keeps a signal for the next listener when it arrives between an unsubscribe and a resubscribe', () => {
    const relay = createSignalRelay()
    relay.subscribe(vi.fn())()

    relay.signal()
    const next = vi.fn()
    relay.subscribe(next)

    expect(next).toHaveBeenCalledTimes(1)
  })

  it('stays safe when unsubscribing twice', () => {
    const relay = createSignalRelay()
    const unsubscribe = relay.subscribe(vi.fn())
    const other = vi.fn()
    relay.subscribe(other)

    unsubscribe()
    unsubscribe()
    relay.signal()

    expect(other).toHaveBeenCalledTimes(1)
  })
})
