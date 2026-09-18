import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { commit, createTestRepo, runGitAllowingFailure, stageFile } from '../testGateFixture.mjs'

let activeRepo = null

afterEach(() => {
  activeRepo?.cleanup()
  activeRepo = null
})

describe('gate on merge', () => {
  it('lets a conflicted merge be concluded with a plain commit and no receipt, but still gates the next commit', () => {
    activeRepo = createTestRepo()
    const { repoDir } = activeRepo

    // Both branches add the same new path with different content, an
    // add/add conflict that needs manual resolution.
    runGitAllowingFailure(repoDir, ['checkout', '-q', '-b', 'feature'])
    stageFile(repoDir, 'shared.ts', 'export const shared = "feature"\n')
    runGitAllowingFailure(repoDir, ['commit', '-q', '-m', 'feature work', '--no-verify'])

    runGitAllowingFailure(repoDir, ['checkout', '-q', 'main'])
    stageFile(repoDir, 'shared.ts', 'export const shared = "main"\n')
    runGitAllowingFailure(repoDir, ['commit', '-q', '-m', 'mainline work', '--no-verify'])

    const mergeResult = runGitAllowingFailure(repoDir, ['merge', '--no-edit', 'feature'])
    expect(mergeResult.status).not.toBe(0)

    writeFileSync(join(repoDir, 'shared.ts'), 'export const shared = "resolved"\n')
    runGitAllowingFailure(repoDir, ['add', 'shared.ts'])

    const concludeResult = commit(repoDir, ['--no-edit'])
    expect(concludeResult.status).toBe(0)

    stageFile(repoDir, 'after-merge.ts', 'export const afterMerge = 1\n')
    const nextResult = commit(repoDir, ['-m', 'after merge'])

    expect(nextResult.status).not.toBe(0)
  })
})
