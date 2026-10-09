import { describe, expect, it } from 'vitest'
import type { FilesChangedDto } from '../../../../../shared/ipc/filesChangedDto'
import { testProject } from '@renderer/testBeekeeperApi'
import { familyOf, invalidationPlan } from '../invalidationPlan'

const BASE = '-Users-a-repo'
const WORKTREE = '-Users-a-repo--claude-worktrees-feature'
const OTHER = '-Users-b-other'
const projects = [
  testProject(BASE),
  testProject(WORKTREE, { worktreeOf: BASE, worktreeName: 'feature' }),
  testProject(OTHER)
]

const change = (
  dirNames: string[],
  flags: { foldersChanged?: boolean; all?: boolean } = {}
): FilesChangedDto => ({
  dirNames,
  foldersChanged: flags.foldersChanged ?? false,
  all: flags.all ?? false
})

describe('familyOf', () => {
  it('names the parent for a worktree folder', () => {
    expect(familyOf(WORKTREE, projects)).toBe(BASE)
  })

  it('names the folder itself for a base folder', () => {
    expect(familyOf(BASE, projects)).toBe(BASE)
  })

  it('names the folder itself when it is not listed', () => {
    expect(familyOf('-Users-new', projects)).toBe('-Users-new')
  })

  it('names the folder itself when no projects are loaded', () => {
    expect(familyOf(WORKTREE, undefined)).toBe(WORKTREE)
  })
})

describe('invalidationPlan', () => {
  it('plans the parent family for a change in a worktree folder', () => {
    expect(invalidationPlan(change([WORKTREE]), projects).families).toEqual(new Set([BASE]))
  })

  it('plans a base folder as its own family', () => {
    expect(invalidationPlan(change([BASE]), projects).families).toEqual(new Set([BASE]))
  })

  it('merges the families of several folders', () => {
    const plan = invalidationPlan(change([WORKTREE, BASE, OTHER]), projects)
    expect(plan.families).toEqual(new Set([BASE, OTHER]))
  })

  it('marks the totals of the changed folders, not their families', () => {
    const plan = invalidationPlan(change([WORKTREE]), projects)
    expect(plan.staleTotals).toEqual(new Set([WORKTREE]))
  })

  it('leaves the project list alone for a change in a listed folder', () => {
    expect(invalidationPlan(change([BASE]), projects).projects).toBe(false)
  })

  it('refetches the project list for a folder it does not know', () => {
    const plan = invalidationPlan(change(['-Users-new']), projects)
    expect(plan.projects).toBe(true)
    expect(plan.families).toEqual(new Set(['-Users-new']))
  })

  it('refetches the project list when no projects are loaded yet', () => {
    expect(invalidationPlan(change([BASE]), undefined).projects).toBe(true)
  })

  it('refetches the project list when a folder itself changed', () => {
    const plan = invalidationPlan(change([BASE], { foldersChanged: true }), projects)
    expect(plan.projects).toBe(true)
    expect(plan.families).toEqual(new Set([BASE]))
  })

  it('plans everything for an all change', () => {
    expect(invalidationPlan(change([], { all: true }), projects)).toEqual({
      projects: true,
      families: 'all',
      staleTotals: 'all'
    })
  })

  it('plans nothing for an empty change', () => {
    expect(invalidationPlan(change([]), projects)).toEqual({
      projects: false,
      families: new Set(),
      staleTotals: new Set()
    })
  })
})
