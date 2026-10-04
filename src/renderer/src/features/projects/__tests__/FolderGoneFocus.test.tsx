import { act, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { IpcResult } from '../../../../../shared/ipc/ipcResult'
import type { ProjectDto } from '../../../../../shared/ipc/projectDto'
import { useFirstRunStore } from '@renderer/features/firstRun/state/useFirstRunStore'
import { installBeekeeperApi, testProject } from '@renderer/testBeekeeperApi'
import { renderApp, resetPersistedState } from '@renderer/testRenderApp'
import { useSelectedProjectStore } from '../state/useSelectedProjectStore'

const ALPHA = '-Users-a-alpha'
const BETA = '-Users-a-beta'
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

describe('focus when a gone folder switches the view', () => {
  it('moves focus to the main landmark when the focused Retry button goes away', async () => {
    const settle = await renderWithHeldFallback()
    screen.getByRole('button', { name: 'Retry' }).focus()

    await act(async () => {
      settle([testProject(BETA)])
      await new Promise((resolve) => setTimeout(resolve, 20))
    })

    await screen.findByText(NOTICE)
    expect(document.activeElement).toBe(screen.getByRole('main'))
  })

  it('leaves focus in the sidebar when it was there', async () => {
    const settle = await renderWithHeldFallback()
    const sidebarButton = within(screen.getByRole('navigation', { name: 'Projects' })).getByRole(
      'button',
      { name: BETA }
    )
    sidebarButton.focus()

    await act(async () => {
      settle([testProject(BETA)])
      await new Promise((resolve) => setTimeout(resolve, 20))
    })

    await screen.findByText(NOTICE)
    expect(document.activeElement).toBe(sidebarButton)
  })
})
