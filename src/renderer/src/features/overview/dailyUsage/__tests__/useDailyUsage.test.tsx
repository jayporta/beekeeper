import { QueryObserver } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { IpcResult } from '../../../../../../shared/ipc/ipcResult'
import type { ProjectDailyUsageDto } from '../../../../../../shared/ipc/projectDailyUsageDto'
import { installBeekeeperApi } from '@renderer/testBeekeeperApi'
import { createQueryWrapper, createTestQueryClient } from '@renderer/testQueryWrapper'
import { useTotalsWindowStore } from '../../state/useTotalsWindowStore'
import { listing } from '../../testProjectListing'
import { useDailyUsage } from '../useDailyUsage'
import { dayKeys, testDailyUsage } from '../testDailyUsage'

afterEach(() => {
  useTotalsWindowStore.setState({ window: '7d' })
  vi.useRealTimers()
})

type Reply = IpcResult<ProjectDailyUsageDto>

/** A reply of `tokens` on each of `count` days ending 2026-03-10. */
const replyOf = (tokens: number, count = 7): Reply => ({
  ok: true,
  value: testDailyUsage(
    Object.fromEntries(dayKeys(count, '2026-03-10').map((day) => [day, { a: tokens }]))
  )
})

function deferred(): { promise: Promise<Reply>; settle: (reply: Reply) => void } {
  let settle: (reply: Reply) => void = () => {}
  const promise = new Promise<Reply>((resolve) => {
    settle = resolve
  })
  return { promise, settle }
}

const settleMicrotasks = (ms = 20): Promise<void> => new Promise((r) => setTimeout(r, ms))

