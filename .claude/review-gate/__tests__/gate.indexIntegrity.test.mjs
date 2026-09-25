import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  commit,
  createTestRepo,
  createWorktree,
  runCli,
  runGit,
  stageFile
} from '../testGateFixture.mjs'

let activeRepo = null
let activeWorktree = null

afterEach(() => {
  activeWorktree?.cleanup()
  activeWorktree = null
  activeRepo?.cleanup()
  activeRepo = null
})

describe('gate index integrity', () => {
  it('blocks git commit -a when it would stage more than what was recorded', () => {
    activeRepo = createTestRepo()
    stageFile(activeRepo.repoDir, 'src/main/foo.ts', 'export const foo = 1\n')
    runCli('record', activeRepo.repoDir)
    // Tracked from the initial commit; an unstaged edit that -a would sweep in.
    writeFileSync(join(activeRepo.repoDir, 'README.md'), 'unstaged edit\n')

    const result = commit(activeRepo.repoDir, ['-a', '-m', 'x'])

    expect(result.status).not.toBe(0)
  })

  it('blocks a pathspec commit that would commit less than what was recorded', () => {
    activeRepo = createTestRepo()
    stageFile(activeRepo.repoDir, 'src/main/foo.ts', 'export const foo = 1\n')
    stageFile(activeRepo.repoDir, 'src/main/bar.ts', 'export const bar = 2\n')
    runCli('record', activeRepo.repoDir)

    const result = commit(activeRepo.repoDir, ['-m', 'x', '--', 'src/main/foo.ts'])

    expect(result.status).not.toBe(0)
  })

  it('blocks a commit against a custom GIT_INDEX_FILE with no matching receipt', () => {
    activeRepo = createTestRepo()
    const customIndex = join(activeRepo.repoDir, '.git', 'custom-index')
    const env = { GIT_INDEX_FILE: customIndex }
    writeFileSync(join(activeRepo.repoDir, 'custom.ts'), 'export const custom = 1\n')
    runGit(activeRepo.repoDir, ['add', 'custom.ts'], env)

    const result = commit(activeRepo.repoDir, ['-m', 'x'], env)

    expect(result.status).not.toBe(0)
  })

  it('allows a commit against a custom GIT_INDEX_FILE once its own receipt is recorded', () => {
    activeRepo = createTestRepo()
    const customIndex = join(activeRepo.repoDir, '.git', 'custom-index')
    const env = { GIT_INDEX_FILE: customIndex }
    writeFileSync(join(activeRepo.repoDir, 'custom.ts'), 'export const custom = 1\n')
    runGit(activeRepo.repoDir, ['add', 'custom.ts'], env)
    runCli('record', activeRepo.repoDir, env)

    const result = commit(activeRepo.repoDir, ['-m', 'x'], env)

    expect(result.status).toBe(0)
  })

  it('does not leak the hook’s GIT_INDEX_FILE into a check script, so its own git add cannot sneak content into the commit', () => {
    activeRepo = createTestRepo({ scriptOverrides: { test: 'git add sneaked.ts' } })
    activeWorktree = createWorktree(activeRepo.repoDir, 'feature')
    const { worktreeDir } = activeWorktree

    // Untracked on purpose; only the (potentially leaking) check script adds it.
    writeFileSync(join(worktreeDir, 'sneaked.ts'), 'export const sneaked = true\n')
    stageFile(worktreeDir, 'src/main/foo.ts', 'export const foo = 1\n')
    runCli('record', worktreeDir)
    const headBefore = runGit(worktreeDir, ['rev-parse', 'HEAD'])

    // -a always builds a temporary index for the hook to see, distinct
    // from the persistent one, even when there's nothing extra to sweep in.
    const result = commit(worktreeDir, ['-a', '-m', 'x'])

    if (result.status === 0) {
      const files = runGit(worktreeDir, ['show', '--name-only', '--format=', 'HEAD'])
        .split('\n')
        .filter(Boolean)
      expect(files).not.toContain('sneaked.ts')
    } else {
      expect(runGit(worktreeDir, ['rev-parse', 'HEAD'])).toBe(headBefore)
    }
  })
})
