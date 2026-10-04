import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { SessionRefDto } from '../../../../../shared/ipc/sessionRefDto'
import type { WorktreeDiffsDto } from '../../../../../shared/ipc/worktreeDiffDto'
import { IpcCallError } from '@renderer/ipc/ipcCallError'
import { installBeekeeperApi } from '@renderer/testBeekeeperApi'
import { createQueryWrapper, createTestQueryClient } from '@renderer/testQueryWrapper'
import { useWorktreeDiffs } from '../useWorktreeDiffs'

const REF: SessionRefDto = {
  projectDirName: '-p',
  sessionId: '11111111-1111-4111-8111-111111111111'
}
const DIFFS: WorktreeDiffsDto = { git: 'ok', agents: [], sharedWorktree: null }

describe('useWorktreeDiffs', () => {
  it('loads the diffs of the session named by the ref', async () => {
    const api = installBeekeeperApi({
      getWorktreeDiffs: () => Promise.resolve({ ok: true, value: DIFFS })
    })

    const { result } = renderHook(() => useWorktreeDiffs(REF, true), {
      wrapper: createQueryWrapper()
    })

    await waitFor(() => {
      expect(result.current.data).toEqual(DIFFS)
    })
    expect(api.getWorktreeDiffs).toHaveBeenCalledExactlyOnceWith(REF.projectDirName, REF.sessionId)
  })

  it('makes no call while it is disabled', async () => {
    const api = installBeekeeperApi({
      getWorktreeDiffs: () => Promise.resolve({ ok: true, value: DIFFS })
    })

    const { result } = renderHook(() => useWorktreeDiffs(REF, false), {
      wrapper: createQueryWrapper()
    })
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(result.current.fetchStatus).toBe('idle')
    expect(api.getWorktreeDiffs).not.toHaveBeenCalled()
  })

  it('loads once it is enabled', async () => {
    const api = installBeekeeperApi({
      getWorktreeDiffs: () => Promise.resolve({ ok: true, value: DIFFS })
    })
    const wrapper = createQueryWrapper(createTestQueryClient())

    const { result, rerender } = renderHook(({ enabled }) => useWorktreeDiffs(REF, enabled), {
      wrapper,
      initialProps: { enabled: false }
    })
    rerender({ enabled: true })

    await waitFor(() => {
      expect(result.current.data).toEqual(DIFFS)
    })
    expect(api.getWorktreeDiffs).toHaveBeenCalledTimes(1)
  })

  it('fails with an IpcCallError carrying the failure code', async () => {
    installBeekeeperApi({
      getWorktreeDiffs: () => Promise.resolve({ ok: false, error: { code: 'unreadable' } })
    })

    const { result } = renderHook(() => useWorktreeDiffs(REF, true), {
      wrapper: createQueryWrapper()
    })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
    expect(result.current.error).toBeInstanceOf(IpcCallError)
    expect(IpcCallError.codeOf(result.current.error)).toBe('unreadable')
  })

  it.each([
    ['session', { ...REF, sessionId: '22222222-2222-4222-8222-222222222222' }],
    ['folder', { ...REF, projectDirName: '-other' }]
  ])('keeps a cache entry for each %s', async (_label, other) => {
    const api = installBeekeeperApi({
      getWorktreeDiffs: () => Promise.resolve({ ok: true, value: DIFFS })
    })
    const wrapper = createQueryWrapper()

    const first = renderHook(() => useWorktreeDiffs(REF, true), { wrapper })
    const second = renderHook(() => useWorktreeDiffs(other, true), { wrapper })
    await waitFor(() => {
      expect(first.result.current.isSuccess && second.result.current.isSuccess).toBe(true)
    })

    expect(api.getWorktreeDiffs).toHaveBeenCalledTimes(2)
  })
})
