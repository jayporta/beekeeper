import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import type { IpcResult } from '../../../../../../shared/ipc/ipcResult'
import type { SessionDetailDto } from '../../../../../../shared/ipc/sessionDetailDto'
import { useNavigationStore } from '@renderer/features/navigation/state/useNavigationStore'
import { testRef } from '@renderer/features/sessions/testSessionFixtures'
import { testDetail, testMeta, testNode, testReport, testTokenGroup } from '../../testSessionDetail'
import {
  SCENE_OTHER_FOLDER,
  SCENE_SESSION,
  graphNode,
  graphNodes,
  renderGraphWith
} from '../testGraphScene'

afterEach(() => {
  useNavigationStore.getState().reset()
})

const WRITER = testRef(2)
const TESTER = testRef(3, SCENE_OTHER_FOLDER)

const writerDetail: IpcResult<SessionDetailDto> = {
  ok: true,
  value: testDetail({
    children: [
      testNode('w1', { meta: testMeta({ name: 'drafter', agentType: 'Explore' }) }),
      testNode('a1', { meta: testMeta({ name: 'same-id', agentType: 'Explore' }) })
    ],
    reports: { w1: testReport({ tokenGroups: [testTokenGroup({ input: 70 })] }) }
  })
}

const click = async (name: RegExp): Promise<void> => {
  await userEvent.click(graphNode(name))
}

describe('GraphCanvas teammate expansion', () => {
  it('loads no teammate until one is selected', () => {
    const { api } = renderGraphWith({ teammateDetails: { [WRITER.sessionId]: writerDetail } })

    expect(api.getSession).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: /^drafter/ })).toBeNull()
  })

  it('loads the selected teammate’s session and grafts its subagents under it', async () => {
    const { api } = renderGraphWith({ teammateDetails: { [WRITER.sessionId]: writerDetail } })

    await click(/^writer/)

    expect(
      await screen.findByRole('button', { name: /^drafter, subagent, 70 tokens/ })
    ).toBeTruthy()
    expect(api.getSession).toHaveBeenCalledExactlyOnceWith(WRITER.projectDirName, WRITER.sessionId)
  })

  it('loads a teammate in another folder by its own folder', async () => {
    const { api } = renderGraphWith()

    await click(/^tester/)

    await waitFor(() => {
      expect(api.getSession).toHaveBeenCalledWith(TESTER.projectDirName, TESTER.sessionId)
    })
  })

  it('does not load anything when a subagent is selected', async () => {
    const { api } = renderGraphWith()

    await click(/^scout/)

    expect(api.getSession).not.toHaveBeenCalled()
  })

  it('keeps a teammate’s subagents when the selection moves to another node', async () => {
    renderGraphWith({ teammateDetails: { [WRITER.sessionId]: writerDetail } })
    await click(/^writer/)
    await screen.findByRole('button', { name: /^drafter/ })

    await click(/^scout/)

    expect(screen.getByRole('button', { name: /^drafter/ })).toBeTruthy()
  })

  it('does not load a teammate again when it is selected a second time', async () => {
    const { api } = renderGraphWith({ teammateDetails: { [WRITER.sessionId]: writerDetail } })
    await click(/^writer/)
    await screen.findByRole('button', { name: /^drafter/ })
    await click(/^scout/)

    await click(/^writer/)

    expect(api.getSession).toHaveBeenCalledTimes(1)
  })

  it('opens a teammate a chip preselected as soon as the graph shows', async () => {
    useNavigationStore.getState().showSession(SCENE_SESSION, { kind: 'teammate', ref: WRITER })

    renderGraphWith({ teammateDetails: { [WRITER.sessionId]: writerDetail } })

    expect(await screen.findByRole('button', { name: /^drafter/ })).toBeTruthy()
    expect(graphNode(/^writer/).getAttribute('aria-current')).toBe('true')
  })

  it('does not open a teammate for a session of the same id in another folder', () => {
    useNavigationStore.getState().showSession(SCENE_SESSION, {
      kind: 'teammate',
      ref: testRef(2, SCENE_OTHER_FOLDER)
    })

    const { api } = renderGraphWith()

    expect(api.getSession).not.toHaveBeenCalled()
  })

  it('loads nothing for a preselected teammate that is not in the graph', () => {
    useNavigationStore.getState().showSession(SCENE_SESSION, { kind: 'teammate', ref: testRef(9) })

    const { api } = renderGraphWith()

    expect(api.getSession).not.toHaveBeenCalled()
    expect(graphNode(/^Lead/).getAttribute('aria-current')).toBe('true')
  })

  it('shows a quiet mark on the teammate while its session loads', async () => {
    const { api } = renderGraphWith({
      teammateDetails: { [WRITER.sessionId]: new Promise(() => undefined) }
    })

    await click(/^writer/)

    const button = await screen.findByRole('button', { name: /loading subagents$/ })
    expect(button.getAttribute('aria-busy')).toBe('true')
    expect(button.textContent).toContain('loading…')
    expect(api.getSession).toHaveBeenCalledTimes(1)
  })

  it('clears the mark once the session has loaded', async () => {
    renderGraphWith({ teammateDetails: { [WRITER.sessionId]: writerDetail } })

    await click(/^writer/)

    await screen.findByRole('button', { name: /^drafter/ })
    expect(graphNode(/^writer/).getAttribute('aria-busy')).toBeNull()
    expect(graphNode(/^writer/).textContent).not.toContain('loading')
  })

  it('marks the teammate partial, and adds nothing, when its session fails to load', async () => {
    renderGraphWith({
      teammateDetails: { [WRITER.sessionId]: { ok: false, error: { code: 'unreadable' } } }
    })

    await click(/^writer/)

    await waitFor(() => {
      expect(graphNode(/^writer/).getAttribute('aria-label')).toContain('partial data')
    })
    expect(graphNodes()).toHaveLength(5)
    expect(screen.getByText(/Partial: part of this agent's data/)).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('marks the teammate partial when its subagents folder cannot be read', async () => {
    const unreadable = testDetail({ children: [testNode('w1')], reports: false })
    renderGraphWith({ teammateDetails: { [WRITER.sessionId]: { ok: true, value: unreadable } } })

    await click(/^writer/)

    await waitFor(() => {
      expect(graphNode(/^writer/).getAttribute('aria-label')).toContain('partial data')
    })
  })
})

