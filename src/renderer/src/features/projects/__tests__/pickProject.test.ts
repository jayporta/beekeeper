import { describe, expect, it } from 'vitest'
import type { ProjectDto } from '../../../../../shared/ipc/projectDto'
import { pickProject } from '../pickProject'

const parent = (dirName: string): ProjectDto => ({ dirName, label: null, worktreeOf: null })
const worktree = (dirName: string, of: string): ProjectDto => ({
  dirName,
  label: null,
  worktreeOf: of
})

describe('pickProject', () => {
  it('returns null when there are no projects', () => {
    expect(pickProject([], 'a')).toBeNull()
    expect(pickProject([], null)).toBeNull()
  })

  it('keeps the stored selection when it is listed', () => {
    expect(pickProject([parent('a'), parent('b')], 'b')).toBe('b')
  })

  it('keeps a stored worktree folder', () => {
    expect(
      pickProject([parent('a'), worktree('a--claude-worktrees-x', 'a')], 'a--claude-worktrees-x')
    ).toBe('a--claude-worktrees-x')
  })

  it('falls back to the first parent project when nothing is stored', () => {
    expect(pickProject([parent('a'), parent('b')], null)).toBe('a')
  })

  it('falls back to the first parent project when the stored one is no longer listed', () => {
    expect(pickProject([parent('a'), parent('b')], 'gone')).toBe('a')
  })

  it('skips worktree folders when choosing the first parent', () => {
    expect(pickProject([worktree('a--claude-worktrees-x', 'b'), parent('b')], null)).toBe('b')
  })

  it('falls back to the first project when none is a parent', () => {
    expect(pickProject([worktree('w', 'missing')], null)).toBe('w')
  })
})
