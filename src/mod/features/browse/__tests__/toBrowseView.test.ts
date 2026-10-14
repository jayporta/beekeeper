import { describe, expect, it } from 'vitest'
import type { ProjectDto } from '../../../../shared/ipc/projectDto'
import { groupSessionRows } from '../../../../shared/sessions/groupSessionRows'
import { testAgentCountWords } from '../../../../shared/sessions/testAgentCountWords'
import { testSessionLabelWords } from '../../../../shared/sessions/testSessionLabelWords'
import {
  testLeadTeam,
  testRef,
  testSession,
  testTeammateTeam
} from '../../../../shared/sessions/testSessionFixtures'
import { testProject } from '../../../../shared/projects/testProject'
import { MAX_BROWSE_ROWS } from '../browseView'
import { browseProjects, browseRows } from '../toBrowseView'

const rowsOf = (
  ...items: Parameters<typeof groupSessionRows>[0]
): ReturnType<typeof groupSessionRows> => groupSessionRows(items, testSessionLabelWords)

describe('browseProjects', () => {
  it('lists each project followed by its worktrees, labelled with the parent and the worktree name', () => {
    const projects: ProjectDto[] = [
      { ...testProject('-a'), label: 'alpha' },
      testProject('-b'),
      { ...testProject('-a--claude-worktrees-x', { worktreeOf: '-a', worktreeName: 'x' }) }
    ]

    expect(browseProjects(projects)).toEqual([
      { dirName: '-a', label: 'alpha' },
      { dirName: '-a--claude-worktrees-x', label: 'alpha / x' },
      { dirName: '-b', label: '-b' }
    ])
  })

  it('cleans control characters out of a label', () => {
    const project: ProjectDto = { ...testProject('-a'), label: 'al\u001b[31mpha\u0007' }

    expect(browseProjects([project])[0]?.label).not.toContain('\u001b')
  })
})

describe('browseProjects memo', () => {
  it('builds the options once for the same list', () => {
    const projects: ProjectDto[] = [testProject('-a')]

    expect(browseProjects(projects)).toBe(browseProjects(projects))
  })
})

describe('browseRows', () => {
  it('indents a teammate under its lead and opens each row with its own folder', () => {
    const lead = testSession(1, {
      title: 'Lead',
      latestMs: 10,
      team: testLeadTeam([testRef(2, '-wt')])
    })
    const mate = testSession(2, {
      projectDirName: '-wt',
      latestMs: 5,
      team: testTeammateTeam(testRef(1))
    })

    const { rows, hiddenCount } = browseRows(rowsOf(lead, mate), testAgentCountWords)

    expect(hiddenCount).toBe(0)
    expect(rows.map((row) => [row.depth, row.ref])).toEqual([
      [0, testRef(1)],
      [1, testRef(2, '-wt')]
    ])
  })

  it('words the agents of a row and leaves them out when it has none', () => {
    const lead = testSession(1, { title: 'Lead', subagentCount: 2, latestMs: 2 })
    const plain = testSession(2, { title: 'Plain', latestMs: 1 })

    const { rows } = browseRows(rowsOf(lead, plain), testAgentCountWords)

    expect(rows.map((row) => row.agents)).toEqual(['2 subagents', null])
  })

  it('carries the figure the desktop card shows and the time it was last active', () => {
    const item = testSession(1, { title: 'T', totalTokens: 1234, latestMs: 99 })

    const { rows } = browseRows(rowsOf(item), testAgentCountWords)

    expect(rows[0]).toMatchObject({ tokens: 1234, lastActiveMs: 99 })
  })

  it('cleans control characters out of a label', () => {
    const item = testSession(1, { title: 'a\u001b[2Jb' })

    const { rows } = browseRows(rowsOf(item), testAgentCountWords)

    expect(rows[0]?.label).not.toContain('\u001b')
  })

  it('keeps the first rows up to the cap and counts the rest, teammates included', () => {
    const items = Array.from({ length: MAX_BROWSE_ROWS + 1 }, (_, i) =>
      testSession(i + 1, { title: `S${i}`, latestMs: 1000 - i })
    )

    const { rows, hiddenCount } = browseRows(rowsOf(...items), testAgentCountWords)

    expect(rows).toHaveLength(MAX_BROWSE_ROWS)
    expect(hiddenCount).toBe(1)
  })

  it("counts a lead's teammates against the cap", () => {
    const mates = Array.from({ length: MAX_BROWSE_ROWS }, (_, i) => testRef(i + 2))
    const lead = testSession(1, { title: 'Lead', latestMs: 1, team: testLeadTeam(mates) })
    const items = [
      lead,
      ...mates.map((_ref, i) =>
        testSession(i + 2, { title: `M${i}`, team: testTeammateTeam(testRef(1)) })
      )
    ]

    const { rows, hiddenCount } = browseRows(rowsOf(...items), testAgentCountWords)

    expect(rows).toHaveLength(MAX_BROWSE_ROWS)
    expect(hiddenCount).toBe(1)
  })
})
