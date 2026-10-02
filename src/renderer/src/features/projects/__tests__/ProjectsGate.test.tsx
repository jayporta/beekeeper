import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { IpcErrorCode, IpcResult } from '../../../../../shared/ipc/ipcResult'
import type { ProjectDto } from '../../../../../shared/ipc/projectDto'
import { installBeekeeperApi, testProject } from '@renderer/testBeekeeperApi'
import {
  createQueryWrapper,
  createTestQueryClient,
  refetchAndSettle
} from '@renderer/testQueryWrapper'
import { renderApp, resetPersistedState } from '@renderer/testRenderApp'
import { useFirstRunStore } from '../../firstRun/state/useFirstRunStore'
import { ProjectsGate } from '../ProjectsGate'

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

  it('announces denied access for an unreadable result, with Retry and no automatic retries', async () => {
    const api = installBeekeeperApi({ listProjects: () => failed('unreadable') })
    renderApp()

    const alert = await screen.findByRole('alert')
    expect(
      within(alert).getByRole('heading', { level: 1, name: "Can't read your sessions" })
    ).toBeTruthy()
    expect(within(alert).getByRole('button', { name: 'Retry' })).toBeTruthy()
    expect(api.listProjects).toHaveBeenCalledTimes(1)
  })

  it('mounts the denied alert fresh rather than turning the loading message into it', async () => {
    let resolve: (value: IpcResult<readonly ProjectDto[]>) => void = () => undefined
    installBeekeeperApi({ listProjects: () => new Promise((r) => (resolve = r)) })
    renderApp()
    const loading = await screen.findByRole('status')

    resolve({ ok: false, error: { code: 'unreadable' } })
    const alert = await screen.findByRole('alert')

    expect(alert).not.toBe(loading)
    expect(loading.isConnected).toBe(false)
  })

  it('shows a generic error with Retry for any other code, and Retry loads again', async () => {
    let calls = 0
    installBeekeeperApi({
      listProjects: () => {
        calls += 1
        // The first call and its three retries fail, so the error state shows.
        return calls <= 4
          ? failed('internal')
          : Promise.resolve({ ok: true, value: [testProject('-Users-a-repo')] })
      }
    })
    renderApp()

    const alert = await screen.findByRole('alert')
    expect(
      within(alert).getByRole('heading', { level: 1, name: 'Something went wrong' })
    ).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Sessions' })).toBeTruthy()
  })

  it('moves focus to the main landmark when Retry replaces the error with loading', async () => {
    installBeekeeperApi({ listProjects: () => failed('internal') })
    renderApp()

    await userEvent.click(await screen.findByRole('button', { name: 'Retry' }))

    expect(document.activeElement).toBe(screen.getByRole('main'))
  })

  it('keeps the loaded list on screen when a background refresh fails', async () => {
    let failing = false
    installBeekeeperApi({
      listProjects: () =>
        failing ? failed('internal') : Promise.resolve({ ok: true, value: [testProject('-a')] })
    })
    const client = createTestQueryClient()
    render(
      <ProjectsGate>
        <p>the list</p>
      </ProjectsGate>,
      { wrapper: createQueryWrapper(client) }
    )
    await screen.findByText('the list')

    failing = true
    await refetchAndSettle(client, ['projects'])

    expect(client.getQueryState(['projects'])?.status).toBe('error')
    expect(screen.getByText('the list')).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it.each([
    ['internal', 'Something went wrong'],
    ['unreadable', "Can't read your sessions"]
  ] as const)(
    'shows the %s error with Retry, not the empty state, when a refresh of an empty list fails',
    async (code, heading) => {
      let failing = false
      installBeekeeperApi({
        listProjects: () => (failing ? failed(code) : Promise.resolve({ ok: true, value: [] }))
      })
      const client = createTestQueryClient()
      render(
        <ProjectsGate>
          <p>the list</p>
        </ProjectsGate>,
        { wrapper: createQueryWrapper(client) }
      )
      await screen.findByRole('heading', { level: 1, name: 'No sessions found' })

      failing = true
      await refetchAndSettle(client, ['projects'])

      const alert = await screen.findByRole('alert')
      expect(within(alert).getByRole('heading', { level: 1, name: heading })).toBeTruthy()
      expect(within(alert).getByRole('button', { name: 'Retry' })).toBeTruthy()
      expect(screen.queryByRole('heading', { name: 'No sessions found' })).toBeNull()
    }
  )

  it('shows the sessions heading with the selected folder name when a project loads', async () => {
    installBeekeeperApi()
    renderApp()

    expect(await screen.findByRole('heading', { level: 1, name: 'Sessions' })).toBeTruthy()
    expect(screen.getByText('-Users-a-repo', { selector: 'p' })).toBeTruthy()
  })
})
