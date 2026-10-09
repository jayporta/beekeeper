import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Archiver } from '../createArchiver'
import { wireArchiver, type ArchiverHost } from '../wireArchiver'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

function setup(): {
  events: string[]
  loaded: () => void
  quit: () => void
} {
  const events: string[] = []
  let onLoaded: () => void = () => {}
  let onQuit: () => void = () => {}
  const archiver: Archiver = {
    start: () => events.push('start'),
    stop: () => events.push('stop'),
    runPass: () => Promise.resolve()
  }
  const host: ArchiverHost = {
    onFirstWindowLoaded: (listener) => {
      onLoaded = listener
    },
    onWillQuit: (listener) => {
      onQuit = listener
    }
  }
  wireArchiver({ archiver, close: () => events.push('close'), host })
  return { events, loaded: () => onLoaded(), quit: () => onQuit() }
}

describe('wireArchiver', () => {
  it('does not start before the first window has loaded', async () => {
    const { events } = setup()

    await vi.runAllTimersAsync()

    expect(events).toEqual([])
  })

  it('starts the archiver after the first window loads, once the event loop turns', async () => {
    const { events, loaded } = setup()

    loaded()
    expect(events).toEqual([])
    await vi.runAllTimersAsync()

    expect(events).toEqual(['start'])
  })

  it('stops the archiver and then closes the store on quit', () => {
    const { events, quit } = setup()

    quit()

    expect(events).toEqual(['stop', 'close'])
  })

  it('does not start the archiver when the app quits before the deferred start runs', async () => {
    const { events, loaded, quit } = setup()

    loaded()
    quit()
    await vi.runAllTimersAsync()

    expect(events).toEqual(['stop', 'close'])
  })
})
