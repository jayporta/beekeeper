import { describe, expect, it } from 'vitest'
import type { ProjectDto } from '../../../../../shared/ipc/projectDto'
import { groupProjects } from '@renderer/features/projects/groupProjects'
import type { FolderTotalsState } from '../folderTotalsState'
import { overviewTotals, projectTotalsOf } from '../projectTotalsOf'
import { readyTotals } from '../testTotals'

const folder = (dirName: string, worktreeOf: string | null = null): ProjectDto => ({
  dirName,
  label: null,
  worktreeOf,
  worktreeName: worktreeOf === null ? null : 'wt'
})
const states = (entries: [string, FolderTotalsState][]): ReadonlyMap<string, FolderTotalsState> =>
  new Map(entries)

describe('projectTotalsOf', () => {
  const [group] = groupProjects([folder('-a'), folder('-a--wt1', '-a'), folder('-a--wt2', '-a')])

  it('adds a project’s own folder to its worktree folders', () => {
    const byFolder = states([
      ['-a', readyTotals({ tokens: 100, sessions: 1 })],
      ['-a--wt1', readyTotals({ tokens: 20, sessions: 2 })],
      ['-a--wt2', readyTotals({ tokens: 3, sessions: 4 })]
    ])

    expect(projectTotalsOf(group!, byFolder)).toMatchObject({ tokens: 123, sessions: 7 })
  })

  it('counts a folder with no entry yet as loading', () => {
    const byFolder = states([['-a', readyTotals({ tokens: 100 })]])

    expect(projectTotalsOf(group!, byFolder).folders).toEqual({ ready: 1, loading: 2, failed: 0 })
  })

  it('counts a failed worktree folder, keeping the others’ figures', () => {
    const byFolder = states([
      ['-a', readyTotals({ tokens: 100 })],
      ['-a--wt1', { status: 'error', code: 'not-found' }],
      ['-a--wt2', readyTotals({ tokens: 5 })]
    ])

    expect(projectTotalsOf(group!, byFolder)).toMatchObject({
      tokens: 105,
      folders: { ready: 2, loading: 0, failed: 1 }
    })
  })

  it('treats a worktree whose parent is not listed as its own project', () => {
    const [orphan] = groupProjects([folder('-b--wt', '-b')])

    expect(projectTotalsOf(orphan!, states([['-b--wt', readyTotals({ tokens: 9 })]])).tokens).toBe(
      9
    )
  })
})

describe('overviewTotals', () => {
  it('adds every folder of every project', () => {
    const groups = groupProjects([folder('-a'), folder('-a--wt', '-a'), folder('-b')])
    const byFolder = states([
      ['-a', readyTotals({ tokens: 1, agents: 1 })],
      ['-a--wt', readyTotals({ tokens: 10, agents: 10 })],
      ['-b', readyTotals({ tokens: 100, agents: 100 })]
    ])

    expect(overviewTotals(groups, byFolder)).toMatchObject({ tokens: 111, agents: 111 })
  })

  it('is empty for no projects', () => {
    expect(overviewTotals([], states([])).folders).toEqual({ ready: 0, loading: 0, failed: 0 })
  })
})
