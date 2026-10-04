import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { IpcResult } from '../../../../../shared/ipc/ipcResult'
import type { ProjectTotalsDto } from '../../../../../shared/ipc/projectTotalsDto'
import { useSelectedProjectStore } from '@renderer/features/projects/state/useSelectedProjectStore'
import { installBeekeeperApi, testProject } from '@renderer/testBeekeeperApi'
import {
  createQueryWrapper,
  createTestQueryClient,
  refetchAndSettle
} from '@renderer/testQueryWrapper'
import { useTotalsWindowStore } from '../state/useTotalsWindowStore'
import { testTotals } from '../testTotals'
import { useProjectTotals } from '../useProjectTotals'

afterEach(() => {
  useTotalsWindowStore.setState({ window: '7d' })
  useSelectedProjectStore.setState({ selectedDirName: null })
})

type Reply = IpcResult<ProjectTotalsDto>
const ok = (tokens: number): Reply => ({ ok: true, value: testTotals({ tokens }) })

/** A reply that waits to be given. */
function deferred(): { promise: Promise<Reply>; settle: (reply: Reply) => void } {
  let settle: (reply: Reply) => void = () => {}
  const promise = new Promise<Reply>((resolve) => {
    settle = resolve
  })
  return { promise, settle }
}

const listing =
  (...dirs: string[]): (() => Promise<IpcResult<ReturnType<typeof testProject>[]>>) =>
  () =>
    Promise.resolve({ ok: true, value: dirs.map((dir) => testProject(dir)) })

describe('useProjectTotals', () => {
  it('has no folders until the project list loads', () => {
    installBeekeeperApi({ listProjects: () => new Promise(() => undefined) })

    const { result } = renderHook(() => useProjectTotals(), { wrapper: createQueryWrapper() })

    expect(result.current.byFolder.size).toBe(0)
  })

  it('asks for each listed folder, for the chosen window', async () => {
    const api = installBeekeeperApi({
      listProjects: listing('-a', '-b'),
      getProjectTotals: () => Promise.resolve(ok(1))
    })

    renderHook(() => useProjectTotals(), { wrapper: createQueryWrapper() })

    await waitFor(() => {
      expect(api.getProjectTotals.mock.calls.sort()).toEqual([
        ['-a', '7d'],
        ['-b', '7d']
      ])
    })
  })

  it('is loading, then ready with a folder’s totals', async () => {
    const reply = deferred()
    installBeekeeperApi({ listProjects: listing('-a'), getProjectTotals: () => reply.promise })
    const { result } = renderHook(() => useProjectTotals(), { wrapper: createQueryWrapper() })

    await waitFor(() => {
      expect(result.current.byFolder.get('-a')).toEqual({ status: 'loading' })
    })
    act(() => {
      reply.settle(ok(42))
    })

    await waitFor(() => {
      expect(result.current.byFolder.get('-a')).toMatchObject({
        status: 'ready',
        totals: { tokens: 42 },
        refreshing: false
      })
    })
  })

  it('reports a folder that failed with its code while the others are ready', async () => {
    installBeekeeperApi({
      listProjects: listing('-a', '-b'),
      getProjectTotals: (dir) =>
        Promise.resolve(dir === '-a' ? { ok: false, error: { code: 'unreadable' } } : ok(7))
    })

    const { result } = renderHook(() => useProjectTotals(), { wrapper: createQueryWrapper() })

    await waitFor(() => {
      expect(result.current.byFolder.get('-a')).toEqual({ status: 'error', code: 'unreadable' })
      expect(result.current.byFolder.get('-b')).toMatchObject({ status: 'ready' })
    })
  })

  it('keeps showing totals that were loaded when a background refresh fails', async () => {
    const client = createTestQueryClient()
    let fail = false
    installBeekeeperApi({
      listProjects: listing('-a'),
      getProjectTotals: () =>
        Promise.resolve(fail ? { ok: false, error: { code: 'unreadable' } } : ok(5))
    })
    const { result } = renderHook(() => useProjectTotals(), { wrapper: createQueryWrapper(client) })
    await waitFor(() => {
      expect(result.current.byFolder.get('-a')?.status).toBe('ready')
    })

    fail = true
    await refetchAndSettle(client, ['projectTotals'])

    expect(result.current.byFolder.get('-a')).toMatchObject({
      status: 'ready',
      totals: { tokens: 5 }
    })
  })
})

