import type { QueryClient } from '@tanstack/react-query'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect, useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import type { IpcResult } from '../../../../shared/ipc/ipcResult'
import type { ProjectDto } from '../../../../shared/ipc/projectDto'
import { BackStatus } from '@renderer/features/navigation/BackStatus'
import { useNavigationStore } from '@renderer/features/navigation/state/useNavigationStore'
import { sessionDetailQueryOptions } from '@renderer/features/sessionDetail/sessionDetailQuery'
import { useSelectedProjectDirName } from '@renderer/features/projects/state/useSelectedProjectDirName'
import { useSelectedProjectStore } from '@renderer/features/projects/state/useSelectedProjectStore'
import { IpcCallError } from '@renderer/ipc/ipcCallError'
import { installBeekeeperApi, testProject } from '@renderer/testBeekeeperApi'
import {
  createQueryWrapper,
  createTestQueryClient,
  refetchAndSettle
} from '@renderer/testQueryWrapper'
import { resetPersistedState } from '@renderer/testRenderApp'
import { useGoBack } from '../useGoBack'
import { useResetNavigationOnProjectChange } from '../useResetNavigationOnProjectChange'

const refA = { projectDirName: 'a', sessionId: '11111111-1111-4111-8111-111111111111' }
const agent = { kind: 'subagent', ownerRef: refA, agentId: 'agent-a1' } as const

/** The folders the stubbed project list names. A test changes it before refetching. */
let listed: string[] = []
/** The client the harness renders with, to seed or inspect the cache. */
let client: QueryClient
/** The `goBack` the harness got on its first render, which a test calls later to see what it knew then. */
let firstGoBack: (() => void) | undefined

afterEach(async () => {
  firstGoBack = undefined
  await resetPersistedState()
})

/** Wires the app's navigation hooks and shows what they report, with a button that goes back. */
function Harness(): React.JSX.Element {
  useResetNavigationOnProjectChange()
  const { canGoBack, goBack, announcement } = useGoBack()
  const [first] = useState(() => goBack)
  useEffect(() => {
    firstGoBack = first
  }, [first])
  return (
    <>
      <p>{`project:${useSelectedProjectDirName() ?? 'none'}`}</p>
      <p>{canGoBack ? 'can go back' : 'cannot go back'}</p>
      <BackStatus message={announcement.message} id={announcement.id} />
      <button type="button" onClick={goBack}>
        Go back
      </button>
    </>
  )
}

const listing = (...names: string[]): Promise<IpcResult<readonly ProjectDto[]>> =>
  Promise.resolve({ ok: true, value: names.map((name) => testProject(name)) })

/** Renders the harness with projects `names` listed, once the first of them is in effect. */
async function renderHarness(...names: string[]): Promise<void> {
  listed = names
  client = createTestQueryClient()
  installBeekeeperApi({ listProjects: () => listing(...listed) })
  render(<Harness />, { wrapper: createQueryWrapper(client) })
  await screen.findByText(`project:${names[0] ?? ''}`)
}

/** Caches a failed load of `ref`'s detail that reported `not-found`, as opening a deleted session does. */
async function reportSessionGone(ref: {
  projectDirName: string
  sessionId: string
}): Promise<void> {
  await client
    .fetchQuery({
      queryKey: sessionDetailQueryOptions(ref).queryKey,
      queryFn: () => Promise.reject(new IpcCallError('not-found'))
    })
    .catch(() => undefined)
}

/** Opens project `dirName`'s sessions list, as pressing it in the sidebar does. */
function chooseProject(dirName: string): void {
  act(() => {
    useSelectedProjectStore.getState().select(dirName)
    useNavigationStore.getState().showSessions(dirName)
  })
}

const goBack = (): Promise<void> => userEvent.click(screen.getByRole('button', { name: 'Go back' }))

