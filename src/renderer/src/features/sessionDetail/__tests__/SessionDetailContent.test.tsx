import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import type { ProjectDto } from '../../../../../shared/ipc/projectDto'
import type { IpcResult } from '../../../../../shared/ipc/ipcResult'
import type { SessionDetailDto } from '../../../../../shared/ipc/sessionDetailDto'
import type { SessionListItemDto } from '../../../../../shared/ipc/sessionListDto'
import { useNavigationStore } from '@renderer/features/navigation/state/useNavigationStore'
import { testRef, testSession } from '@renderer/features/sessions/testSessionFixtures'
import { installBeekeeperApi, testProject, type TestBeekeeperApi } from '@renderer/testBeekeeperApi'
import {
  createQueryWrapper,
  createTestQueryClient,
  refetchAndSettle
} from '@renderer/testQueryWrapper'
import { SessionDetailContent } from '../SessionDetailContent'
import { testDetail } from '../testSessionDetail'

const DIR = '-Users-a-repo'
const REF = testRef(1, DIR)
const SESSIONS: readonly SessionListItemDto[] = [
  testSession(1, { projectDirName: DIR, title: 'Kept' })
]

const GOOD: IpcResult<SessionDetailDto> = { ok: true, value: testDetail() }
const UNREADABLE: IpcResult<SessionDetailDto> = { ok: false, error: { code: 'unreadable' } }
const NOT_FOUND = { ok: false, error: { code: 'not-found' } } as const

afterEach(() => {
  useNavigationStore.getState().reset()
})

/** A promise a test settles by hand. */
function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve: (value: T) => void = () => undefined
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

/** Waits `ms` of real time, so a later timestamp differs from an earlier one. */
async function pause(ms: number): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms))
  })
}

