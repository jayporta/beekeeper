import { act, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { IpcResult } from '../../../../../shared/ipc/ipcResult'
import type { ProjectDto } from '../../../../../shared/ipc/projectDto'
import { LISTS_STALE_TIME_MS } from '@renderer/app/listsStaleTime'
import { useFirstRunStore } from '@renderer/features/firstRun/state/useFirstRunStore'
import { installBeekeeperApi, testProject } from '@renderer/testBeekeeperApi'
import { createQueryWrapper, createTestQueryClient } from '@renderer/testQueryWrapper'
import { resetPersistedState } from '@renderer/testRenderApp'
import { useForgetUnlistedSelection } from '../state/useForgetUnlistedSelection'
import { useSelectedProjectStore } from '../state/useSelectedProjectStore'

const ALPHA = '-Users-a-alpha'
const BETA = '-Users-a-beta'

beforeEach(() => {
  useFirstRunStore.setState({ dismissed: true, isOpen: false })
})

afterEach(async () => {
  useFirstRunStore.setState({ dismissed: false, isOpen: false })
  await resetPersistedState()
})

function Harness(): null {
  useForgetUnlistedSelection()
  return null
}

const stored = (): string | null => useSelectedProjectStore.getState().selectedDirName
const gone = (): string | null => useSelectedProjectStore.getState().goneDirName

/** Lets a query's result reach the components reading it. */
async function settle(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20))
  })
}

/** A `listProjects` result a test settles itself. */
function deferred(): {
  promise: Promise<IpcResult<readonly ProjectDto[]>>
  settle: (value: readonly ProjectDto[]) => void
} {
  let resolve: (result: IpcResult<readonly ProjectDto[]>) => void = () => undefined
  const promise = new Promise<IpcResult<readonly ProjectDto[]>>((r) => {
    resolve = r
  })
  return { promise, settle: (value) => resolve({ ok: true, value }) }
}

describe('useForgetUnlistedSelection', () => {
  it('forgets a stored selection the loaded project list does not name, and records it as gone', async () => {
    useSelectedProjectStore.setState({ selectedDirName: ALPHA })
    installBeekeeperApi({
      listProjects: () => Promise.resolve({ ok: true, value: [testProject(BETA)] })
    })

    render(<Harness />, { wrapper: createQueryWrapper() })

    await waitFor(() => {
      expect(stored()).toBeNull()
    })
    expect(gone()).toBe(ALPHA)
  })

  it('keeps a stored selection that the project list names', async () => {
    useSelectedProjectStore.setState({ selectedDirName: BETA })
    installBeekeeperApi({
      listProjects: () =>
        Promise.resolve({ ok: true, value: [testProject(ALPHA), testProject(BETA)] })
    })

    render(<Harness />, { wrapper: createQueryWrapper() })
    await settle()

    expect(stored()).toBe(BETA)
    expect(gone()).toBeNull()
  })

  it('waits for a fetch before acting on a list restored from the persisted cache', async () => {
    useSelectedProjectStore.setState({ selectedDirName: ALPHA })
    const refetch = deferred()
    installBeekeeperApi({ listProjects: () => refetch.promise })
    const client = createTestQueryClient()
    client.setQueryData(['projects'], [testProject(BETA)], {
      updatedAt: Date.now() - LISTS_STALE_TIME_MS - 1
    })

    render(<Harness />, { wrapper: createQueryWrapper(client) })
    await settle()

    expect(stored()).toBe(ALPHA)

    refetch.settle([testProject(BETA)])
    await waitFor(() => {
      expect(stored()).toBeNull()
    })
    expect(gone()).toBe(ALPHA)
  })

  it('keeps the selection when the fetch after a restored list still names it', async () => {
    useSelectedProjectStore.setState({ selectedDirName: ALPHA })
    const refetch = deferred()
    installBeekeeperApi({ listProjects: () => refetch.promise })
    const client = createTestQueryClient()
    client.setQueryData(['projects'], [testProject(BETA)], {
      updatedAt: Date.now() - LISTS_STALE_TIME_MS - 1
    })
    render(<Harness />, { wrapper: createQueryWrapper(client) })

    refetch.settle([testProject(ALPHA), testProject(BETA)])
    await settle()

    expect(stored()).toBe(ALPHA)
    expect(gone()).toBeNull()
  })

  it('does nothing while the first-run screen shows, and acts once it is dismissed', async () => {
    useFirstRunStore.setState({ dismissed: false })
    useSelectedProjectStore.setState({ selectedDirName: ALPHA })
    installBeekeeperApi({
      listProjects: () => Promise.resolve({ ok: true, value: [testProject(BETA)] })
    })
    render(<Harness />, { wrapper: createQueryWrapper() })
    await settle()

    expect(stored()).toBe(ALPHA)

    act(() => {
      useFirstRunStore.getState().dismiss()
    })

    await waitFor(() => {
      expect(stored()).toBeNull()
    })
  })
})
