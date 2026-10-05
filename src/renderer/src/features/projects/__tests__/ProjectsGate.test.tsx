import { render, screen, waitFor, within } from '@testing-library/react'
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

    const heading = await screen.findByRole('heading', { name: 'Loading projects' })

    expect(heading.closest('[role="status"]')).not.toBeNull()
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
    const api = installBeekeeperApi({ listProjects: () => new Promise((r) => (resolve = r)) })
    renderApp()
    const loading = (await screen.findByRole('heading', { name: 'Loading projects' })).closest(
      '[role="status"]'
    )
    // The loading message can render before the query's effect makes the call.
    await waitFor(() => {
      expect(api.listProjects).toHaveBeenCalledOnce()
    })

    resolve({ ok: false, error: { code: 'unreadable' } })
    const alert = await screen.findByRole('alert')

    expect(loading).not.toBeNull()
    expect(alert).not.toBe(loading)
    expect(loading?.isConnected).toBe(false)
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

    expect(await screen.findByRole('heading', { level: 1, name: '-Users-a-repo' })).toBeTruthy()
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

  describe('retrying a failed refresh of an empty list', () => {
    /** Renders the gate over an empty list whose refresh then fails, and returns the alert. */
    async function renderWithFailedRefresh(): Promise<{
      alert: HTMLElement
      holdNextCall: () => void
      failFromNowOn: () => void
      settlePending: (result: IpcResult<readonly ProjectDto[]>) => void
    }> {
      let mode: 'ok' | 'fail' | 'pending' = 'ok'
      let settlePending: (result: IpcResult<readonly ProjectDto[]>) => void = () => undefined
      installBeekeeperApi({
        listProjects: () => {
          if (mode === 'ok') return Promise.resolve({ ok: true, value: [] })
          if (mode === 'fail') return failed('internal')
          return new Promise((resolve) => (settlePending = resolve))
        }
      })
      const client = createTestQueryClient()
      render(<ProjectsGate>{null}</ProjectsGate>, { wrapper: createQueryWrapper(client) })
      await screen.findByRole('heading', { level: 1, name: 'No sessions found' })

      mode = 'fail'
      await refetchAndSettle(client, ['projects'])
      const alert = await screen.findByRole('alert')

      return {
        alert,
        holdNextCall: () => (mode = 'pending'),
        failFromNowOn: () => (mode = 'fail'),
        settlePending: (result) => settlePending(result)
      }
    }

    it('shows the loading status while Retry refetches', async () => {
      const { holdNextCall } = await renderWithFailedRefresh()
      holdNextCall()

      await userEvent.click(screen.getByRole('button', { name: 'Retry' }))

      expect((await screen.findByRole('status')).textContent).toContain('Loading projects')
      expect(screen.queryByRole('alert')).toBeNull()
    })

    it('mounts a fresh alert when the retry fails again', async () => {
      const { alert, holdNextCall, failFromNowOn, settlePending } = await renderWithFailedRefresh()
      holdNextCall()
      await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
      await screen.findByRole('status')

      failFromNowOn()
      settlePending({ ok: false, error: { code: 'internal' } })
      const next = await screen.findByRole('alert')

      expect(next).not.toBe(alert)
      expect(alert.isConnected).toBe(false)
    })
  })

  it('keeps the empty state during a background refetch of an empty list', async () => {
    let pending = false
    installBeekeeperApi({
      listProjects: () =>
        pending ? new Promise(() => undefined) : Promise.resolve({ ok: true, value: [] })
    })
    const client = createTestQueryClient()
    render(<ProjectsGate>{null}</ProjectsGate>, { wrapper: createQueryWrapper(client) })
    await screen.findByRole('heading', { level: 1, name: 'No sessions found' })

    pending = true
    void client.refetchQueries({ queryKey: ['projects'] })

    expect(await screen.findByRole('heading', { level: 1, name: 'No sessions found' })).toBeTruthy()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('names the heading after the selected project, with its folder name beneath, when a project loads', async () => {
    installBeekeeperApi()
    renderApp()

    expect(await screen.findByRole('heading', { level: 1, name: '-Users-a-repo' })).toBeTruthy()
    expect(screen.getByText('-Users-a-repo', { selector: 'p' })).toBeTruthy()
  })
})