/** Lets pending query results reach the screen. */
async function settle(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

/** Stubs the API with the given list and detail results, and renders the content on `REF`. */
function renderContent(
  options: {
    list?: Promise<IpcResult<readonly SessionListItemDto[]>>
    detail?: Promise<IpcResult<SessionDetailDto>>
    /** Answers the project list's second and later loads, which the app starts when the folder is gone. */
    projects?: () => Promise<IpcResult<readonly ProjectDto[]>>
  } = {}
): { api: TestBeekeeperApi; client: ReturnType<typeof createTestQueryClient> } {
  const { list = Promise.resolve({ ok: true, value: SESSIONS }), detail = Promise.resolve(GOOD) } =
    options
  const firstProjects = Promise.resolve({ ok: true, value: [testProject(DIR)] } as const)
  let projectLoads = 0
  const api = installBeekeeperApi({
    listProjects: () =>
      projectLoads++ === 0 ? firstProjects : (options.projects ?? (() => firstProjects))(),
    listSessions: () => list,
    getSession: () => detail
  })
  const client = createTestQueryClient()
  render(<SessionDetailContent sessionRef={REF} dirName={DIR} />, {
    wrapper: createQueryWrapper(client)
  })
  return { api, client }
}

describe('SessionDetailContent', () => {
  it('keeps the session on screen when a background refresh fails', async () => {
    const { api, client } = renderContent()
    await screen.findByRole('heading', { level: 1, name: 'Kept' })

    api.getSession.mockResolvedValue(UNREADABLE)
    await refetchAndSettle(client, ['session', REF.projectDirName, REF.sessionId])

    expect(api.getSession).toHaveBeenCalledTimes(2)
    expect(screen.getByRole('heading', { level: 1, name: 'Kept' })).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
  })
})

describe('SessionDetailContent after Retry', () => {
  it('shows loading while the retry runs, then a fresh alert when it fails the same way', async () => {
    const retry = deferred<IpcResult<SessionDetailDto>>()
    const { api } = renderContent({ detail: Promise.resolve(UNREADABLE) })
    const first = await screen.findByRole('alert')
    api.getSession.mockReturnValueOnce(retry.promise)

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Loading session' })).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()

    retry.resolve(UNREADABLE)
    const second = await screen.findByRole('alert')
    expect(second).not.toBe(first)
    expect(second.textContent).toContain("Can't read this session")
  })
})

describe('SessionDetailContent when the session is not found', () => {
  it('holds the message while the folder’s list loads, then shows it once the list settles', async () => {
    const list = deferred<IpcResult<readonly SessionListItemDto[]>>()
    const { api } = renderContent({ list: list.promise, detail: Promise.resolve(NOT_FOUND) })
    await waitFor(() => {
      expect(api.getSession).toHaveBeenCalled()
    })
    await settle()

    expect(screen.getByRole('heading', { level: 1, name: 'Loading session' })).toBeTruthy()
    expect(screen.queryByRole('group', { name: 'Session not found' })).toBeNull()

    list.resolve({ ok: true, value: [] })
    expect(await screen.findByRole('group', { name: 'Session not found' })).toBeTruthy()
  })

  it('shows the message at once when the folder’s list has already settled', async () => {
    const detail = deferred<IpcResult<SessionDetailDto>>()
    const { api } = renderContent({ detail: detail.promise })
    await waitFor(() => {
      expect(api.listSessions).toHaveBeenCalled()
    })
    await screen.findByRole('heading', { level: 1, name: 'Loading session' })
    await settle()

    detail.resolve(NOT_FOUND)

    expect(await screen.findByRole('group', { name: 'Session not found' })).toBeTruthy()
  })

  it('holds the message while the project list refetches after the folder is reported gone, then shows it', async () => {
    const list = deferred<IpcResult<readonly SessionListItemDto[]>>()
    const projects = deferred<IpcResult<readonly ProjectDto[]>>()
    const { api } = renderContent({
      list: list.promise,
      detail: Promise.resolve(NOT_FOUND),
      projects: () => projects.promise
    })
    await waitFor(() => {
      expect(api.getSession).toHaveBeenCalled()
    })
    await pause(5)

    list.resolve(NOT_FOUND)
    await waitFor(() => {
      expect(api.listProjects).toHaveBeenCalledTimes(2)
    })
    await settle()

    expect(screen.getByRole('heading', { level: 1, name: 'Loading session' })).toBeTruthy()
    expect(screen.queryByRole('group', { name: 'Session not found' })).toBeNull()

    projects.resolve({ ok: true, value: [testProject(DIR)] })
    expect(await screen.findByRole('group', { name: 'Session not found' })).toBeTruthy()
  })

  it('mounts no message and no alert, even for one render, between the folder being reported gone and the project list settling', async () => {
    const list = deferred<IpcResult<readonly SessionListItemDto[]>>()
    const projects = deferred<IpcResult<readonly ProjectDto[]>>()
    const { api } = renderContent({
      list: list.promise,
      detail: Promise.resolve(NOT_FOUND),
      projects: () => projects.promise
    })
    await waitFor(() => {
      expect(api.getSession).toHaveBeenCalled()
    })
    await pause(5)
    const mounted: string[] = []
    const observer = new MutationObserver((records) => {
      for (const { addedNodes } of records) {
        for (const node of addedNodes) {
          if (node instanceof Element && node.matches('[role="alert"], [role="group"]')) {
            mounted.push(node.getAttribute('role') ?? '')
          }
        }
      }
    })
    observer.observe(document.body, { childList: true, subtree: true })

    list.resolve(NOT_FOUND)
    await waitFor(() => {
      expect(api.listProjects).toHaveBeenCalledTimes(2)
    })
    await settle()
    observer.disconnect()

    expect(mounted).toEqual([])
  })

  it('shows the message when the project list settles with the reported folder still in effect', async () => {
    renderContent({ list: Promise.resolve(NOT_FOUND), detail: Promise.resolve(NOT_FOUND) })

    expect(await screen.findByRole('group', { name: 'Session not found' })).toBeTruthy()
  })

  it('shows the message when the project list refetch fails', async () => {
    renderContent({
      list: Promise.resolve(NOT_FOUND),
      detail: Promise.resolve(NOT_FOUND),
      projects: () => Promise.resolve({ ok: false, error: { code: 'unreadable' } })
    })

    expect(await screen.findByRole('group', { name: 'Session not found' })).toBeTruthy()
  })

  it('keeps the message mounted, with focus on Back, through a background refetch of the list', async () => {
    const { api, client } = renderContent({
      list: Promise.resolve({ ok: true, value: [] }),
      detail: Promise.resolve(NOT_FOUND)
    })
    const group = await screen.findByRole('group', { name: 'Session not found' })
    const back = screen.getByRole('button', { name: 'Back to sessions' })
    back.focus()
    const refetch = deferred<IpcResult<readonly SessionListItemDto[]>>()
    api.listSessions.mockReturnValueOnce(refetch.promise)

    const refetching = act(async () => {
      await client.invalidateQueries({ queryKey: ['sessions', DIR] })
    })
    await waitFor(() => {
      expect(api.listSessions).toHaveBeenCalledTimes(2)
    })
    await settle()

    expect(screen.getByRole('group', { name: 'Session not found' })).toBe(group)
    expect(screen.queryByRole('heading', { name: 'Loading session' })).toBeNull()
    expect(document.activeElement).toBe(back)

    refetch.resolve({ ok: true, value: [] })
    await refetching
    expect(screen.getByRole('group', { name: 'Session not found' })).toBe(group)
  })
})

describe('SessionDetailContent load announcement', () => {
  it('announces the session by its title once, after loading was on screen', async () => {
    const detail = deferred<IpcResult<SessionDetailDto>>()
    renderContent({ detail: detail.promise })
    await screen.findByRole('heading', { level: 1, name: 'Loading session' })

    detail.resolve(GOOD)

    expect((await screen.findByText('Kept loaded')).getAttribute('role')).toBe('status')
  })

  it('announces nothing when the detail was already cached on mount', async () => {
    const client = createTestQueryClient()
    client.setQueryData(['session', REF.projectDirName, REF.sessionId], testDetail())
    installBeekeeperApi({
      listSessions: () => Promise.resolve({ ok: true, value: SESSIONS }),
      getSession: () => Promise.resolve(GOOD)
    })

    render(<SessionDetailContent sessionRef={REF} dirName={DIR} />, {
      wrapper: createQueryWrapper(client)
    })
    await screen.findByRole('heading', { level: 1, name: 'Kept' })
    await settle()

    expect(screen.queryByText(/loaded/)).toBeNull()
  })

  it('waits for the folder’s list, so it names the session by its title', async () => {
    const list = deferred<IpcResult<readonly SessionListItemDto[]>>()
    const { api } = renderContent({ list: list.promise })
    await waitFor(() => {
      expect(api.getSession).toHaveBeenCalled()
    })
    await screen.findByRole('heading', { level: 1, name: 'Session' })
    await settle()

    expect(screen.queryByText(/loaded/)).toBeNull()

    list.resolve({ ok: true, value: SESSIONS })
    expect(await screen.findByText('Kept loaded')).toBeTruthy()
  })
})
