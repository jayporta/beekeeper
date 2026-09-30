import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { IpcErrorCode, IpcResult } from '../../../../../shared/ipc/ipcResult'
import type { ProjectDto } from '../../../../../shared/ipc/projectDto'
import { installBeekeeperApi, testProject } from '@renderer/testBeekeeperApi'
import { renderApp, resetPersistedState } from '@renderer/testRenderApp'
import { useFirstRunStore } from '../../firstRun/state/useFirstRunStore'

beforeEach(() => {
  useFirstRunStore.setState({ dismissed: true })
})

afterEach(resetPersistedState)

const failed = (code: IpcErrorCode): Promise<IpcResult<readonly ProjectDto[]>> =>
  Promise.resolve({ ok: false, error: { code } })

describe('ProjectsGate states', () => {
  it('announces loading while projects load', async () => {
    installBeekeeperApi({ listProjects: () => new Promise(() => undefined) })
    renderApp()

    expect((await screen.findByRole('status')).textContent).toContain('Loading projects')
  })

  it('explains an empty result', async () => {
    installBeekeeperApi({ listProjects: () => Promise.resolve({ ok: true, value: [] }) })
    renderApp()

    expect(await screen.findByRole('heading', { level: 1, name: 'No sessions found' })).toBeTruthy()
    expect(screen.getByText(/after you run Claude Code/)).toBeTruthy()
  })

  it('explains denied access for an unreadable result, without a retry button', async () => {
    installBeekeeperApi({ listProjects: () => failed('unreadable') })
    renderApp()

    expect(
      await screen.findByRole('heading', { level: 1, name: "Can't read your sessions" })
    ).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull()
  })

  it('shows a generic error with Retry for any other code, and Retry loads again', async () => {
    let calls = 0
    installBeekeeperApi({
      listProjects: () => {
        calls += 1
        return calls === 1
          ? failed('internal')
          : Promise.resolve({ ok: true, value: [testProject('-Users-a-repo')] })
      }
    })
    renderApp()

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Something went wrong' })
    ).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Sessions' })).toBeTruthy()
  })

  it('shows the sessions heading with the selected folder name when a project loads', async () => {
    installBeekeeperApi()
    renderApp()

    expect(await screen.findByRole('heading', { level: 1, name: 'Sessions' })).toBeTruthy()
    expect(screen.getByText('-Users-a-repo', { selector: 'p' })).toBeTruthy()
  })
})
