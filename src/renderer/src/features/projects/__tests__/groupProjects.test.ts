import { describe, expect, it } from 'vitest'
import type { ProjectDto } from '../../../../../shared/ipc/projectDto'
import { groupProjects } from '../groupProjects'

const parent = (dirName: string): ProjectDto => ({ dirName, worktreeOf: null })
const worktree = (dirName: string, of: string): ProjectDto => ({ dirName, worktreeOf: of })

describe('groupProjects', () => {
  it('returns no groups for no projects', () => {
    expect(groupProjects([])).toEqual([])
  })

  it('gives a parent with no worktrees an empty worktree list', () => {
    expect(groupProjects([parent('a')])).toEqual([{ project: parent('a'), worktrees: [] }])
  })

  it('places worktree folders under their parent, in input order', () => {
    const projects = [parent('a'), worktree('a-w2', 'a'), worktree('a-w1', 'a'), parent('b')]

    expect(groupProjects(projects)).toEqual([
      { project: parent('a'), worktrees: [worktree('a-w2', 'a'), worktree('a-w1', 'a')] },
      { project: parent('b'), worktrees: [] }
    ])
  })

  it('keeps a worktree whose parent is not listed as a top-level entry', () => {
    expect(groupProjects([worktree('w', 'missing')])).toEqual([
      { project: worktree('w', 'missing'), worktrees: [] }
    ])
  })

  it('never drops a project, even a worktree of a worktree', () => {
    const projects = [parent('a'), worktree('w1', 'a'), worktree('w2', 'w1')]
    const grouped = groupProjects(projects).flatMap((g) => [g.project, ...g.worktrees])

    expect(grouped).toHaveLength(3)
  })
})
