import { describe, expect, it } from 'vitest'
import { testProject } from '@renderer/testBeekeeperApi'
import { worktreeShortName } from '../worktreeShortName'

describe('worktreeShortName', () => {
  it('is the part of the folder name after the worktree marker', () => {
    const worktree = testProject('-Users-a-alpha--claude-worktrees-fix-login', '-Users-a-alpha')

    expect(worktreeShortName(worktree)).toBe('fix-login')
  })

  it('keeps everything after the first marker', () => {
    const worktree = testProject('-a--claude-worktrees-x--claude-worktrees-y', '-a')

    expect(worktreeShortName(worktree)).toBe('x--claude-worktrees-y')
  })

  it('falls back to the label when the folder name has no marker', () => {
    const worktree = { ...testProject('-Users-a-alpha-x', '-Users-a-alpha'), label: 'x' }

    expect(worktreeShortName(worktree)).toBe('x')
  })

  it('falls back to the folder name when there is no marker or label', () => {
    expect(worktreeShortName(testProject('-Users-a-alpha-x', '-Users-a-alpha'))).toBe(
      '-Users-a-alpha-x'
    )
  })

  it('falls back when nothing follows the marker', () => {
    expect(worktreeShortName(testProject('-Users-a-alpha--claude-worktrees-'))).toBe(
      '-Users-a-alpha--claude-worktrees-'
    )
  })
})
