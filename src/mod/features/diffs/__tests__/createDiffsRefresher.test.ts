import { describe, expect, it } from 'vitest'
import type { IpcResult } from '../../../../shared/ipc/ipcResult'
import type { AgentWorktreeDiffDto, WorktreeDiffsDto } from '../../../../shared/ipc/worktreeDiffDto'
import { testRef } from '../../../../shared/sessions/testSessionFixtures'
import { testPaneNode, testPaneView } from '../../pane/testPaneView'
import type { PaneNode, PaneView } from '../../pane/paneView'
import { LIST_TICK_MS } from '../../pane/paneScheduler'
import { testPaneServices, type TestPaneServices } from '../../shared/testPaneServices'
import { createDiffsRefresher, type DiffsRefresher } from '../createDiffsRefresher'
import type { PaneDiffs } from '../paneDiffs'

const REF = testRef(2)

function worktreeNode(agentId: string): PaneNode {
  return testPaneNode(`sub:${agentId}`, {
    worktree: {
      projectDirName: REF.projectDirName,
      sessionId: REF.sessionId,
      agentId,
      branch: `feat/${agentId}`
    }
  })
}

const entry = (agentId: string): AgentWorktreeDiffDto => ({
  agentId,
  inferredBase: false,
  result: { ok: true, diff: { uncommitted: 'included', files: [], untracked: [] } }
})

const viewOf = (...nodes: PaneNode[]): PaneView =>
  testPaneView(testPaneNode('lead', { children: nodes }))

function setup(options: { writes?: (d: PaneDiffs) => Promise<boolean> } = {}): {
  written: PaneDiffs[]
  logs: string[]
  refresher: DiffsRefresher
  services: TestPaneServices
} {
  const written: PaneDiffs[] = []
  const logs: string[] = []
  const refresher = createDiffsRefresher({
    writeDiffs: async (diffs) => {
      written.push(diffs)
      return options.writes === undefined ? true : options.writes(diffs)
    },
    log: (code) => logs.push(code)
  })
  const services = testPaneServices({
    list: { ok: true, value: [] },
    get: { ok: false, error: { code: 'internal' } },
    diffs: {
      ok: true,
      value: { git: 'ok', agents: [entry('a1'), entry('a2')], sharedWorktree: null }
    }
  })
  return { written, logs, refresher, services }
}

const pick = (key: string): { sessionId: string; key: string } => ({ sessionId: 's1', key })

