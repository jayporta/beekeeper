import { beforeAll } from 'vitest'
import { installFileSystem } from '../installFileSystem'

// Imported lazily, after a test file's hoisted vi.mock calls have run, so a
// test that mocks node:fs or node:fs/promises reaches the adapter too.
beforeAll(async () => {
  const { nodeFileSystem } = await import('./nodeFileSystem')
  installFileSystem(nodeFileSystem)
})