describe('useGoBack', () => {
  it('reports it cannot go back before the person has navigated', async () => {
    await renderHarness('a')

    expect(screen.getByText('cannot go back')).toBeTruthy()
  })

  it('reports it can go back once the person has navigated', async () => {
    await renderHarness('a')

    act(() => {
      useNavigationStore.getState().showOverview()
    })

    expect(screen.getByText('can go back')).toBeTruthy()
  })

  it('returns to the view the person left', async () => {
    await renderHarness('a')
    act(() => {
      useNavigationStore.getState().showOverview()
    })

    await goBack()

    expect(useNavigationStore.getState()).toMatchObject({ view: 'sessions', history: [] })
    expect(screen.getByText('cannot go back')).toBeTruthy()
  })

  it('returns to a session with the agent that was selected in it', async () => {
    await renderHarness('a')
    act(() => {
      useNavigationStore.getState().showSession(refA)
      useNavigationStore.getState().selectAgent(agent)
      useNavigationStore.getState().showSessions()
    })

    await goBack()

    expect(useNavigationStore.getState()).toMatchObject({
      view: 'session',
      selectedSessionRef: refA,
      selectedAgent: agent
    })
  })

  it('counts as a navigation, so focus moves', async () => {
    await renderHarness('a')
    act(() => {
      useNavigationStore.getState().showOverview()
    })
    const before = useNavigationStore.getState().navigationCount

    await goBack()

    expect(useNavigationStore.getState().navigationCount).toBe(before + 1)
  })

  it('steps back one entry at a time without recording the steps', async () => {
    await renderHarness('a')
    act(() => {
      useNavigationStore.getState().showOverview()
      useNavigationStore.getState().showSession(refA)
    })

    await goBack()
    expect(useNavigationStore.getState().view).toBe('overview')

    await goBack()
    expect(useNavigationStore.getState().view).toBe('sessions')
    expect(useNavigationStore.getState().history).toEqual([])
  })

  it('does nothing when there is nowhere to go back to', async () => {
    await renderHarness('a')
    const before = useNavigationStore.getState()

    await goBack()

    expect(useNavigationStore.getState()).toBe(before)
  })

  it('selects the project of the entry and keeps the session it restores', async () => {
    await renderHarness('a', 'b')
    act(() => {
      useNavigationStore.getState().showSession(refA, agent)
    })
    chooseProject('b')
    await screen.findByText('project:b')

    await goBack()
    await screen.findByText('project:a')

    expect(useNavigationStore.getState()).toMatchObject({
      view: 'session',
      selectedSessionRef: refA,
      selectedAgent: agent,
      restoringProject: null
    })
  })

  it('resets on the next project change after a Back across projects', async () => {
    await renderHarness('a', 'b')
    act(() => {
      useNavigationStore.getState().showSession(refA)
    })
    chooseProject('b')
    await screen.findByText('project:b')
    await goBack()
    await screen.findByText('project:a')

    act(() => {
      useSelectedProjectStore.getState().select('b')
    })
    await screen.findByText('project:b')

    expect(useNavigationStore.getState().view).toBe('sessions')
  })

  it('leaves the selected project alone when the entry is in the project in effect', async () => {
    await renderHarness('a', 'b')
    act(() => {
      useNavigationStore.getState().showSession(refA)
      useNavigationStore.getState().showSessions()
    })

    await goBack()

    expect(useSelectedProjectStore.getState().selectedDirName).toBeNull()
    expect(useNavigationStore.getState().restoringProject).toBeNull()
  })

  it('goes back to the overview without selecting a project', async () => {
    await renderHarness('a', 'b')
    act(() => {
      useNavigationStore.getState().showOverview()
    })
    chooseProject('b')
    await screen.findByText('project:b')

    await goBack()

    expect(useNavigationStore.getState().view).toBe('overview')
    expect(screen.getByText('project:b')).toBeTruthy()
  })

  it('skips an entry whose project is no longer listed', async () => {
    await renderHarness('a', 'b')
    // The newest entry names a project that is gone; the one before it is the overview.
    useNavigationStore.setState({
      history: [
        { view: 'overview', projectDirName: null, sessionRef: null, agent: null },
        { view: 'session', projectDirName: 'gone', sessionRef: refA, agent: null }
      ]
    })

    await goBack()

    expect(useNavigationStore.getState()).toMatchObject({ view: 'overview', history: [] })
  })

  it('stays where it is when no entry names a listed project', async () => {
    await renderHarness('a')
    act(() => {
      useNavigationStore.getState().showSession(refA)
    })
    useNavigationStore.setState({
      history: [{ view: 'sessions', projectDirName: 'gone', sessionRef: null, agent: null }]
    })

    await goBack()

    expect(useNavigationStore.getState()).toMatchObject({
      view: 'session',
      selectedSessionRef: refA,
      history: []
    })
  })

  it('waits while the project list has not loaded, keeping the history', async () => {
    installBeekeeperApi({ listProjects: () => new Promise(() => undefined) })
    render(<Harness />, { wrapper: createQueryWrapper() })
    act(() => {
      useNavigationStore.getState().showOverview()
    })

    await goBack()

    expect(useNavigationStore.getState().history).toHaveLength(1)
    expect(useNavigationStore.getState().view).toBe('overview')
  })

  it('skips an entry that is the place already on screen', async () => {
    await renderHarness('a')
    // A replaced session leaves its sessions list as the newest entry, in front of the overview.
    useNavigationStore.setState({
      history: [
        { view: 'overview', projectDirName: null, sessionRef: null, agent: null },
        { view: 'sessions', projectDirName: 'a', sessionRef: null, agent: null }
      ]
    })

    await goBack()

    expect(useNavigationStore.getState()).toMatchObject({ view: 'overview', history: [] })
  })

  it('has nothing to go back to once a missing session is left for the sessions list it was opened from', async () => {
    await renderHarness('a')
    act(() => {
      useNavigationStore.getState().showSession(refA)
      useNavigationStore.getState().replaceWithSessions()
    })

    expect(screen.getByText('cannot go back')).toBeTruthy()
  })

  it('skips a session that has been reported not found, and goes on to the entry before it', async () => {
    await renderHarness('a')
    act(() => {
      useNavigationStore.getState().showOverview()
      useNavigationStore.getState().showSession(refA)
      useNavigationStore.getState().showSessions()
    })
    await reportSessionGone(refA)
    client.setQueryData(['sessions', 'a'], [])

    await goBack()

    expect(useNavigationStore.getState()).toMatchObject({
      view: 'overview',
      selectedSessionRef: null
    })
  })

  it('restores a session that has not been reported not found', async () => {
    await renderHarness('a')
    act(() => {
      useNavigationStore.getState().showSession(refA)
      useNavigationStore.getState().showSessions()
    })

    await goBack()

    expect(useNavigationStore.getState()).toMatchObject({
      view: 'session',
      selectedSessionRef: refA
    })
  })

  it('uses the project list as it is when Back is pressed, not as it was when the function was made', async () => {
    await renderHarness('a', 'b')
    useNavigationStore.setState({
      history: [{ view: 'sessions', projectDirName: 'b', sessionRef: null, agent: null }]
    })
    listed = ['a']
    await refetchAndSettle(client, ['projects'])

    act(() => {
      firstGoBack?.()
    })

    expect(useNavigationStore.getState()).toMatchObject({ view: 'sessions', history: [] })
    expect(useNavigationStore.getState().currentProjectDirName).toBe('a')
    expect(screen.getByText('project:a')).toBeTruthy()
  })

  describe('when a press leads nowhere', () => {
    const NOTHING = 'Nothing to go back to'

    it('says so when every entry is one that cannot be shown', async () => {
      await renderHarness('a')
      useNavigationStore.setState({
        history: [{ view: 'sessions', projectDirName: 'gone', sessionRef: null, agent: null }]
      })

      await goBack()

      expect(await screen.findByText(NOTHING)).toBeTruthy()
      expect(useNavigationStore.getState().history).toEqual([])
    })

    it('says so when there is no history at all', async () => {
      await renderHarness('a')

      await goBack()

      expect(await screen.findByText(NOTHING)).toBeTruthy()
    })

    it('says it again for a second press, as a new announcement', async () => {
      await renderHarness('a')
      await goBack()
      const first = await screen.findByText(NOTHING)

      await goBack()

      expect(await screen.findByText(NOTHING)).not.toBe(first)
    })

    it('says nothing when the press goes back', async () => {
      await renderHarness('a')
      act(() => {
        useNavigationStore.getState().showOverview()
      })

      await goBack()

      expect(screen.queryByText(NOTHING)).toBeNull()
    })

    it('says nothing while the project list has not loaded, since the press is only waiting', async () => {
      installBeekeeperApi({ listProjects: () => new Promise(() => undefined) })
      render(<Harness />, { wrapper: createQueryWrapper() })

      await goBack()

      expect(screen.queryByText(NOTHING)).toBeNull()
    })
  })
})
