import { afterEach, describe, expect, it } from 'vitest'
import { commit, createTestRepo, createWorktree, runCli, stageFile } from '../testGateFixture.mjs'

let activeRepo = null
let activeWorktree = null

afterEach(() => {
  activeWorktree?.cleanup()
  activeWorktree = null
  activeRepo?.cleanup()
  activeRepo = null
})

describe('gate in a linked worktree', () => {
  it('blocks a commit in a linked worktree when no receipt was recorded there', () => {
    activeRepo = createTestRepo()
    activeWorktree = createWorktree(activeRepo.repoDir, 'feature')
    stageFile(activeWorktree.worktreeDir, 'src/main/foo.ts', 'export const foo = 1\n')

    const result = commit(activeWorktree.worktreeDir)

    expect(result.status).not.toBe(0)
  })

  it('allows a commit in a linked worktree once a receipt is recorded inside it', () => {
    activeRepo = createTestRepo()
    activeWorktree = createWorktree(activeRepo.repoDir, 'feature')
    stageFile(activeWorktree.worktreeDir, 'src/main/foo.ts', 'export const foo = 1\n')
    runCli('record', activeWorktree.worktreeDir)

    const result = commit(activeWorktree.worktreeDir)

    expect(result.status).toBe(0)
  })
})