describe('useProjectTotals request limit', () => {
  const folders = ['-a', '-b', '-c', '-d', '-e']

  it('never has more than two folders in flight, and starts the next as one finishes', async () => {
    const replies = new Map(folders.map((dir) => [dir, deferred()]))
    let inFlight = 0
    let peak = 0
    const api = installBeekeeperApi({
      listProjects: listing(...folders),
      getProjectTotals: async (dir) => {
        inFlight += 1
        peak = Math.max(peak, inFlight)
        const reply = await replies.get(dir)?.promise
        inFlight -= 1
        return reply ?? ok(0)
      }
    })
    renderHook(() => useProjectTotals(), { wrapper: createQueryWrapper() })

    await waitFor(() => {
      expect(api.getProjectTotals).toHaveBeenCalledTimes(2)
    })
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(api.getProjectTotals).toHaveBeenCalledTimes(2)

    act(() => {
      replies.get('-a')?.settle(ok(1))
    })
    await waitFor(() => {
      expect(api.getProjectTotals).toHaveBeenCalledTimes(3)
    })
    for (const reply of replies.values()) act(() => reply.settle(ok(1)))
    await waitFor(() => {
      expect(api.getProjectTotals).toHaveBeenCalledTimes(5)
    })
    expect(peak).toBe(2)
  })

  it('asks for the selected folder first, then the rest in list order', async () => {
    useSelectedProjectStore.setState({ selectedDirName: '-d' })
    const api = installBeekeeperApi({
      listProjects: listing(...folders),
      getProjectTotals: () => Promise.resolve(ok(1))
    })

    renderHook(() => useProjectTotals(), { wrapper: createQueryWrapper() })

    await waitFor(() => {
      expect(api.getProjectTotals).toHaveBeenCalledTimes(5)
    })
    expect(api.getProjectTotals.mock.calls.map(([dir]) => dir)).toEqual([
      '-d',
      '-a',
      '-b',
      '-c',
      '-e'
    ])
  })

  it('starts no folder that was still waiting when nothing shows the totals any more', async () => {
    const reply = deferred()
    const api = installBeekeeperApi({
      listProjects: listing(...folders),
      getProjectTotals: () => reply.promise
    })
    const { unmount } = renderHook(() => useProjectTotals(), { wrapper: createQueryWrapper() })
    await waitFor(() => {
      expect(api.getProjectTotals).toHaveBeenCalledTimes(2)
    })

    unmount()
    reply.settle(ok(1))
    await new Promise((resolve) => setTimeout(resolve, 30))

    expect(api.getProjectTotals).toHaveBeenCalledTimes(2)
  })

  it('asks once for a folder two readers show, as the sidebar and the overview do', async () => {
    const api = installBeekeeperApi({
      listProjects: listing('-a', '-b'),
      getProjectTotals: () => Promise.resolve(ok(1))
    })
    const wrapper = createQueryWrapper()

    renderHook(() => useProjectTotals(), { wrapper })
    renderHook(() => useProjectTotals(), { wrapper })

    await waitFor(() => {
      expect(api.getProjectTotals).toHaveBeenCalledTimes(2)
    })
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(api.getProjectTotals).toHaveBeenCalledTimes(2)
  })
})

describe('useProjectTotals window', () => {
  it('shows the other window’s figures, marked refreshing, until the new window’s arrive', async () => {
    const thirty = deferred()
    installBeekeeperApi({
      listProjects: listing('-a'),
      getProjectTotals: (_dir, window) =>
        window === '7d' ? Promise.resolve(ok(7)) : thirty.promise
    })
    const { result } = renderHook(() => useProjectTotals(), { wrapper: createQueryWrapper() })
    await waitFor(() => {
      expect(result.current.byFolder.get('-a')?.status).toBe('ready')
    })

    act(() => {
      useTotalsWindowStore.getState().setWindow('30d')
    })

    expect(result.current.window).toBe('30d')
    expect(result.current.byFolder.get('-a')).toMatchObject({
      status: 'ready',
      totals: { tokens: 7 },
      refreshing: true
    })
    act(() => {
      thirty.settle(ok(30))
    })
    await waitFor(() => {
      expect(result.current.byFolder.get('-a')).toMatchObject({
        totals: { tokens: 30 },
        refreshing: false
      })
    })
  })

  it('is loading, not another window’s figures, for a window nothing was ever cached for', async () => {
    const seven = deferred()
    installBeekeeperApi({ listProjects: listing('-a'), getProjectTotals: () => seven.promise })
    const { result } = renderHook(() => useProjectTotals(), { wrapper: createQueryWrapper() })

    await waitFor(() => {
      expect(result.current.byFolder.get('-a')).toEqual({ status: 'loading' })
    })
    act(() => {
      useTotalsWindowStore.getState().setWindow('30d')
    })

    expect(result.current.byFolder.get('-a')).toEqual({ status: 'loading' })
  })

  it('shows a window both windows loaded before at once, without asking again while fresh', async () => {
    const api = installBeekeeperApi({
      listProjects: listing('-a'),
      getProjectTotals: (_dir, window) => Promise.resolve(ok(window === '7d' ? 7 : 30))
    })
    const { result } = renderHook(() => useProjectTotals(), { wrapper: createQueryWrapper() })
    await waitFor(() => {
      expect(result.current.byFolder.get('-a')).toMatchObject({ totals: { tokens: 7 } })
    })
    act(() => {
      useTotalsWindowStore.getState().setWindow('30d')
    })
    await waitFor(() => {
      expect(result.current.byFolder.get('-a')).toMatchObject({
        totals: { tokens: 30 },
        refreshing: false
      })
    })

    act(() => {
      useTotalsWindowStore.getState().setWindow('7d')
    })

    expect(result.current.byFolder.get('-a')).toMatchObject({
      totals: { tokens: 7 },
      refreshing: false
    })
    expect(api.getProjectTotals).toHaveBeenCalledTimes(2)
  })
})
