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
  readonly logs: string[]
  readonly clock: { now: number }
  readonly startCalls: () => number
}

function setup(options: {
  folder?: string | null
  start?: StartOutcome
  sessionId?: () => Promise<string>
  list?: ReturnType<typeof testSession>[]
  writeView?: (view: PaneView) => Promise<boolean>
  probe?: () => Promise<StartOutcome>
}): Setup {
  const { folder = '-p', start = READY, list = [testSession(1, { title: 'Hi' })] } = options
  const written: PaneView[] = []
  const starts: string[] = []
  const built: string[] = []
  const logs: string[] = []
  const clock = { now: 42 }
  let startCalls = 0
  const services = testPaneServices({
    list: { ok: true, value: list },
    get: { ok: true, value: testDetail() }
  })
  const pane: PaneHost = {
    sessionId: options.sessionId ?? (async () => ID),
    sessionRoot: async () => '/work/app',
    now: async () => clock.now,
    writeView:
      options.writeView ??
      (async (view) => {
        written.push(view)
        return true
      })
  }
  const refresher = createPaneRefresher({
    host: createTestHost({ paths: projects(folder) }),
    pane,
    start: async (_host, session) => {
      starts.push(session.cwd)
      startCalls += 1
      return options.probe ? options.probe() : start
    },
    log: (line) => logs.push(line),
    createServices: (root) => {
      built.push(root)
      return services
    }
  })
  return { written, services, refresher, starts, built, logs, clock, startCalls: () => startCalls }
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

  it('writes an error view with a code when Claude Code is too old', async () => {
    const { written, refresher } = setup({ start: { kind: 'too-old', version: '2.1.200' } })

    await refresher.refresh({ withList: true })

    expect(written[0]).toMatchObject({ status: 'error', errorCode: 'too-old', sessionId: ID })
  })

  it('writes an error view with a code when the mod could not start', async () => {
    const { written, refresher } = setup({ start: { kind: 'failed' } })

    await refresher.refresh({ withList: true })

    expect(written[0]).toMatchObject({ status: 'error', errorCode: 'start-failed' })
  })

  it('does not start again on later refreshes after a failed start', async () => {
    const { refresher, starts } = setup({ start: { kind: 'failed' } })

    await refresher.refresh({ withList: true })
    await refresher.refresh({ withList: true })

    expect(starts).toHaveLength(1)
  })

  it('starts again when session.start asks after a failed start', async () => {
    const { refresher, starts } = setup({ start: { kind: 'failed' } })

    await refresher.refresh({ withList: true })
    await refresher.start('/again')

    expect(starts).toEqual(['/work/app', '/again'])
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

  it('lists a session without a team at most every 10 seconds, to keep its total and title current', async () => {
    const { refresher, services, clock } = setup({})

    await refresher.refresh({ withList: false })
    clock.now += 9_000
    await refresher.refresh({ withList: false })
    clock.now += 1_000
    await refresher.refresh({ withList: false })

    expect(services.listCalls).toBe(2)
    expect(services.getCalls).toBe(3)
  })

  it('lists when asked to, even inside the 10 seconds', async () => {
    const { refresher, services } = setup({})

    await refresher.refresh({ withList: true })
    await refresher.refresh({ withList: true })

    expect(services.listCalls).toBe(2)
  })

  it('reuses the list on a plain refresh of a session with a team', async () => {
    const lead = testSession(1, { title: 'Lead', team: testLeadTeam([testRef(2)]) })
    const mate = testSession(2, {
      role: testAgentRole('writer', 'code'),
      team: testTeammateTeam(testRef(1))
    })
    const { refresher, services } = setup({ list: [lead, mate] })

    await refresher.refresh({ withList: true })
    await refresher.refresh({ withList: false })
    await refresher.refresh({ withList: false })

    expect(services.listCalls).toBe(1)
    expect(services.getCalls).toBe(3)
  })

  it('writes the same view again after it is told the stored view is gone', async () => {
    const { written, refresher } = setup({})

    await refresher.refresh({ withList: true })
    refresher.forgetStored()
    await refresher.refresh({ withList: true })

    expect(written).toHaveLength(2)
  })

  it('runs one start probe when two overlap, and gives both the same outcome', async () => {
    let release: (outcome: StartOutcome) => void = () => {}
    const pending = new Promise<StartOutcome>((resolve) => {
      release = resolve
    })
    const { refresher, startCalls } = setup({ probe: () => pending })

    const first = refresher.start('/a')
    const second = refresher.start('/b')
    release(READY)

    expect(await first).toBe(await second)
    expect(startCalls()).toBe(1)
  })

  it('does not replace a ready start with a later failure', async () => {
    const outcomes: StartOutcome[] = [READY, { kind: 'failed' }]
    const { refresher } = setup({ probe: async () => outcomes.shift() ?? READY })

    await refresher.start('/a')
    const again = await refresher.start('/b')

    expect(again.kind).toBe('ready')
  })

  it('does not write a view that is the same as the last one apart from its time', async () => {
    const { written, refresher } = setup({})

    await refresher.refresh({ withList: true })
    await refresher.refresh({ withList: true })

    expect(written).toHaveLength(1)
  })

  it('keeps the last view when the engine refuses a write, and writes the same view again', async () => {
    let accept = false
    const written: PaneView[] = []
    const { refresher } = setup({
      writeView: async (view) => {
        written.push(view)
        return accept
      }
    })

    await refresher.refresh({ withList: true })
    accept = true
    await refresher.refresh({ withList: true })

    expect(written).toHaveLength(2)
  })

  it('does not take a refused view for the last one when deciding on the list tick', async () => {
    const lead = testSession(1, { title: 'Lead', team: testLeadTeam([testRef(2)]) })
    const mate = testSession(2, {
      role: testAgentRole('writer', 'code'),
      team: testTeammateTeam(testRef(1))
    })
    const { refresher } = setup({ list: [lead, mate], writeView: async () => false })

    await refresher.refresh({ withList: true })

    expect(refresher.wantsListTick()).toBe(false)
  })

  it('logs a code, and does not reject, when writing the view throws', async () => {
    const { refresher, logs } = setup({
      writeView: async () => {
        throw new Error('secret /home/u/x')
      }
    })

    await expect(refresher.refresh({ withList: true })).resolves.toBeUndefined()

    expect(logs).toEqual(['pane-write-failed'])
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
