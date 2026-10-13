import { describe, expect, it } from 'vitest'
import { testDetail } from '../../../../shared/agentGraph/testSessionDetail'
import {
  testAgentRole,
  testLeadTeam,
  testRef,
  testSession,
  testSessionId,
  testTeammateTeam
} from '../../../../shared/sessions/testSessionFixtures'
import { createTestHost, type TestPath } from '../../../testHost'
import type { StartOutcome } from '../../start/startMod'
import { createPaneRefresher, type PaneHost } from '../paneRefresher'
import type { PaneView } from '../paneView'
import { testPaneServices, type TestPaneServices } from '../testPaneServices'

const ROOT = '/home/u/.claude/projects'
const ID = testSessionId(1)
const READY: StartOutcome = { kind: 'ready', projectsRoot: ROOT, gitDisabled: false }

function projects(folder: string | null): Record<string, TestPath> {
  const paths: Record<string, TestPath> = {
    [ROOT]: {
      kind: 'dir',
      entries:
        folder === null ? [] : [{ name: folder, kind: 'dir', size: 0, mtimeMs: 1, isLink: false }]
    }
  }
  if (folder !== null) paths[`${ROOT}/${folder}/${ID}.jsonl`] = { kind: 'file', mtimeMs: 1 }
  return paths
}

interface Setup {
  readonly written: PaneView[]
  readonly services: TestPaneServices
  readonly refresher: ReturnType<typeof createPaneRefresher>
  readonly starts: string[]
  readonly built: string[]
}

function setup(options: {
  folder?: string | null
  start?: StartOutcome
  sessionId?: () => Promise<string>
  list?: ReturnType<typeof testSession>[]
}): Setup {
  const { folder = '-p', start = READY, list = [testSession(1, { title: 'Hi' })] } = options
  const written: PaneView[] = []
  const starts: string[] = []
  const built: string[] = []
  const services = testPaneServices({
    list: { ok: true, value: list },
    get: { ok: true, value: testDetail() }
  })
  const pane: PaneHost = {
    sessionId: options.sessionId ?? (async () => ID),
    sessionRoot: async () => '/work/app',
    now: async () => 42,
    writeView: async (view) => {
      written.push(view)
    }
  }
  const refresher = createPaneRefresher({
    host: createTestHost({ paths: projects(folder) }),
    pane,
    start: async (_host, session) => {
      starts.push(session.cwd)
      return start
    },
    createServices: (root) => {
      built.push(root)
      return services
    }
  })
  return { written, services, refresher, starts, built }
}

describe('createPaneRefresher', () => {
  it('writes a ready view of the session found in its folder', async () => {
    const { written, refresher } = setup({})

    await refresher.refresh({ withList: true })

    expect(written).toHaveLength(1)
    expect(written[0]).toMatchObject({ sessionId: ID, status: 'ready', label: 'Hi' })
  })

  it('writes a waiting view when no folder holds the transcript yet', async () => {
    const { written, refresher, services } = setup({ folder: null })

    await refresher.refresh({ withList: true })

    expect(written[0]).toMatchObject({ status: 'waiting', root: null })
    expect(services.getCalls).toBe(0)
  })

  it('writes nothing when the mod could not start', async () => {
    const { written, refresher } = setup({ start: { kind: 'failed' } })

    await refresher.refresh({ withList: true })

    expect(written).toEqual([])
  })

  it('starts the mod itself, in the session root, when no session.start ran here', async () => {
    const { refresher, starts } = setup({})

    await refresher.refresh({ withList: false })
    await refresher.refresh({ withList: false })

    expect(starts).toEqual(['/work/app'])
  })

  it('reuses a start made by session.start', async () => {
    const { refresher, starts } = setup({})

    await refresher.start('/started')
    await refresher.refresh({ withList: false })

    expect(starts).toEqual(['/started'])
  })

  it('builds the services once for a projects folder', async () => {
    const { refresher, built } = setup({})

    await refresher.refresh({ withList: true })
    await refresher.refresh({ withList: true })

    expect(built).toEqual([ROOT])
  })

  it('lists on a first plain refresh, then reuses the list', async () => {
    const { refresher, services } = setup({})

    await refresher.refresh({ withList: false })
    await refresher.refresh({ withList: false })

    expect(services.listCalls).toBe(1)
    expect(services.getCalls).toBe(2)
  })

  it('writes an internal error view, without a message, when something rejects', async () => {
    const { written, refresher } = setup({
      sessionId: async () => {
        throw new Error('secret /home/u/x')
      }
    })

    await refresher.refresh({ withList: true })

    expect(written[0]).toMatchObject({ status: 'error', errorCode: 'internal' })
    expect(JSON.stringify(written[0])).not.toContain('secret')
  })

  it('wants the list tick only when the last view shows a team', async () => {
    const lead = testSession(1, { title: 'Lead', team: testLeadTeam([testRef(2)]) })
    const mate = testSession(2, {
      role: testAgentRole('writer', 'code'),
      team: testTeammateTeam(testRef(1))
    })
    const solo = setup({})
    const team = setup({ list: [lead, mate] })

    await solo.refresher.refresh({ withList: true })
    await team.refresher.refresh({ withList: true })

    expect(solo.refresher.wantsListTick()).toBe(false)
    expect(team.refresher.wantsListTick()).toBe(true)
  })
})
