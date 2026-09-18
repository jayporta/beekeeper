import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { commit, createTestRepo, runCli, stageFile } from '../testGateFixture.mjs'

let activeRepo = null

afterEach(() => {
  activeRepo?.cleanup()
  activeRepo = null
})

describe('gate receipt lifecycle', () => {
  it('blocks a commit when no receipt has been recorded', () => {
    activeRepo = createTestRepo()
    stageFile(activeRepo.repoDir, 'src/main/foo.ts', 'export const foo = 1\n')

    const result = commit(activeRepo.repoDir)

    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('code-reviewer')
    expect(result.stderr).toContain('security-reviewer')
  })

  it('allows the commit once review:record has run and the checks pass', () => {
    activeRepo = createTestRepo()
    stageFile(activeRepo.repoDir, 'src/main/foo.ts', 'export const foo = 1\n')

    const recorded = runCli('record', activeRepo.repoDir)
    expect(recorded.status).toBe(0)

    const result = commit(activeRepo.repoDir)
    expect(result.status).toBe(0)
  })

  it('blocks a further staged change after the previous receipt was recorded', () => {
    activeRepo = createTestRepo()
    stageFile(activeRepo.repoDir, 'src/main/foo.ts', 'export const foo = 1\n')
    runCli('record', activeRepo.repoDir)
    expect(commit(activeRepo.repoDir).status).toBe(0)

    stageFile(activeRepo.repoDir, 'src/main/bar.ts', 'export const bar = 2\n')
    const result = commit(activeRepo.repoDir, ['-m', 'second'])

    expect(result.status).not.toBe(0)
  })

  it('blocks the commit when a required check fails', () => {
    activeRepo = createTestRepo({ failingScript: 'lint' })
    stageFile(activeRepo.repoDir, 'src/main/foo.ts', 'export const foo = 1\n')
    runCli('record', activeRepo.repoDir)

    const result = commit(activeRepo.repoDir)

    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('npm run lint')
  })

  it('blocks the commit when a tracked file has unstaged changes', () => {
    activeRepo = createTestRepo()
    stageFile(activeRepo.repoDir, 'src/main/bar.ts', 'export const bar = 2\n')
    runCli('record', activeRepo.repoDir)
    // README.md is tracked from the initial commit; edit it without staging.
    writeFileSync(join(activeRepo.repoDir, 'README.md'), 'unstaged edit\n')

    const result = commit(activeRepo.repoDir)

    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('Unstaged changes')
  })

  it('allows a docs-only commit without any receipt', () => {
    activeRepo = createTestRepo()
    stageFile(activeRepo.repoDir, 'NOTES.md', 'notes\n')

    const result = commit(activeRepo.repoDir)

    expect(result.status).toBe(0)
  })
})
