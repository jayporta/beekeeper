import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import type { ProjectDto } from '../../../../../shared/ipc/projectDto'
import type { IpcResult } from '../../../../../shared/ipc/ipcResult'
import type { SessionDetailDto } from '../../../../../shared/ipc/sessionDetailDto'
import type { SessionListItemDto } from '../../../../../shared/ipc/sessionListDto'
import { useNavigationStore } from '@renderer/features/navigation/state/useNavigationStore'
import { testRef, testSession } from '../../../../../shared/sessions/testSessionFixtures'
import { installBeekeeperApi, testProject, type TestBeekeeperApi } from '@renderer/testBeekeeperApi'
import {
  createQueryWrapper,
  createTestQueryClient,
  refetchAndSettle
} from '@renderer/testQueryWrapper'
import { SessionDetailContent } from '../SessionDetailContent'
import { testDetail } from '../../../../../shared/agentGraph/testSessionDetail'

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

  it.each([
    [
      'settles with the reported folder still in effect',
      { ok: true, value: [testProject(DIR)] } as IpcResult<readonly ProjectDto[]>
    ],
    [
      'refetch fails',
      { ok: false, error: { code: 'unreadable' } } as IpcResult<readonly ProjectDto[]>
    ]
  ])(
    'holds the message while the project list refetches after the folder is reported gone, then shows it when the project list %s',
    async (_outcome, answer) => {
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

      projects.resolve(answer)
      expect(await screen.findByRole('group', { name: 'Session not found' })).toBeTruthy()
    }
  )

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

describe('SessionDetailContent for an archived session', () => {
  const ARCHIVED_NOTICE =
    "This session's transcript was removed. Showing the copy beekeeper archived."

  /** The two places the notice appears: the live region that announces it, and the visible text. */
  function noticeElements(): { announced: HTMLElement[]; visible: HTMLElement[] } {
    const all = screen.queryAllByText(ARCHIVED_NOTICE)
    return {
      announced: all.filter((element) => element.closest('[role="status"]') !== null),
      visible: all.filter((element) => element.closest('[role="status"]') === null)
    }
  }

  it('says the transcript was removed and the shown copy is the archive', async () => {
    renderContent({
      detail: Promise.resolve({ ok: true, value: testDetail({ archived: true }) })
    })

    await screen.findAllByText(ARCHIVED_NOTICE)

    const { announced, visible } = noticeElements()
    expect([announced.length, visible.length]).toEqual([1, 1])
  })

  it('hides the visible notice from assistive technology, since the live region says it', async () => {
    renderContent({
      detail: Promise.resolve({ ok: true, value: testDetail({ archived: true }) })
    })
    await screen.findAllByText(ARCHIVED_NOTICE)

    const [visible] = noticeElements().visible

    expect(visible).toBeDefined()
    expect(visible?.closest('[aria-hidden="true"]')).not.toBeNull()
  })

  it('shows no such notice for a session read from disk', async () => {
    renderContent()

    await screen.findByRole('heading', { level: 1, name: 'Kept' })

    expect(screen.queryByText(ARCHIVED_NOTICE)).toBeNull()
  })

  it('announces the notice in a status region that was already mounted when a live session turns archived', async () => {
    const { client } = renderContent()
    await screen.findByRole('heading', { level: 1, name: 'Kept' })
    const regionsBefore = screen.getAllByRole('status')
    expect(regionsBefore.some((region) => region.textContent === ARCHIVED_NOTICE)).toBe(false)

    act(() => {
      client.setQueryData(['session', DIR, REF.sessionId], testDetail({ archived: true }))
    })

    await waitFor(() => {
      expect(noticeElements().announced).toHaveLength(1)
    })
    const [announced] = noticeElements().announced
    expect(regionsBefore).toContain(announced?.closest('[role="status"]'))
  })
})

