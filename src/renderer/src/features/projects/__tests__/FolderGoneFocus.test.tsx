import { act, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { IpcResult } from '../../../../../shared/ipc/ipcResult'
import type { ProjectDto } from '../../../../../shared/ipc/projectDto'
import { useFirstRunStore } from '@renderer/features/firstRun/state/useFirstRunStore'
import { installBeekeeperApi, testProject } from '@renderer/testBeekeeperApi'
import { renderApp, resetPersistedState } from '@renderer/testRenderApp'
import { useSelectedProjectStore } from '../state/useSelectedProjectStore'
import { findAnnouncedGoneNotice, findVisibleGoneNotice, goneNoticeParts } from '../testGoneNotice'

const ALPHA = '-Users-a-alpha'
const BETA = '-Users-a-beta'
const GAMMA = '-Users-a-gamma'
const NOTICE = `The folder ${ALPHA} no longer exists. Showing ${BETA}.`

beforeEach(() => {
  useFirstRunStore.setState({ dismissed: true })
})

afterEach(resetPersistedState)

/**
 * Shows ALPHA's "folder gone" error with Retry, holding the project refresh
 * that will drop ALPHA, so a test can place focus first and then let the
 * fallback happen.
 */
async function renderWithHeldFallback(): Promise<(value: readonly ProjectDto[]) => void> {
  useSelectedProjectStore.setState({ selectedDirName: ALPHA })
  let settle: (result: IpcResult<readonly ProjectDto[]>) => void = () => undefined
  const held = new Promise<IpcResult<readonly ProjectDto[]>>((resolve) => {
    settle = resolve
  })
  let calls = 0
  installBeekeeperApi({
    listProjects: () => {
      calls += 1
      return calls === 1
        ? Promise.resolve({ ok: true, value: [testProject(ALPHA), testProject(BETA)] })
        : held
    },
    listSessions: (dirName) =>
      dirName === ALPHA
        ? Promise.resolve({ ok: false, error: { code: 'not-found' } })
        : Promise.resolve({ ok: true, value: [] })
  })
  renderApp()
  await screen.findByRole('button', { name: 'Retry' })
  return (value) => {
    settle({ ok: true, value })
  }
}

/** Lets the held project refresh answer, so the fallback to BETA happens. */
async function dropAlpha(settle: (value: readonly ProjectDto[]) => void): Promise<void> {
  await act(async () => {
    settle([testProject(BETA)])
    await new Promise((resolve) => setTimeout(resolve, 20))
  })
}

describe('focus when a gone folder switches the view', () => {
  it('moves focus to the notice, with no live region announcing it, when the focused Retry button goes away', async () => {
    const settle = await renderWithHeldFallback()
    screen.getByRole('button', { name: 'Retry' }).focus()

    await dropAlpha(settle)

    const notice = await findVisibleGoneNotice(NOTICE)
    expect(document.activeElement).toBe(notice)
    expect(notice.getAttribute('role')).toBeNull()
    expect(goneNoticeParts(NOTICE).announced).toBeNull()
  })

  it('announces a changed notice through the status region after the notice took focus', async () => {
    const settle = await renderWithHeldFallback()
    screen.getByRole('button', { name: 'Retry' }).focus()
    await dropAlpha(settle)
    const notice = await findVisibleGoneNotice(NOTICE)

    act(() => {
      useSelectedProjectStore.setState({ goneDirName: GAMMA })
    })

    const announced = await findAnnouncedGoneNotice(
      `The folder ${GAMMA} no longer exists. Showing ${BETA}.`
    )
    expect(announced.getAttribute('role')).toBe('status')
    expect(document.activeElement).toBe(notice)
  })

  it('leaves focus in the sidebar, and announces the notice, when focus was there', async () => {
    const settle = await renderWithHeldFallback()
    const sidebarButton = within(screen.getByRole('navigation', { name: 'Projects' })).getByRole(
      'button',
      { name: BETA }
    )
    sidebarButton.focus()

    await dropAlpha(settle)

    await findAnnouncedGoneNotice(NOTICE)
    expect(document.activeElement).toBe(sidebarButton)
  })
})
