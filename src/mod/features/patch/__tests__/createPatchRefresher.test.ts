import { describe, expect, it } from 'vitest'
import { testRef } from '../../../../shared/sessions/testSessionFixtures'
import { testPaneNode, testPaneView } from '../../pane/testPaneView'
import type { PaneNode } from '../../pane/paneView'
import { testPaneServices, type TestPaneServices } from '../../shared/testPaneServices'
import { createPatchRefresher } from '../createPatchRefresher'
import { emptyPanePatch, type PanePatch } from '../panePatch'

const REF = testRef(2)

const node = (agentId: string): PaneNode =>
  testPaneNode(`sub:${agentId}`, {
    worktree: {
      projectDirName: REF.projectDirName,
      sessionId: REF.sessionId,
      agentId,
      branch: 'b'
    }
  })

const view = testPaneView(testPaneNode('lead', { children: [node('a1'), node('a2')] }))
const loading = (key: string, sessionId = 's1'): PanePatch =>
  emptyPanePatch({ sessionId, key, status: 'loading', nowMs: 1 })

const READY = {
  ok: true as const,
  value: {
    kind: 'ready' as const,
    uncommitted: 'included' as const,
    truncatedTotal: false,
    files: [{ path: 'f', patch: 'diff --git a/f b/f\n@@ -1 +1 @@\n+x\n', truncated: false }]
  }
}

function setup(
  stored: PanePatch | undefined,
  services: Partial<{ patch: Parameters<typeof testPaneServices>[0]['patch'] }> = { patch: READY }
): {
  written: PanePatch[]
  logs: string[]
  state: { current: PanePatch | undefined }
  refresh: (selectedKey?: string) => Promise<void>
  services: TestPaneServices
} {
  const written: PanePatch[] = []
  const logs: string[] = []
  const state = { current: stored }
  const fake = testPaneServices({
    list: { ok: true, value: [] },
    get: { ok: false, error: { code: 'internal' } },
    ...services
  })
  const refresher = createPatchRefresher({
    readPatch: async () => state.current,
    writePatch: async (patch) => {
      written.push(patch)
      state.current = patch
      return true
    },
    log: (code) => logs.push(code)
  })
  return {
    written,
    logs,
    state,
    services: fake,
    refresh: (selectedKey = 'sub:a1') =>
      refresher.refresh({
        services: fake,
        view,
        selected: { sessionId: 's1', key: selectedKey },
        nowMs: 9
      })
  }
}

describe('createPatchRefresher', () => {
  it('loads a patch that was asked for, once', async () => {
    const { written, refresh, services } = setup(loading('sub:a1'))

    await refresh()
    await refresh()

    expect(written).toHaveLength(1)
    expect(written[0]).toMatchObject({ status: 'ready', key: 'sub:a1', refreshedAtMs: 9 })
    expect(services.patchedAgents).toEqual([`${REF.projectDirName}/${REF.sessionId}/a1`])
  })

  it('leaves a ready or hidden patch alone on a tick', async () => {
    for (const status of ['ready', 'none', 'error'] as const) {
      const { written, refresh, services } = setup(
        emptyPanePatch({ sessionId: 's1', key: 'sub:a1', status, nowMs: 1 })
      )

      await refresh()

      expect(written).toEqual([])
      expect(services.patchCalls).toBe(0)
    }
  })

  it('does nothing before any press', async () => {
    const { written, refresh, services } = setup(undefined)

    await refresh()

    expect(written).toEqual([])
    expect(services.patchCalls).toBe(0)
  })

  it('ignores a request for another node or another session than the shown one', async () => {
    const other = setup(loading('sub:a2'))
    const elsewhere = setup(loading('sub:a1', 's2'))

    await other.refresh('sub:a1')
    await elsewhere.refresh()

    expect(other.written).toEqual([])
    expect(elsewhere.written).toEqual([])
    expect(other.services.patchCalls + elsewhere.services.patchCalls).toBe(0)
  })

  it('drops a result when the stored patch no longer asks for that node', async () => {
    const { written, refresh, state, services } = setup(loading('sub:a1'))
    services.getWorktreePatch = async () => {
      state.current = loading('sub:a2')
      return READY
    }

    await refresh()

    expect(written).toEqual([])
  })

  it('drops a result when the patch was hidden while it loaded', async () => {
    const { written, refresh, state, services } = setup(loading('sub:a1'))
    services.getWorktreePatch = async () => {
      state.current = emptyPanePatch({ sessionId: 's1', key: 'sub:a1', status: 'none', nowMs: 2 })
      return READY
    }

    await refresh()

    expect(written).toEqual([])
  })

  it('stores a service error code, and an internal error with a logged code when the call throws', async () => {
    const failing = setup(loading('sub:a1'), {
      patch: { ok: false, error: { code: 'not-found' } }
    })
    const throwing = setup(loading('sub:a1'), { patch: new Error('boom at /secret') })

    await failing.refresh()
    await throwing.refresh()

    expect(failing.written[0]).toMatchObject({ status: 'error', errorCode: 'not-found' })
    expect(throwing.written[0]).toMatchObject({ status: 'error', errorCode: 'internal' })
    expect(throwing.logs).toEqual(['pane-patch-failed'])
  })

  it('stores invalid-request without asking when the owner ref is not valid', async () => {
    const bad = testPaneNode('sub:a1', {
      worktree: { projectDirName: '../x', sessionId: 'nope', agentId: 'a1', branch: 'b' }
    })
    const { written, services } = setup(loading('sub:a1'))
    const refresher = createPatchRefresher({
      readPatch: async () => loading('sub:a1'),
      writePatch: async (patch) => (written.push(patch), true),
      log: () => {}
    })

    await refresher.refresh({
      services,
      view: testPaneView(testPaneNode('lead', { children: [bad] })),
      selected: { sessionId: 's1', key: 'sub:a1' },
      nowMs: 1
    })

    expect(written[0]).toMatchObject({ status: 'error', errorCode: 'invalid-request' })
    expect(services.patchCalls).toBe(0)
  })
})
