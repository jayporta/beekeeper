import { afterEach, describe, expect, it, vi } from 'vitest'
import { installProcessPort, processPort } from '../installProcessPort'
import { nodeProcess } from '../node/nodeProcess'

describe('installProcessPort', () => {
  afterEach(() => {
    installProcessPort(nodeProcess)
    vi.resetModules()
  })

  it('returns the installed port from processPort()', () => {
    const port = { ...nodeProcess, platform: 'first' }

    installProcessPort(port)

    expect(processPort()).toBe(port)
  })

  it('returns the latest port after a second install', () => {
    const first = { ...nodeProcess, platform: 'first' }
    const second = { ...nodeProcess, platform: 'second' }

    installProcessPort(first)
    installProcessPort(second)

    expect(processPort()).toBe(second)
  })

  it('throws an error naming installProcessPort when nothing is installed', async () => {
    vi.resetModules()
    const fresh = await import('../installProcessPort')

    expect(() => fresh.processPort()).toThrow(/installProcessPort/)
  })
})