describe('GraphCanvas grafted subagents', () => {
  it('select by the teammate’s session, not the lead’s', async () => {
    renderGraphWith({ teammateDetails: { [WRITER.sessionId]: writerDetail } })
    await click(/^writer/)

    await userEvent.click(await screen.findByRole('button', { name: /^drafter/ }))

    expect(useNavigationStore.getState().selectedAgent).toEqual({
      kind: 'subagent',
      ownerRef: WRITER,
      agentId: 'w1'
    })
    expect(graphNode(/^drafter/).getAttribute('aria-current')).toBe('true')
  })

  it('stay distinct from a lead’s subagent with the same agent id', async () => {
    renderGraphWith({ teammateDetails: { [WRITER.sessionId]: writerDetail } })
    await click(/^writer/)

    await userEvent.click(await screen.findByRole('button', { name: /^same-id/ }))

    expect(useNavigationStore.getState().selectedAgent).toMatchObject({
      ownerRef: WRITER,
      agentId: 'a1'
    })
    expect(graphNode(/^scout/).getAttribute('aria-current')).toBeNull()
    expect(graphNode(/^same-id/).getAttribute('aria-current')).toBe('true')
  })

  it('are reached from their teammate with the right arrow', async () => {
    renderGraphWith({ teammateDetails: { [WRITER.sessionId]: writerDetail } })
    await click(/^writer/)
    await screen.findByRole('button', { name: /^drafter/ })

    graphNode(/^writer/).focus()
    await userEvent.keyboard('{ArrowRight}')

    expect(document.activeElement).toBe(graphNode(/^drafter/))
  })
})
