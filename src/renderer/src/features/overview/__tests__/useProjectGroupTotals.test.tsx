import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { IpcResult } from '../../../../../shared/ipc/ipcResult'
import type { ProjectTotalsDto } from '../../../../../shared/ipc/projectTotalsDto'
import { useSelectedProjectStore } from '@renderer/features/projects/state/useSelectedProjectStore'
import { installBeekeeperApi, testProject } from '@renderer/testBeekeeperApi'
import { createQueryWrapper } from '@renderer/testQueryWrapper'
import { useTotalsWindowStore } from '../state/useTotalsWindowStore'
import { listing } from '../testProjectListing'
import { testTotals } from '../testTotals'
import { useProjectGroupTotals } from '../useProjectGroupTotals'

afterEach(() => {
  useTotalsWindowStore.setState({ window: '7d' })
  useSelectedProjectStore.setState({ selectedDirName: null })
})

const tokensByFolder =
  (tokens: Record<string, number>) =>
  (dir: string): Promise<IpcResult<ProjectTotalsDto>> =>
    Promise.resolve({ ok: true, value: testTotals({ tokens: tokens[dir] ?? 0 }) })

describe('useProjectGroupTotals', () => {
  it('has no project list and no items while the listing loads', () => {
    installBeekeeperApi({ listProjects: () => new Promise(() => undefined) })

    const { result } = renderHook(() => useProjectGroupTotals(), { wrapper: createQueryWrapper() })

    expect(result.current.projects).toBeUndefined()
    expect(result.current.items).toEqual([])
  })

  it('adds a project and its worktree into one item, and the whole to the same figure', async () => {
    installBeekeeperApi({
      listProjects: () =>
        Promise.resolve({
          ok: true,
          value: [testProject('-a'), testProject('-a-wt', { worktreeOf: '-a', worktreeName: 'wt' })]
        }),
      getProjectTotals: tokensByFolder({ '-a': 10, '-a-wt': 5 })
    })

    const { result } = renderHook(() => useProjectGroupTotals(), { wrapper: createQueryWrapper() })

    await waitFor(() => {
      expect(result.current.overall.tokens).toBe(15)
    })
    expect(result.current.items).toHaveLength(1)
    expect(result.current.items[0]?.group.project.dirName).toBe('-a')
    expect(result.current.items[0]?.totals.tokens).toBe(15)
  })

  it('lists projects in order, with the whole adding up every one', async () => {
    installBeekeeperApi({
      listProjects: listing('-a', '-b'),
      getProjectTotals: tokensByFolder({ '-a': 3, '-b': 4 })
    })

    const { result } = renderHook(() => useProjectGroupTotals(), { wrapper: createQueryWrapper() })

    await waitFor(() => {
      expect(result.current.overall.tokens).toBe(7)
    })
    expect(result.current.items.map(({ group }) => group.project.dirName)).toEqual(['-a', '-b'])
    expect(result.current.items.map(({ totals }) => totals.tokens)).toEqual([3, 4])
  })

  it('keeps the same items and overall across a render that changes nothing', async () => {
    installBeekeeperApi({
      listProjects: listing('-a', '-b'),
      getProjectTotals: tokensByFolder({ '-a': 3, '-b': 4 })
    })
    const { result, rerender } = renderHook(() => useProjectGroupTotals(), {
      wrapper: createQueryWrapper()
    })
    await waitFor(() => {
      expect(result.current.overall.tokens).toBe(7)
    })
    const { items, overall } = result.current

    rerender()

    expect(result.current.items).toBe(items)
    expect(result.current.overall).toBe(overall)
  })
})