describe('useDailyUsage', () => {
  it('has no days until the project list loads', () => {
    installBeekeeperApi({ listProjects: () => new Promise(() => undefined) })

    const { result } = renderHook(() => useDailyUsage(), { wrapper: createQueryWrapper() })

    expect(result.current.summary.days).toEqual([])
  })

  it('asks for each listed folder, for the chosen window', async () => {
    const api = installBeekeeperApi({
      listProjects: listing('-a', '-b'),
      getProjectDailyUsage: () => Promise.resolve(replyOf(1))
    })

    renderHook(() => useDailyUsage(), { wrapper: createQueryWrapper() })

    await waitFor(() => {
      expect(api.getProjectDailyUsage.mock.calls.sort()).toEqual([
        ['-a', '7d'],
        ['-b', '7d']
      ])
    })
  })

  it('sums the folders over the window’s seven days', async () => {
    installBeekeeperApi({
      listProjects: listing('-a', '-b'),
      getProjectDailyUsage: (dir) => Promise.resolve(replyOf(dir === '-a' ? 1 : 2))
    })

    const { result } = renderHook(() => useDailyUsage(), { wrapper: createQueryWrapper() })

    await waitFor(() => {
      expect(result.current.summary).toMatchObject({ total: 21, loading: 0, failed: 0 })
    })
    expect(result.current.window).toBe('7d')
    expect(result.current.summary.days).toHaveLength(7)
  })

  it('counts a folder that failed while the others are ready', async () => {
    installBeekeeperApi({
      listProjects: listing('-a', '-b'),
      getProjectDailyUsage: (dir) =>
        Promise.resolve(dir === '-a' ? { ok: false, error: { code: 'unreadable' } } : replyOf(1))
    })

    const { result } = renderHook(() => useDailyUsage(), { wrapper: createQueryWrapper() })

    await waitFor(() => {
      expect(result.current.summary).toMatchObject({ failed: 1, loading: 0, total: 7 })
    })
  })

  it('counts a folder still loading', async () => {
    const reply = deferred()
    installBeekeeperApi({ listProjects: listing('-a'), getProjectDailyUsage: () => reply.promise })

    const { result } = renderHook(() => useDailyUsage(), { wrapper: createQueryWrapper() })

    await waitFor(() => {
      expect(result.current.summary.loading).toBe(1)
    })
  })

  it('asks again for the 30 day window and sums thirty days', async () => {
    const api = installBeekeeperApi({
      listProjects: listing('-a'),
      getProjectDailyUsage: (_dir, window) =>
        Promise.resolve(window === '7d' ? replyOf(1) : replyOf(1, 30))
    })
    const { result } = renderHook(() => useDailyUsage(), { wrapper: createQueryWrapper() })
    await waitFor(() => {
      expect(result.current.summary.days).toHaveLength(7)
    })

    act(() => {
      useTotalsWindowStore.getState().setWindow('30d')
    })

    await waitFor(() => {
      expect(result.current.summary.days).toHaveLength(30)
    })
    expect(result.current.window).toBe('30d')
    expect(api.getProjectDailyUsage).toHaveBeenCalledWith('-a', '30d')
  })

  it('keeps the other window’s figures, marked refreshing, until the new window’s arrive', async () => {
    const thirty = deferred()
    installBeekeeperApi({
      listProjects: listing('-a'),
      getProjectDailyUsage: (_dir, window) =>
        window === '7d' ? Promise.resolve(replyOf(1)) : thirty.promise
    })
    const { result } = renderHook(() => useDailyUsage(), { wrapper: createQueryWrapper() })
    await waitFor(() => {
      expect(result.current.summary.total).toBe(7)
    })
    expect(result.current.summary.refreshing).toBe(false)

    act(() => {
      useTotalsWindowStore.getState().setWindow('30d')
    })

    expect(result.current.summary).toMatchObject({ total: 7, refreshing: true, loading: 0 })
    act(() => {
      thirty.settle(replyOf(1, 30))
    })
    await waitFor(() => {
      expect(result.current.summary).toMatchObject({ total: 30, refreshing: false })
    })
  })

  it('is loading, not another window’s figures, for a window nothing was ever loaded for', async () => {
    const seven = deferred()
    installBeekeeperApi({ listProjects: listing('-a'), getProjectDailyUsage: () => seven.promise })
    const { result } = renderHook(() => useDailyUsage(), { wrapper: createQueryWrapper() })
    await waitFor(() => {
      expect(result.current.summary.loading).toBe(1)
    })

    act(() => {
      useTotalsWindowStore.getState().setWindow('30d')
    })

    expect(result.current.summary).toMatchObject({ days: [], loading: 1, refreshing: false })
  })

  it('keeps yesterday’s figures, marked refreshing, while the new day loads', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 2, 10, 23, 0))
    const today = deferred()
    let calls = 0
    installBeekeeperApi({
      listProjects: listing('-a'),
      getProjectDailyUsage: () => (calls++ === 0 ? Promise.resolve(replyOf(1)) : today.promise)
    })
    const { result, rerender } = renderHook(() => useDailyUsage(), {
      wrapper: createQueryWrapper()
    })
    await waitFor(() => {
      expect(result.current.summary.total).toBe(7)
    })

    vi.setSystemTime(new Date(2026, 2, 11, 0, 1))
    rerender()

    expect(result.current.summary).toMatchObject({ total: 7, refreshing: true })
  })

  it('drops the previous day’s usage once the new day’s arrives, not before', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 2, 10, 23, 0))
    const client = createTestQueryClient()
    const today = deferred()
    let calls = 0
    installBeekeeperApi({
      listProjects: listing('-a'),
      getProjectDailyUsage: () => (calls++ === 0 ? Promise.resolve(replyOf(1)) : today.promise)
    })
    const { result, rerender } = renderHook(() => useDailyUsage(), {
      wrapper: createQueryWrapper(client)
    })
    await waitFor(() => {
      expect(result.current.summary.total).toBe(7)
    })
    const days = (): unknown[] =>
      client
        .getQueryCache()
        .findAll({ queryKey: ['projectDailyUsage', '-a'] })
        .map((q) => q.queryKey[3])
    vi.setSystemTime(new Date(2026, 2, 11, 0, 1))
    rerender()
    await waitFor(() => {
      expect(days()).toHaveLength(2)
    })
    expect(days().sort()).toEqual(['2026-03-10', '2026-03-11'])

    act(() => {
      today.settle(replyOf(2))
    })

    await waitFor(() => {
      expect(days()).toEqual(['2026-03-11'])
    })
  })

  it('leaves the new day’s usage in the cache when a request sent before midnight comes back after it', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 2, 10, 23, 0))
    const client = createTestQueryClient()
    // A second reader keeps the day-10 request alive after the key moves on, so it is not aborted.
    const late = deferred()
    let calls = 0
    installBeekeeperApi({
      listProjects: listing('-a'),
      getProjectDailyUsage: () => (calls++ === 0 ? late.promise : new Promise(() => undefined))
    })
    const keyed = (day: string): unknown[] => ['projectDailyUsage', '-a', '7d', day]
    const wrapper = createQueryWrapper(client)
    const { rerender } = renderHook(() => useDailyUsage(), { wrapper })
    await waitFor(() => {
      expect(calls).toBe(1)
    })
    const observer = new QueryObserver(client, {
      queryKey: keyed('2026-03-10'),
      queryFn: () => late.promise
    })
    const unsubscribe = observer.subscribe(() => undefined)

    vi.setSystemTime(new Date(2026, 2, 11, 0, 1))
    rerender()
    await waitFor(() => {
      expect(client.getQueryState(keyed('2026-03-11'))).toBeDefined()
    })
    act(() => {
      late.settle(replyOf(1))
    })
    await waitFor(() => {
      expect(client.getQueryState(keyed('2026-03-10'))?.status).toBe('success')
    })

    expect(client.getQueryState(keyed('2026-03-11'))).toBeDefined()
    unsubscribe()
  })

  it('prunes nothing when the request was abandoned before it came back', async () => {
    const client = createTestQueryClient()
    const removals = vi.spyOn(client, 'removeQueries')
    const reply = deferred()
    const api = installBeekeeperApi({
      listProjects: listing('-a'),
      getProjectDailyUsage: () => reply.promise
    })
    const { unmount } = renderHook(() => useDailyUsage(), {
      wrapper: createQueryWrapper(client)
    })
    await waitFor(() => {
      expect(api.getProjectDailyUsage).toHaveBeenCalledTimes(1)
    })

    unmount()
    reply.settle(replyOf(1))
    await settleMicrotasks(30)

    expect(removals).not.toHaveBeenCalled()
  })

  it('prunes once the usage arrives to a reader still waiting for it', async () => {
    const client = createTestQueryClient()
    const removals = vi.spyOn(client, 'removeQueries')
    installBeekeeperApi({
      listProjects: listing('-a'),
      getProjectDailyUsage: () => Promise.resolve(replyOf(1))
    })

    renderHook(() => useDailyUsage(), { wrapper: createQueryWrapper(client) })

    await waitFor(() => {
      expect(removals).toHaveBeenCalledTimes(1)
    })
  })

  it('reads the cache for a placeholder once, not on every render, while a folder loads', async () => {
    const client = createTestQueryClient()
    const reads = vi.spyOn(client, 'getQueriesData')
    const thirty = deferred()
    installBeekeeperApi({
      listProjects: listing('-a'),
      getProjectDailyUsage: (_dir, window) =>
        window === '7d' ? Promise.resolve(replyOf(1)) : thirty.promise
    })
    const { result, rerender } = renderHook(() => useDailyUsage(), {
      wrapper: createQueryWrapper(client)
    })
    await waitFor(() => {
      expect(result.current.summary.total).toBe(7)
    })
    act(() => {
      useTotalsWindowStore.getState().setWindow('30d')
    })
    await waitFor(() => {
      expect(result.current.summary.refreshing).toBe(true)
    })
    const readsWhileLoading = reads.mock.calls.length

    for (let i = 0; i < 5; i += 1) rerender()

    expect(reads.mock.calls.length).toBe(readsWhileLoading)
  })

  it('asks again when the local day changes', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 2, 10, 23, 0))
    const api = installBeekeeperApi({
      listProjects: listing('-a'),
      getProjectDailyUsage: () => Promise.resolve(replyOf(1))
    })
    const { rerender } = renderHook(() => useDailyUsage(), { wrapper: createQueryWrapper() })
    await waitFor(() => {
      expect(api.getProjectDailyUsage).toHaveBeenCalledTimes(1)
    })

    vi.setSystemTime(new Date(2026, 2, 11, 0, 1))
    rerender()

    await waitFor(() => {
      expect(api.getProjectDailyUsage).toHaveBeenCalledTimes(2)
    })
  })

  it('does not ask again on a rerender within the same day', async () => {
    const api = installBeekeeperApi({
      listProjects: listing('-a'),
      getProjectDailyUsage: () => Promise.resolve(replyOf(1))
    })
    const { rerender } = renderHook(() => useDailyUsage(), { wrapper: createQueryWrapper() })
    await waitFor(() => {
      expect(api.getProjectDailyUsage).toHaveBeenCalledTimes(1)
    })

    rerender()
    await settleMicrotasks()

    expect(api.getProjectDailyUsage).toHaveBeenCalledTimes(1)
  })

  it('asks once for a folder two readers show', async () => {
    const api = installBeekeeperApi({
      listProjects: listing('-a'),
      getProjectDailyUsage: () => Promise.resolve(replyOf(1))
    })
    const wrapper = createQueryWrapper(createTestQueryClient())

    renderHook(() => useDailyUsage(), { wrapper })
    renderHook(() => useDailyUsage(), { wrapper })
    await settleMicrotasks()

    expect(api.getProjectDailyUsage).toHaveBeenCalledTimes(1)
  })
})

