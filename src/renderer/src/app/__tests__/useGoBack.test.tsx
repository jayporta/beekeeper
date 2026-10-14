import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import type { IpcResult } from '../../../../shared/ipc/ipcResult'
import type { ProjectDto } from '../../../../shared/ipc/projectDto'
import { useNavigationStore } from '@renderer/features/navigation/state/useNavigationStore'
import { useSelectedProjectDirName } from '@renderer/features/projects/state/useSelectedProjectDirName'
import { useSelectedProjectStore } from '@renderer/features/projects/state/useSelectedProjectStore'
import { installBeekeeperApi, testProject } from '@renderer/testBeekeeperApi'
import { createQueryWrapper } from '@renderer/testQueryWrapper'
import { resetPersistedState } from '@renderer/testRenderApp'
import { useGoBack } from '../useGoBack'
import { useResetNavigationOnProjectChange } from '../useResetNavigationOnProjectChange'

const refA = { projectDirName: 'a', sessionId: '11111111-1111-4111-8111-111111111111' }
const agent = { kind: 'subagent', ownerRef: refA, agentId: 'agent-a1' } as const

afterEach(async () => {
  await resetPersistedState()
})

/** Wires the app's navigation hooks and shows what they report, with a button that goes back. */
function Harness(): React.JSX.Element {
  useResetNavigationOnProjectChange()
  const { canGoBack, goBack } = useGoBack()
  return (
    <>
      <p>{`project:${useSelectedProjectDirName() ?? 'none'}`}</p>
      <p>{canGoBack ? 'can go back' : 'cannot go back'}</p>
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
  installBeekeeperApi({ listProjects: () => listing(...names) })
  render(<Harness />, { wrapper: createQueryWrapper() })
  await screen.findByText(`project:${names[0] ?? ''}`)
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
})
