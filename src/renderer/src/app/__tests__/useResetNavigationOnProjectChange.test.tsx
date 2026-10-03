import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { IpcResult } from '../../../../shared/ipc/ipcResult'
import type { ProjectDto } from '../../../../shared/ipc/projectDto'
import { useSelectedProjectDirName } from '@renderer/features/projects/state/useSelectedProjectDirName'
import { useSelectedProjectStore } from '@renderer/features/projects/state/useSelectedProjectStore'
import { installBeekeeperApi, testProject } from '@renderer/testBeekeeperApi'
import {
  createQueryWrapper,
  createTestQueryClient,
  refetchAndSettle
} from '@renderer/testQueryWrapper'
import { resetPersistedState } from '@renderer/testRenderApp'
import { useNavigationStore } from '@renderer/features/navigation/state/useNavigationStore'
import { useResetNavigationOnProjectChange } from '../useResetNavigationOnProjectChange'

const ref = { projectDirName: 'a', sessionId: '11111111-1111-4111-8111-111111111111' }

afterEach(async () => {
  useNavigationStore.getState().reset()
  await resetPersistedState()
})

/** Calls the hook and shows the project in effect, so a test can wait for it. */
function Harness(): React.JSX.Element {
  useResetNavigationOnProjectChange()
  return <p>{`project:${useSelectedProjectDirName() ?? 'none'}`}</p>
}

/** Puts the navigation store on a session, as if the person had opened one. */
function openSession(): void {
  act(() => {
    useNavigationStore.getState().showSession(ref, { kind: 'subagent', agentId: 'agent-a1' })
  })
}

const listing = (...names: string[]): Promise<IpcResult<readonly ProjectDto[]>> =>
  Promise.resolve({ ok: true, value: names.map((name) => testProject(name)) })

describe('useResetNavigationOnProjectChange', () => {
  it('keeps the navigation state when the first project loads', async () => {
    installBeekeeperApi({ listProjects: () => listing('a', 'b') })
    useNavigationStore.getState().showSession(ref, { kind: 'subagent', agentId: 'agent-a1' })

    render(<Harness />, { wrapper: createQueryWrapper() })
    await screen.findByText('project:a')

    expect(useNavigationStore.getState().view).toBe('session')
  })

  it('resets to the sessions list when another project is selected', async () => {
    installBeekeeperApi({ listProjects: () => listing('a', 'b') })
    render(<Harness />, { wrapper: createQueryWrapper() })
    await screen.findByText('project:a')
    openSession()

    act(() => {
      useSelectedProjectStore.getState().select('b')
    })
    await screen.findByText('project:b')

    expect(useNavigationStore.getState()).toMatchObject({
      view: 'sessions',
      selectedSessionRef: null,
      selectedAgent: null
    })
  })

  it('resets when the selected project disappears and another takes its place', async () => {
    let names = ['a', 'b']
    installBeekeeperApi({ listProjects: () => listing(...names) })
    useSelectedProjectStore.setState({ selectedDirName: 'b' })
    const client = createTestQueryClient()
    render(<Harness />, { wrapper: createQueryWrapper(client) })
    await screen.findByText('project:b')
    openSession()

    names = ['a']
    await refetchAndSettle(client, ['projects'])
    await screen.findByText('project:a')

    expect(useNavigationStore.getState().view).toBe('sessions')
  })

  it('keeps the overview when the selected project disappears and another takes its place', async () => {
    let names = ['a', 'b']
    installBeekeeperApi({ listProjects: () => listing(...names) })
    useSelectedProjectStore.setState({ selectedDirName: 'b' })
    const client = createTestQueryClient()
    render(<Harness />, { wrapper: createQueryWrapper(client) })
    await screen.findByText('project:b')
    act(() => {
      useNavigationStore.getState().showOverview()
    })

    names = ['a']
    await refetchAndSettle(client, ['projects'])
    await screen.findByText('project:a')

    expect(useNavigationStore.getState().view).toBe('overview')
  })

  it('keeps the navigation state while the same project stays in effect', async () => {
    let names = ['a']
    installBeekeeperApi({ listProjects: () => listing(...names) })
    const client = createTestQueryClient()
    render(<Harness />, { wrapper: createQueryWrapper(client) })
    await screen.findByText('project:a')
    openSession()

    names = ['a', 'b']
    await refetchAndSettle(client, ['projects'])

    expect(useNavigationStore.getState().view).toBe('session')
  })
})
