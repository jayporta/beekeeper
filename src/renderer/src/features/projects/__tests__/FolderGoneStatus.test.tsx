import { act, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { useNavigationStore } from '@renderer/features/navigation/state/useNavigationStore'
import { installBeekeeperApi, testProject } from '@renderer/testBeekeeperApi'
import { createQueryWrapper } from '@renderer/testQueryWrapper'
import { resetPersistedState } from '@renderer/testRenderApp'
import { FolderGoneStatus } from '../FolderGoneStatus'
import { useSelectedProjectStore } from '../state/useSelectedProjectStore'
import { findVisibleGoneNotice } from '../testGoneNotice'

const ALPHA = '-Users-a-alpha'
const BETA = '-Users-a-beta'
const WORKTREE = '-Users-a-alpha-wt'

/** The sentence that names a folder that no longer exists. */
const folderGone = (folder: string): string => `The folder ${folder} no longer exists.`

afterEach(async () => {
  useNavigationStore.getState().reset()
  await resetPersistedState()
})

function listing(...projects: ReturnType<typeof testProject>[]): void {
  installBeekeeperApi({ listProjects: () => Promise.resolve({ ok: true, value: projects }) })
}

/** Renders the region and waits for the project list to load, so an assertion can't pass on the loading frame. */
async function renderLoaded(): Promise<HTMLElement> {
  const view = render(<FolderGoneStatus />, { wrapper: createQueryWrapper() })
  await waitFor(() => {
    expect(window.beekeeper.listProjects).toHaveBeenCalled()
  })
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
  return view.getByRole('status')
}

describe('FolderGoneStatus', () => {
  it('is an empty status region on the first render, before any folder is gone', () => {
    installBeekeeperApi({ listProjects: () => new Promise(() => undefined) })

    render(<FolderGoneStatus />, { wrapper: createQueryWrapper() })

    expect(screen.getByRole('status').textContent).toBe('')
  })

  it('stays empty when no folder was recorded as gone', async () => {
    listing(testProject(ALPHA), testProject(BETA))

    const region = await renderLoaded()

    expect(region.textContent).toBe('')
  })

  it('names the project that took over once the project list has loaded', async () => {
    useSelectedProjectStore.setState({ goneDirName: ALPHA })
    listing({ ...testProject(BETA), label: 'Beta app' })

    const region = await renderLoaded()

    await waitFor(() => {
      expect(region.textContent).toBe(`${folderGone(ALPHA)} Showing Beta app.`)
    })
  })

  it('names a parent project by the title the heading shows when the gone folder was a worktree', async () => {
    useSelectedProjectStore.setState({ goneDirName: WORKTREE })
    listing(
      { ...testProject(ALPHA), label: 'Alpha app' },
      testProject('-Users-a-other-wt', { worktreeOf: ALPHA, worktreeName: 'other-wt' })
    )

    const region = await renderLoaded()

    await waitFor(() => {
      expect(region.textContent).toBe(`${folderGone(WORKTREE)} Showing Alpha app.`)
    })
  })

  it('says only that the folder is gone when no project is left to show', async () => {
    useSelectedProjectStore.setState({ goneDirName: ALPHA })
    listing()

    const region = await renderLoaded()

    await waitFor(() => {
      expect(region.textContent).toBe(folderGone(ALPHA))
    })
  })

  it('says nothing while the project list is still loading', async () => {
    useSelectedProjectStore.setState({ goneDirName: ALPHA })
    installBeekeeperApi({ listProjects: () => new Promise(() => undefined) })

    render(<FolderGoneStatus />, { wrapper: createQueryWrapper() })
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20))
    })

    expect(screen.getByRole('status').textContent).toBe('')
  })

  it('says nothing when the gone folder is still the project in effect', async () => {
    useSelectedProjectStore.setState({ goneDirName: ALPHA })
    listing(testProject(ALPHA), testProject(BETA))

    const region = await renderLoaded()

    expect(region.textContent).toBe('')
  })

  it('names only the folder on the overview, which no project fallback changes', async () => {
    useNavigationStore.setState({ view: 'overview' })
    useSelectedProjectStore.setState({ goneDirName: ALPHA })
    listing(testProject(BETA))

    const region = await renderLoaded()

    await waitFor(() => {
      expect(region.textContent).toBe(folderGone(ALPHA))
    })
  })

  it('names a second gone folder, so the change is announced again', async () => {
    useSelectedProjectStore.setState({ goneDirName: ALPHA })
    listing(testProject(BETA))
    const region = await renderLoaded()
    await waitFor(() => {
      expect(region.textContent).toContain(folderGone(ALPHA))
    })

    act(() => {
      useSelectedProjectStore.setState({ goneDirName: WORKTREE })
    })

    expect(region.textContent).toBe(`${folderGone(WORKTREE)} Showing ${BETA}.`)
  })

  it('shows the message as visible text and announces it from a hidden status region', async () => {
    useSelectedProjectStore.setState({ goneDirName: ALPHA })
    listing(testProject(BETA))
    const region = await renderLoaded()

    const text = `${folderGone(ALPHA)} Showing ${BETA}.`
    const visible = await findVisibleGoneNotice(text)

    expect(visible.classList.contains('visuallyHidden')).toBe(false)
    expect(region.classList.contains('visuallyHidden')).toBe(true)
    await waitFor(() => {
      expect(region.textContent).toBe(text)
    })
  })

  it('clears its text when the person navigates', async () => {
    useSelectedProjectStore.setState({ goneDirName: ALPHA })
    listing(testProject(BETA))
    const region = await renderLoaded()
    await waitFor(() => {
      expect(region.textContent).toContain(folderGone(ALPHA))
    })

    act(() => {
      useNavigationStore.getState().showOverview()
    })

    await waitFor(() => {
      expect(region.textContent).toBe('')
    })
  })

  it('keeps its text when navigation is reset by the app', async () => {
    useSelectedProjectStore.setState({ goneDirName: ALPHA })
    listing(testProject(BETA))
    const region = await renderLoaded()
    await waitFor(() => {
      expect(region.textContent).toContain(folderGone(ALPHA))
    })

    act(() => {
      useNavigationStore.getState().reset()
    })

    expect(region.textContent).toContain(folderGone(ALPHA))
  })
})
