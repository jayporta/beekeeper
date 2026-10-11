import { beforeAll } from 'vitest'
import { installFileSystem } from '../installFileSystem'
import { installProcessPort } from '../installProcessPort'

// Imported lazily, after a test file's hoisted vi.mock calls have run, so a
// test that mocks a node module reaches the adapters too.
beforeAll(async () => {
  const { nodeFileSystem } = await import('./nodeFileSystem')
  const { nodeProcess } = await import('./nodeProcess')
  installFileSystem(nodeFileSystem)
  installProcessPort(nodeProcess)
})