describe('SessionDetailContent for an archived session whose detail was not archived', () => {
  const ARCHIVED_ROW: readonly SessionListItemDto[] = [
    testSession(1, { projectDirName: DIR, title: 'Kept', archived: true, totalTokens: 1500 })
  ]
  const NOTE = 'Only a summary was archived'
  const SUMMARY_ONLY_SENTENCE =
    "This session's transcript was removed. beekeeper archived only its summary."

  /** Renders the content with the archived row already cached but stale, so the list reloads on mount with `list`'s answer. */
  function renderWithStaleArchivedList(
    list: Promise<IpcResult<readonly SessionListItemDto[]>>
  ): TestBeekeeperApi {
    const client = createTestQueryClient()
    client.setQueryData(['sessions', DIR], ARCHIVED_ROW, { updatedAt: 0 })
    const api = installBeekeeperApi({
      listProjects: () => Promise.resolve({ ok: true, value: [testProject(DIR)] }),
      listSessions: () => list,
      getSession: () => Promise.resolve(NOT_FOUND)
    })
    render(<SessionDetailContent sessionRef={REF} dirName={DIR} />, {
      wrapper: createQueryWrapper(client)
    })
    return api
  }

  it('shows the header from the row and the summary-only note instead of "Session not found"', async () => {
    renderContent({
      list: Promise.resolve({ ok: true, value: ARCHIVED_ROW }),
      detail: Promise.resolve(NOT_FOUND)
    })

    const note = await screen.findByRole('group', { name: NOTE })

    expect(note.querySelector('h2')?.textContent).toBe(NOTE)
    expect(screen.getByRole('heading', { level: 1, name: 'Kept' })).toBeTruthy()
    expect(screen.getByText('Tokens', { selector: 'dt' }).nextElementSibling?.textContent).toBe(
      '1.5K'
    )
    expect(screen.getAllByText(SUMMARY_ONLY_SENTENCE).length).toBeGreaterThan(0)
    expect(screen.queryByRole('group', { name: 'Session not found' })).toBeNull()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  })

  it('words the header for a summary, not for a copy of the whole session', async () => {
    renderContent({
      list: Promise.resolve({ ok: true, value: ARCHIVED_ROW }),
      detail: Promise.resolve(NOT_FOUND)
    })
    await screen.findByRole('group', { name: NOTE })

    expect(screen.queryByText(/Showing the copy beekeeper archived/)).toBeNull()
    expect(screen.getAllByText(SUMMARY_ONLY_SENTENCE)).toHaveLength(1)
  })

  it('leaves the header’s status region empty, so the note’s alert is the one announcement', async () => {
    renderContent({
      list: Promise.resolve({ ok: true, value: ARCHIVED_ROW }),
      detail: Promise.resolve(NOT_FOUND)
    })
    await screen.findByRole('group', { name: NOTE })

    const regions = screen.getAllByRole('status')

    expect(regions.map((region) => region.textContent)).toEqual(['', ''])
    expect(screen.getAllByRole('alert')).toHaveLength(1)
  })

  it('keeps the header sentence readable by assistive technology, since nothing else says it', async () => {
    renderContent({
      list: Promise.resolve({ ok: true, value: ARCHIVED_ROW }),
      detail: Promise.resolve(NOT_FOUND)
    })
    await screen.findByRole('group', { name: NOTE })

    const [sentence] = screen.getAllByText(SUMMARY_ONLY_SENTENCE)

    expect(sentence?.closest('[aria-hidden="true"]')).toBeNull()
  })

  it('goes back to the sessions list from the note', async () => {
    useNavigationStore.getState().showSession(REF)
    renderContent({
      list: Promise.resolve({ ok: true, value: ARCHIVED_ROW }),
      detail: Promise.resolve(NOT_FOUND)
    })
    await screen.findByRole('group', { name: NOTE })

    await userEvent.click(screen.getByRole('button', { name: 'Back to sessions' }))

    expect(useNavigationStore.getState().view).toBe('sessions')
  })

  it('still says "Session not found" for a live row', async () => {
    renderContent({ detail: Promise.resolve(NOT_FOUND) })

    expect(await screen.findByRole('group', { name: 'Session not found' })).toBeTruthy()
    expect(screen.queryByRole('group', { name: NOTE })).toBeNull()
  })

  it('shows loading, not the note, while the folder’s list loads', async () => {
    const list = deferred<IpcResult<readonly SessionListItemDto[]>>()
    const { api } = renderContent({ list: list.promise, detail: Promise.resolve(NOT_FOUND) })
    await waitFor(() => {
      expect(api.getSession).toHaveBeenCalled()
    })
    await settle()

    expect(screen.getByRole('heading', { level: 1, name: 'Loading session' })).toBeTruthy()
    expect(screen.queryByRole('group')).toBeNull()

    list.resolve({ ok: true, value: ARCHIVED_ROW })
    expect(await screen.findByRole('group', { name: NOTE })).toBeTruthy()
  })

  it('shows loading, not the note, while a cached list that held the archived row refetches', async () => {
    const list = deferred<IpcResult<readonly SessionListItemDto[]>>()
    const api = renderWithStaleArchivedList(list.promise)
    await waitFor(() => {
      expect(api.getSession).toHaveBeenCalled()
    })
    await settle()

    expect(screen.getAllByRole('heading', { level: 1 }).map((h) => h.textContent)).toEqual([
      'Loading session'
    ])
    expect(screen.queryByRole('group')).toBeNull()

    list.resolve({ ok: true, value: [] })
    expect(await screen.findByRole('group', { name: 'Session not found' })).toBeTruthy()
  })

  it('says "Session not found" when the folder itself is gone, even if its cached list held the archived row', async () => {
    renderWithStaleArchivedList(Promise.resolve(NOT_FOUND))

    expect(await screen.findByRole('group', { name: 'Session not found' })).toBeTruthy()
    expect(screen.queryByRole('group', { name: NOTE })).toBeNull()
  })

  it('shows the retry error, not the note, for a failure other than not found', async () => {
    renderContent({
      list: Promise.resolve({ ok: true, value: ARCHIVED_ROW }),
      detail: Promise.resolve(UNREADABLE)
    })

    const alert = await screen.findByRole('alert')

    expect(alert.textContent).toContain("Can't read this session")
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy()
    expect(screen.queryByRole('group', { name: NOTE })).toBeNull()
    expect(screen.queryByRole('heading', { level: 1, name: 'Kept' })).toBeNull()
  })

  it('announces the missing detail once, and not as a loaded session', async () => {
    renderContent({
      list: Promise.resolve({ ok: true, value: ARCHIVED_ROW }),
      detail: Promise.resolve(NOT_FOUND)
    })
    await screen.findByRole('group', { name: NOTE })

    const alerts = screen.getAllByRole('alert')

    expect(alerts).toHaveLength(1)
    expect(alerts[0]?.textContent).toContain(NOTE)
    expect(screen.queryByText(/loaded/)).toBeNull()
  })

  it('announces the note with a fresh alert when it replaces "Session not found" after the list refetches', async () => {
    const { api, client } = renderContent({
      list: Promise.resolve({ ok: true, value: [] }),
      detail: Promise.resolve(NOT_FOUND)
    })
    await screen.findByRole('group', { name: 'Session not found' })
    const first = screen.getByRole('alert')
    api.listSessions.mockResolvedValue({ ok: true, value: ARCHIVED_ROW })

    await refetchAndSettle(client, ['sessions', DIR])

    expect(await screen.findByRole('group', { name: NOTE })).toBeTruthy()
    const second = screen.getByRole('alert')
    expect(second).not.toBe(first)
    expect(second.textContent).toContain(NOTE)
  })

  it('moves focus to the note when it replaces a focused Retry', async () => {
    const { api } = renderContent({
      list: Promise.resolve({ ok: true, value: ARCHIVED_ROW }),
      detail: Promise.resolve(UNREADABLE)
    })
    const retry = await screen.findByRole('button', { name: 'Retry' })
    api.getSession.mockResolvedValue(NOT_FOUND)
    await userEvent.click(retry)

    const note = await screen.findByRole('group', { name: NOTE })

    expect(document.activeElement).toBe(note)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('shows the note at once, and announces it, when a remount finds the not-found error cached', async () => {
    const { client } = renderContent({
      list: Promise.resolve({ ok: true, value: ARCHIVED_ROW }),
      detail: Promise.resolve(NOT_FOUND)
    })
    await screen.findByRole('group', { name: NOTE })
    cleanup()

    render(<SessionDetailContent sessionRef={REF} dirName={DIR} />, {
      wrapper: createQueryWrapper(client)
    })

    expect(await screen.findByRole('group', { name: NOTE })).toBeTruthy()
    expect(screen.getAllByRole('alert')).toHaveLength(1)
  })
})