describe('useDailyUsage request limit', () => {
  const folders = ['-a', '-b', '-c']
  beforeEach(() => {
    useTotalsWindowStore.setState({ window: '7d' })
  })

  it('has one folder in flight at a time, in list order', async () => {
    const replies = new Map(folders.map((dir) => [dir, deferred()]))
    let inFlight = 0
    let peak = 0
    const api = installBeekeeperApi({
      listProjects: listing(...folders),
      getProjectDailyUsage: async (dir) => {
        inFlight += 1
        peak = Math.max(peak, inFlight)
        const reply = await replies.get(dir)?.promise
        inFlight -= 1
        return reply ?? replyOf(0)
      }
    })
    renderHook(() => useDailyUsage(), { wrapper: createQueryWrapper() })
    await waitFor(() => {
      expect(api.getProjectDailyUsage).toHaveBeenCalledTimes(1)
    })
    await settleMicrotasks()
    expect(api.getProjectDailyUsage).toHaveBeenCalledTimes(1)

    for (const reply of replies.values()) act(() => reply.settle(replyOf(1)))
    await waitFor(() => {
      expect(api.getProjectDailyUsage).toHaveBeenCalledTimes(3)
    })
    expect(peak).toBe(1)
    expect(api.getProjectDailyUsage.mock.calls.map(([dir]) => dir)).toEqual(folders)
  })

  it('starts no folder that was still waiting when nothing shows the usage any more', async () => {
    const reply = deferred()
    const api = installBeekeeperApi({
      listProjects: listing(...folders),
      getProjectDailyUsage: () => reply.promise
    })
    const { unmount } = renderHook(() => useDailyUsage(), { wrapper: createQueryWrapper() })
    await waitFor(() => {
      expect(api.getProjectDailyUsage).toHaveBeenCalledTimes(1)
    })

    unmount()
    reply.settle(replyOf(1))
    await settleMicrotasks(30)

    expect(api.getProjectDailyUsage).toHaveBeenCalledTimes(1)
  })
})
