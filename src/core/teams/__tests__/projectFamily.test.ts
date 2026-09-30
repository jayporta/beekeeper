import { describe, expect, it } from 'vitest'
import { toProjectDirName, type ProjectDirName } from '../../transcript/ids'
import { projectFamilyOf, worktreeParentOf } from '../projectFamily'

const names = (...raw: string[]): ProjectDirName[] => raw.map(toProjectDirName)
const dir = toProjectDirName
const listedSet = (...raw: string[]): ReadonlySet<ProjectDirName> => new Set(names(...raw))

describe('worktreeParentOf', () => {
  it('returns the listed parent of a worktree folder', () => {
    const listed = listedSet('-repo', '-repo--claude-worktrees-feat')

    expect(worktreeParentOf(dir('-repo--claude-worktrees-feat'), listed)).toBe('-repo')
  })

  it('returns null for a folder without the marker', () => {
    expect(worktreeParentOf(dir('-repo'), listedSet('-repo'))).toBeNull()
  })

  it('returns null when the parent is not listed', () => {
    expect(
      worktreeParentOf(
        dir('-repo--claude-worktrees-feat'),
        listedSet('-repo--claude-worktrees-feat')
      )
    ).toBeNull()
  })

  it('returns null when nothing follows the marker', () => {
    const listed = listedSet('-repo', '-repo--claude-worktrees-')

    expect(worktreeParentOf(dir('-repo--claude-worktrees-'), listed)).toBeNull()
  })

  it('takes the text before the first marker as the parent when the marker appears twice', () => {
    const name = dir('-repo--claude-worktrees-a--claude-worktrees-b')

    expect(worktreeParentOf(name, listedSet('-repo', '-repo--claude-worktrees-a', name))).toBe(
      '-repo'
    )
  })

  it('does not fall back to a later marker when the first parent is not listed', () => {
    const name = dir('-repo--claude-worktrees-a--claude-worktrees-b')

    expect(worktreeParentOf(name, listedSet('-repo--claude-worktrees-a', name))).toBeNull()
  })

  it('returns null for a folder that only shares a prefix with a listed folder', () => {
    expect(worktreeParentOf(dir('-repo-two'), listedSet('-repo', '-repo-two'))).toBeNull()
    expect(worktreeParentOf(dir('-repo--claude-worktree-x'), listedSet('-repo'))).toBeNull()
  })
})

describe('projectFamilyOf', () => {
  const listed = names('-other', '-repo', '-repo--claude-worktrees-a', '-repo--claude-worktrees-b')

  it('lists the base first, then its worktrees, when asked for the base', () => {
    expect(projectFamilyOf(dir('-repo'), listed)).toEqual([
      '-repo',
      '-repo--claude-worktrees-a',
      '-repo--claude-worktrees-b'
    ])
  })

  it('returns the same family when asked for a worktree folder', () => {
    expect(projectFamilyOf(dir('-repo--claude-worktrees-b'), listed)).toEqual(
      projectFamilyOf(dir('-repo'), listed)
    )
  })

  it('returns only the folder itself when it has no worktrees', () => {
    expect(projectFamilyOf(dir('-other'), listed)).toEqual(['-other'])
  })

  it('finds the family in a listing of thousands of folders, worktrees in listed order', () => {
    const others = Array.from({ length: 2000 }, (_, index) => `-other${index}`)
    const worktrees = ['c', 'a', 'b'].map((suffix) => `-repo--claude-worktrees-${suffix}`)
    const large = names(...others.slice(0, 1000), '-repo', ...worktrees, ...others.slice(1000))

    expect(projectFamilyOf(dir('-repo--claude-worktrees-a'), large)).toEqual([
      '-repo',
      ...worktrees
    ])
  })

  it('treats a worktree folder with no listed parent as its own family', () => {
    const orphan = dir('-gone--claude-worktrees-x')

    expect(projectFamilyOf(orphan, [...listed, orphan])).toEqual([orphan])
  })
})
