import { describe, expect, it } from 'vitest'
import { groupProjects } from '../../../../../shared/projects/groupProjects'
import { testProject } from '../../../../../shared/projects/testProject'
import { LOADING } from '../../../../../shared/overview/folderTotalsState'
import type { ProjectGroupItem } from '../useProjectGroupTotals'
import { PROJECT_SORT_KEYS, sortProjects, type ProjectSortKey } from '../sortProjects'
import { sumTotals } from '../../../../../shared/overview/sumTotals'
import { readyTotals } from '../../../../../shared/overview/testTotals'

interface ItemSpec {
  readonly dir: string
  readonly label?: string
  readonly tokens?: number
  readonly latestMs?: number
  /** `loading` or `error` instead of totals. */
  readonly state?: 'loading' | 'error'
}

function item({ dir, label, tokens = 0, latestMs, state }: ItemSpec): ProjectGroupItem {
  const [group] = groupProjects([{ ...testProject(dir), label: label ?? null }])
  if (group === undefined) throw new Error('no group')
  const folder =
    state === 'loading'
      ? LOADING
      : state === 'error'
        ? ({ status: 'error', code: 'unreadable' } as const)
        : readyTotals({
            tokens,
            latest: latestMs === undefined ? null : { sessionId: dir, title: null, latestMs }
          })
  return { group, totals: sumTotals([folder]) }
}

function order(items: readonly ProjectGroupItem[], key: ProjectSortKey): string[] {
  return sortProjects(items, key).map(({ group }) => group.project.dirName)
}

describe('sortProjects', () => {
  it('lists the sort keys in the order the menu offers them, tokens first', () => {
    expect(PROJECT_SORT_KEYS).toEqual(['tokens', 'latest', 'name'])
  })

  it('sorts by tokens, most first, breaking ties by folder name', () => {
    const items = [
      item({ dir: 'c', tokens: 5 }),
      item({ dir: 'b', tokens: 9 }),
      item({ dir: 'a', tokens: 5 })
    ]

    expect(order(items, 'tokens')).toEqual(['b', 'a', 'c'])
  })

  it('sorts by latest session, newest first, with projects that have none after those that do', () => {
    const items = [
      item({ dir: 'none' }),
      item({ dir: 'old', latestMs: 1 }),
      item({ dir: 'new', latestMs: 9 })
    ]

    expect(order(items, 'latest')).toEqual(['new', 'old', 'none'])
  })

  it('sorts by name, ignoring case, using the title the project shows', () => {
    const items = [
      item({ dir: '1', label: 'beta' }),
      item({ dir: '2', label: 'Alpha' }),
      item({ dir: '3', label: 'gamma' })
    ]

    expect(order(items, 'name')).toEqual(['2', '1', '3'])
  })

  it('breaks a tie between same-named projects by folder name, whatever order they came in', () => {
    const same = [item({ dir: 'z', label: 'app' }), item({ dir: 'a', label: 'app' })]

    expect(order(same, 'name')).toEqual(['a', 'z'])
    expect(order([...same].reverse(), 'name')).toEqual(['a', 'z'])
  })

  it.each(['tokens', 'latest'] as const)(
    'puts projects still loading or failed last, in the order given, when sorting by %s',
    (key) => {
      const items = [
        item({ dir: 'loading', state: 'loading' }),
        item({ dir: 'big', tokens: 9, latestMs: 9 }),
        item({ dir: 'failed', state: 'error' }),
        item({ dir: 'small', tokens: 1, latestMs: 1 })
      ]

      expect(order(items, key)).toEqual(['big', 'small', 'loading', 'failed'])
    }
  )

  it('sorts a project still loading by its name with the rest when sorting by name', () => {
    const items = [item({ dir: 'b', label: 'b' }), item({ dir: 'a', label: 'a', state: 'loading' })]

    expect(order(items, 'name')).toEqual(['a', 'b'])
  })

  it('does not change the list it is given', () => {
    const items = [item({ dir: 'a', tokens: 1 }), item({ dir: 'b', tokens: 2 })]

    sortProjects(items, 'tokens')

    expect(items.map(({ group }) => group.project.dirName)).toEqual(['a', 'b'])
  })

  it('returns an empty list for no projects', () => {
    expect(sortProjects([], 'name')).toEqual([])
  })
})
