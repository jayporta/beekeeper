import { afterEach, describe, expect, it, vi } from 'vitest'
import type { FileSystemPort } from '../fileSystemPort'
import { fileSystem, installFileSystem } from '../installFileSystem'
import { nodeFileSystem } from '../node/nodeFileSystem'

function fakePort(label: string): FileSystemPort {
  return { ...nodeFileSystem, joinPath: () => label }
}

describe('installFileSystem', () => {
  afterEach(() => {
    installFileSystem(nodeFileSystem)
    vi.resetModules()
  })

  it('returns the installed port from fileSystem()', () => {
    const port = fakePort('first')

    installFileSystem(port)

    expect(fileSystem()).toBe(port)
  })

  it('returns the latest port after a second install', () => {
    const first = fakePort('first')
    const second = fakePort('second')

    installFileSystem(first)
    installFileSystem(second)

    expect(fileSystem()).toBe(second)
  })

  it('throws an error naming installFileSystem when nothing is installed', async () => {
    vi.resetModules()
    const fresh = await import('../installFileSystem')

    expect(() => fresh.fileSystem()).toThrow(/installFileSystem/)
  })
})
