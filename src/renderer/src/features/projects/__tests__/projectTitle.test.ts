import { describe, expect, it } from 'vitest'
import { testProject } from '@renderer/testBeekeeperApi'
import { projectTitle } from '../projectTitle'

describe('projectTitle', () => {
  it("is a worktree folder's own name", () => {
    const worktree = { ...testProject('a-w', { worktreeOf: 'a', worktreeName: 'w' }), label: 'A' }

    expect(projectTitle(worktree)).toBe('w')
  })

  it('falls back to the project label, then the folder name', () => {
    expect(projectTitle({ ...testProject('a'), label: 'A' })).toBe('A')
    expect(projectTitle(testProject('a'))).toBe('a')
  })
})
