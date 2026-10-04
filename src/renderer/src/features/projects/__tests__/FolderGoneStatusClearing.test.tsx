import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LIVE_COPY_CLEAR_MS } from '@renderer/components/liveCopyClearMs'
import { useNavigationStore } from '@renderer/features/navigation/state/useNavigationStore'
import { installBeekeeperApi, testProject } from '@renderer/testBeekeeperApi'
import { createQueryWrapper } from '@renderer/testQueryWrapper'
import { resetPersistedState } from '@renderer/testRenderApp'
import { FolderGoneStatus } from '../FolderGoneStatus'
import { useSelectedProjectStore } from '../state/useSelectedProjectStore'
import { findAnnouncedGoneNotice, findVisibleGoneNotice } from '../testGoneNotice'

const ALPHA = '-Users-a-alpha'
const BETA = '-Users-a-beta'

afterEach(async () => {
  vi.useRealTimers()
  useNavigationStore.getState().reset()
  await resetPersistedState()
})

describe('FolderGoneStatus announcement', () => {
  it('empties the status region after announcing, and keeps the visible notice', async () => {
    // Real time still passes, so the queries settle, but the clear waits for the advance below.
    vi.useFakeTimers({ shouldAdvanceTime: true })
    useSelectedProjectStore.setState({ goneDirName: ALPHA })
    installBeekeeperApi({
      listProjects: () => Promise.resolve({ ok: true, value: [testProject(BETA)] })
    })
    const text = `The folder ${ALPHA} no longer exists. Showing ${BETA}.`

    render(<FolderGoneStatus />, { wrapper: createQueryWrapper() })

    await findAnnouncedGoneNotice(text)
    act(() => {
      vi.advanceTimersByTime(LIVE_COPY_CLEAR_MS)
    })

    expect(screen.getByRole('status').textContent).toBe('')
    expect((await findVisibleGoneNotice(text)).textContent).toBe(text)
  })
})
