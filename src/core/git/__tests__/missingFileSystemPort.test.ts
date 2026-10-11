import { afterEach, describe, expect, it, vi } from 'vitest'
import { toGitBinary } from '../gitBinary'

// A missing port is a startup bug. These flows catch filesystem failures, so
// each must let the port error out instead of turning it into a verdict.
describe('core git without an installed file system port', () => {
  afterEach(() => {
    vi.resetModules()
  })

  it('makes resolveInside reject, naming installFileSystem', async () => {
    vi.resetModules()
    const fresh = await import('../resolveInside')

    await expect(fresh.resolveInside({ root: '/repo', path: '/repo/a' })).rejects.toThrow(
      /installFileSystem/
    )
  })

  it('makes checkWorktree reject, naming installFileSystem', async () => {
    vi.resetModules()
    const fresh = await import('../worktreeSafety')

    await expect(
      fresh.checkWorktree({
        git: toGitBinary('/fake/git'),
        repoDir: '/repo',
        worktreeDir: '/worktree',
        agentBranch: 'agent'
      })
    ).rejects.toThrow(/installFileSystem/)
  })
})