describe('createDiffsRefresher', () => {
  it('stores null once, and asks for nothing, when the selected node has no worktree', async () => {
    const { written, refresher, services } = setup()
    const view = viewOf(testPaneNode('sub:plain'))

    await refresher.refresh({ services, view, selected: pick('sub:plain'), nowMs: 1 })
    await refresher.refresh({ services, view, selected: pick('sub:plain'), nowMs: 2 })

    expect(written.map((d) => d.status)).toEqual(['none'])
    expect(services.diffCalls).toBe(0)
  })

  it('stores null for a view that is not ready', async () => {
    const { written, refresher, services } = setup()
    const view = { ...viewOf(worktreeNode('a1')), status: 'loading' as const }

    await refresher.refresh({ services, view, selected: pick('sub:a1'), nowMs: 1 })

    expect(written.map((d) => d.status)).toEqual(['none'])
    expect(services.diffCalls).toBe(0)
  })

  it("stores a loading diff, then the agent's, each under the viewed session and the node's key", async () => {
    const { written, refresher, services } = setup()

    await refresher.refresh({
      services,
      view: viewOf(worktreeNode('a1')),
      selected: pick('sub:a1'),
      nowMs: 1
    })

    expect(written.map((d) => [d.sessionId, d.key, d.status])).toEqual([
      ['s1', 'sub:a1', 'loading'],
      ['s1', 'sub:a1', 'ready']
    ])
    expect(services.diffedSessions).toEqual([`${REF.projectDirName}/${REF.sessionId}`])
  })

  it('asks once when the selection moves between two agents of the same session', async () => {
    const { written, refresher, services } = setup()
    const view = viewOf(worktreeNode('a1'), worktreeNode('a2'))

    await refresher.refresh({ services, view, selected: pick('sub:a1'), nowMs: 1 })
    await refresher.refresh({ services, view, selected: pick('sub:a2'), nowMs: 2 })

    expect(services.diffCalls).toBe(1)
    expect(written.at(-1)).toMatchObject({ key: 'sub:a2', status: 'ready' })
  })

  it('does not ask again inside the window when the view changed, and does once the window is over', async () => {
    const { refresher, services } = setup()
    const selected = pick('sub:a1')

    await refresher.refresh({ services, view: viewOf(worktreeNode('a1')), selected, nowMs: 1 })
    const changed = viewOf(worktreeNode('a1'), worktreeNode('a2'))
    await refresher.refresh({ services, view: changed, selected, nowMs: LIST_TICK_MS })
    await refresher.refresh({ services, view: changed, selected, nowMs: 1 + LIST_TICK_MS })

    expect(services.diffCalls).toBe(2)
  })

  it('stores an error with the service code when the service fails', async () => {
    const { written, refresher, services } = setup()
    services.getWorktreeDiffs = async () => ({ ok: false, error: { code: 'not-found' } })

    await refresher.refresh({
      services,
      view: viewOf(worktreeNode('a1')),
      selected: pick('sub:a1'),
      nowMs: 1
    })

    expect(written.at(-1)).toMatchObject({ status: 'error', errorCode: 'not-found' })
  })

  it('stores an internal error and logs a code when the service throws', async () => {
    const { written, logs, refresher } = setup()
    const services = testPaneServices({
      list: { ok: true, value: [] },
      get: { ok: false, error: { code: 'internal' } },
      diffs: new Error('boom at /secret/path')
    })

    await refresher.refresh({
      services,
      view: viewOf(worktreeNode('a1')),
      selected: pick('sub:a1'),
      nowMs: 1
    })

    expect(written.at(-1)).toMatchObject({ status: 'error', errorCode: 'internal' })
    expect(logs).toEqual(['pane-diffs-failed'])
  })

  it('does not retry a failure inside the window', async () => {
    const { refresher } = setup()
    const services = testPaneServices({
      list: { ok: true, value: [] },
      get: { ok: false, error: { code: 'internal' } },
      diffs: new Error('x')
    })
    const view = viewOf(worktreeNode('a1'))

    await refresher.refresh({ services, view, selected: pick('sub:a1'), nowMs: 1 })
    await refresher.refresh({ services, view, selected: pick('sub:a1'), nowMs: 2 })

    expect(services.diffCalls).toBe(1)
  })

  it('stores invalid-request and asks for nothing when the owner ref is not valid', async () => {
    const { written, refresher, services } = setup()
    const bad = testPaneNode('sub:a1', {
      worktree: { projectDirName: '../x', sessionId: 'nope', agentId: 'a1', branch: 'b' }
    })

    await refresher.refresh({ services, view: viewOf(bad), selected: pick('sub:a1'), nowMs: 1 })

    expect(written.at(-1)).toMatchObject({ status: 'error', errorCode: 'invalid-request' })
    expect(services.diffCalls).toBe(0)
  })

  it('writes again a diff the engine refused to store', async () => {
    let accept = false
    const { written, refresher, services } = setup({ writes: async () => accept })
    const input = { services, view: viewOf(worktreeNode('a1')), selected: pick('sub:a1'), nowMs: 1 }

    await refresher.refresh(input)
    const refused = written.length
    accept = true
    await refresher.refresh(input)

    expect(written.length).toBeGreaterThan(refused)
    expect(written.at(-1)).toMatchObject({ status: 'ready' })
  })

  it('writes an unchanged diff again after forgetStored, and not before', async () => {
    const { written, refresher, services } = setup()
    const input = { services, view: viewOf(worktreeNode('a1')), selected: pick('sub:a1'), nowMs: 1 }

    await refresher.refresh(input)
    await refresher.refresh(input)
    const before = written.length
    refresher.forgetStored()
    await refresher.refresh(input)

    expect(before).toBe(2)
    expect(written.length).toBe(before + 1)
  })

  describe('an agent missing from the fetched diffs', () => {
    const answer = (...ids: string[]): IpcResult<WorktreeDiffsDto> => ({
      ok: true as const,
      value: { git: 'ok' as const, agents: ids.map(entry), sharedWorktree: null }
    })

    it('asks again when the view changed because the agent was just spawned, and stores loading first', async () => {
      const { written, refresher, services } = setup()
      let calls = 0
      services.getWorktreeDiffs = async () =>
        (calls += 1) === 1 ? answer('a1') : answer('a1', 'a2')

      await refresher.refresh({
        services,
        view: viewOf(worktreeNode('a1')),
        selected: pick('sub:a1'),
        nowMs: 1
      })
      await refresher.refresh({
        services,
        view: viewOf(worktreeNode('a1'), worktreeNode('a2')),
        selected: pick('sub:a2'),
        nowMs: 2
      })

      expect(calls).toBe(2)
      expect(written.slice(-2).map((d) => [d.key, d.status])).toEqual([
        ['sub:a2', 'loading'],
        ['sub:a2', 'ready']
      ])
      expect(written.at(-1)?.result).toMatchObject({ ok: true })
    })

    it('does not ask again while the view is unchanged, whatever the service holds', async () => {
      const { refresher, services } = setup()
      let calls = 0
      services.getWorktreeDiffs = async () => ((calls += 1), answer('a1'))
      const view = viewOf(worktreeNode('a1'), worktreeNode('a2'))

      await refresher.refresh({ services, view, selected: pick('sub:a2'), nowMs: 1 })
      await refresher.refresh({ services, view, selected: pick('sub:a2'), nowMs: 2 })

      expect(calls).toBe(1)
    })
  })
})
