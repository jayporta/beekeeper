import { describe, expect, it } from 'vitest'
import { testProject } from '@renderer/testBeekeeperApi'
import { parentProject } from '../parentProject'

const parent = testProject('a')
const worktree = testProject('a-w', { worktreeOf: 'a', worktreeName: 'w' })

describe('parentProject', () => {
  it('finds the parent a worktree is grouped under', () => {
    expect(parentProject([parent, worktree], worktree)).toBe(parent)
  })

  it('returns null for a top-level project', () => {
    expect(parentProject([parent, worktree], parent)).toBeNull()
  })

  it('returns null for a worktree whose parent is not listed', () => {
    expect(parentProject([worktree], worktree)).toBeNull()
  })
})
