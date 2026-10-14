import { describe, expect, it } from 'vitest'
import { testDetail, testMeta, testNode } from '../../../../shared/agentGraph/testSessionDetail'
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
import type { ProjectDto } from '../../../../shared/ipc/projectDto'
import { testProject } from '../../../../shared/projects/testProject'
import type { BrowseView } from '../../browse/browseView'
import type { PaneNav } from '../../shared/paneNav'
import { PLAIN_TICK_MS } from '../paneScheduler'
import { createPaneRefresher, type PaneHost } from '../paneRefresher'
import type { PaneView } from '../paneView'
import type { PaneDiffs } from '../../diffs/paneDiffs'
import { emptyPanePatch, type PanePatch } from '../../patch/panePatch'
import type { PaneSelection } from '../selectedNode'
import { testPaneServices, type TestPaneServices } from '../../shared/testPaneServices'

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
  readonly browsed: BrowseView[]
  readonly diffed: PaneDiffs[]
  readonly patched: PanePatch[]
  readonly patchRef: { current: PanePatch | undefined }
  readonly selectedRef: { current: PaneSelection | null }
  readonly navRef: { current: PaneNav | undefined }
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
  projects?: ProjectDto[]
  nav?: PaneNav
  diffs?: Parameters<typeof testPaneServices>[0]['diffs']
  patch?: Parameters<typeof testPaneServices>[0]['patch']
  get?: Parameters<typeof testPaneServices>[0]['get']
}): Setup {
  const { folder = '-p', start = READY, list = [testSession(1, { title: 'Hi' })] } = options
  const written: PaneView[] = []
  const browsed: BrowseView[] = []
  const diffed: PaneDiffs[] = []
  const patched: PanePatch[] = []
  const patchRef: { current: PanePatch | undefined } = { current: undefined }
  const selectedRef: { current: PaneSelection | null } = { current: null }
  const navRef: { current: PaneNav | undefined } = { current: options.nav }
  const starts: string[] = []
  const built: string[] = []
  const logs: string[] = []
  const clock = { now: 42 }
  let startCalls = 0
  const services = testPaneServices({
    list: { ok: true, value: list },
    get: options.get ?? { ok: true, value: testDetail() },
    projects: { ok: true, value: options.projects ?? [testProject('-p')] },
    diffs: options.diffs,
    patch: options.patch
  })
  const pane: PaneHost = {
    sessionId: options.sessionId ?? (async () => ID),
    sessionRoot: async () => '/work/app',
    now: async () => clock.now,
    nav: async () => navRef.current,
    writeBrowse: async (view) => {
      browsed.push(view)
      return true
    },
    selected: async () => selectedRef.current,
    writeDiffs: async (diffs) => {
      diffed.push(diffs)
      return true
    },
    patch: async () => patchRef.current,
    writePatch: async (patch) => {
      patched.push(patch)
      patchRef.current = patch
      return true
    },
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
  return {
    written,
    browsed,
    diffed,
    patched,
    patchRef,
    selectedRef,
    navRef,
    services,
    refresher,
    starts,
    built,
    logs,
    clock,
    startCalls: () => startCalls
  }
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

  it('lists a session without a team about every 10 seconds, to keep its total and title current', async () => {
    const { refresher, services, clock } = setup({})

    await refresher.refresh({ withList: false })
    clock.now += 8_000
    await refresher.refresh({ withList: false })
    clock.now += 1_000
    await refresher.refresh({ withList: false })

    expect(services.listCalls).toBe(2)
    expect(services.getCalls).toBe(3)
  })

  it('still lists when a tick lands a little under 10 seconds after the last list', async () => {
    const { refresher, services, clock } = setup({})

    await refresher.refresh({ withList: false })
    clock.now += PLAIN_TICK_MS - 400
    await refresher.refresh({ withList: false })

    expect(services.listCalls).toBe(2)
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

  describe('on the browse screen', () => {
    const browse: PaneNav = { screen: 'browse', projectDirName: null }

    it('builds nothing on a plain refresh', async () => {
      const { written, browsed, services, refresher } = setup({ nav: browse })

      await refresher.refresh({ withList: false })

      expect([written, browsed, services.listCalls, services.getCalls]).toEqual([[], [], 0, 0])
    })

    it("stores a browse view of the current session's folder on a list refresh, and no pane view", async () => {
      const { written, browsed, refresher } = setup({ nav: browse })

      await refresher.refresh({ withList: true })

      expect(written).toEqual([])
      expect(browsed.at(-1)).toMatchObject({ status: 'ready', projectDirName: '-p' })
      expect(browsed.at(-1)?.rows).toHaveLength(1)
    })

    it('lists the projects when Browse opens, not again on a later list refresh', async () => {
      const { services, refresher } = setup({ nav: browse })

      await refresher.refresh({ withList: true })
      await refresher.refresh({ withList: true })

      expect(services.projectCalls).toBe(1)
      expect(services.listCalls).toBe(2)
    })

    it('lists the projects again when the nav leaves Browse and returns', async () => {
      const { services, refresher, navRef } = setup({ nav: browse })

      await refresher.refresh({ withList: true })
      navRef.current = { screen: 'current' }
      await refresher.refresh({ withList: false })
      navRef.current = browse
      await refresher.refresh({ withList: true })

      expect(services.projectCalls).toBe(2)
    })

    it('does not list the projects again when a project is picked, since the list is held', async () => {
      const { services, refresher, navRef } = setup({
        nav: browse,
        projects: [testProject('-p'), testProject('-q')]
      })

      await refresher.refresh({ withList: true })
      navRef.current = { screen: 'browse', projectDirName: '-q' }
      await refresher.refresh({ withList: true })

      expect(services.listedFolders).toEqual(['-p', '-q'])
      expect(services.projectCalls).toBe(1)
    })

    it('lists the projects again on a list tick while the known list is empty', async () => {
      const { services, refresher } = setup({ nav: browse, projects: [] })

      await refresher.refresh({ withList: true })
      await refresher.refresh({ withList: true })

      expect(services.projectCalls).toBe(2)
    })

    it("keeps the project it resolved on a later list tick, even when the current session's folder can no longer be found", async () => {
      let sessionId = ID
      const { services, refresher } = setup({
        nav: browse,
        sessionId: async () => sessionId,
        projects: [testProject('-a'), testProject('-p')]
      })

      await refresher.refresh({ withList: true })
      sessionId = testSessionId(9)
      await refresher.refresh({ withList: true })

      expect(services.listedFolders).toEqual(['-p', '-p'])
    })

    it('does not let a plain tick use up the change to Browse', async () => {
      const { services, refresher, navRef } = setup({ nav: browse })

      await refresher.refresh({ withList: true })
      navRef.current = { screen: 'current' }
      await refresher.refresh({ withList: false })
      navRef.current = browse
      await refresher.refresh({ withList: false })
      await refresher.refresh({ withList: true })

      expect(services.projectCalls).toBe(2)
    })

    it('does not store the same browse view twice', async () => {
      const { browsed, refresher } = setup({ nav: browse })

      await refresher.refresh({ withList: true })
      const stored = browsed.length
      await refresher.refresh({ withList: true })

      expect(browsed).toHaveLength(stored)
    })

    it('stores a browse view again after it is told the stored views are gone', async () => {
      const { browsed, refresher } = setup({ nav: browse })

      await refresher.refresh({ withList: true })
      const stored = browsed.length
      refresher.forgetStored()
      await refresher.refresh({ withList: true })

      expect(browsed.length).toBeGreaterThan(stored)
    })

    it('stores an error browse view with a code when the mod could not start', async () => {
      const { browsed, refresher } = setup({ nav: browse, start: { kind: 'failed' } })

      await refresher.refresh({ withList: true })

      expect(browsed[0]).toMatchObject({ status: 'error', errorCode: 'start-failed' })
    })

    it('keeps the picked project in the error view when the mod could not start', async () => {
      const { browsed, refresher } = setup({
        nav: { screen: 'browse', projectDirName: '-q' },
        start: { kind: 'failed' }
      })

      await refresher.refresh({ withList: true })

      expect(browsed[0]).toMatchObject({ errorCode: 'start-failed', projectDirName: '-q' })
    })

    it('keeps the held projects in the error view when a later refresh fails', async () => {
      let broken = false
      const { browsed, refresher } = setup({
        nav: browse,
        projects: [testProject('-p'), testProject('-q')],
        sessionId: async () => {
          if (broken) throw new Error('secret')
          return ID
        }
      })

      await refresher.refresh({ withList: true })
      broken = true
      await refresher.refresh({ withList: true })

      expect(browsed.at(-1)).toMatchObject({ status: 'error', errorCode: 'internal' })
      expect(browsed.at(-1)?.projects).toHaveLength(2)
    })

    it("opens on the current session's folder again when Browse is reopened, even if the refresher saw no other screen between", async () => {
      const { services, refresher, navRef } = setup({
        nav: { screen: 'browse', projectDirName: '-q', openId: 1 },
        projects: [testProject('-p'), testProject('-q')]
      })

      await refresher.refresh({ withList: true })
      navRef.current = { screen: 'browse', projectDirName: null, openId: 2 }
      await refresher.refresh({ withList: true })

      expect(services.listedFolders).toEqual(['-q', '-p'])
      expect(services.projectCalls).toBe(2)
    })

    it('does not store a view from a refresh that began before Browse was reopened', async () => {
      const { services, browsed, refresher, navRef } = setup({
        nav: { screen: 'browse', projectDirName: '-q', openId: 1 },
        projects: [testProject('-p'), testProject('-q')]
      })
      let release: () => void = () => {}
      const gate = new Promise<void>((resolve) => {
        release = resolve
      })
      const listSessions = services.listSessions
      services.listSessions = async (request) => {
        await gate
        return listSessions(request)
      }

      const inFlight = refresher.refresh({ withList: true })
      await new Promise((resolve) => setTimeout(resolve, 10))
      navRef.current = { screen: 'browse', projectDirName: null, openId: 2 }
      release()
      await inFlight

      expect(browsed).toEqual([])
    })

    it('wants the list tick', async () => {
      const { refresher } = setup({ nav: browse })

      await refresher.refresh({ withList: false })

      expect(refresher.wantsListTick()).toBe(true)
    })
  })

  describe('on a browsed session', () => {
    const other = { projectDirName: '-other', sessionId: testSessionId(7) }
    const session: PaneNav = { screen: 'session', ref: other, backTo: '-other' }

    it('builds the view of the browsed session, tagged as browsed', async () => {
      const { written, services, refresher } = setup({ nav: session })

      await refresher.refresh({ withList: true })

      expect(services.gotSessions).toEqual([`-other/${other.sessionId}`])
      expect(services.listedFolders).toEqual(['-other'])
      expect(written[0]).toMatchObject({ sessionId: other.sessionId, target: 'browsed' })
    })

    it("tags the current session's view as current", async () => {
      const { written, refresher } = setup({})

      await refresher.refresh({ withList: true })

      expect(written[0]).toMatchObject({ sessionId: ID, target: 'current' })
    })

    it('writes the current view again after returning from a browsed session', async () => {
      const { written, refresher, navRef } = setup({ nav: session })

      await refresher.refresh({ withList: true })
      navRef.current = { screen: 'current' }
      await refresher.refresh({ withList: true })

      expect(written.map((view) => view.target)).toEqual(['browsed', 'current'])
    })

    it("lists the browsed session's folder again after the nav changed, even inside the solo interval", async () => {
      const { services, refresher, navRef } = setup({})

      await refresher.refresh({ withList: true })
      navRef.current = session
      await refresher.refresh({ withList: false })

      expect(services.listedFolders).toEqual(['-p', '-other'])
    })

    it('treats a nav that cannot be read as the current screen', async () => {
      const written: PaneView[] = []
      const broken = createPaneRefresher({
        host: createTestHost({ paths: projects('-p') }),
        pane: {
          sessionId: async () => ID,
          sessionRoot: async () => '/work/app',
          now: async () => 1,
          nav: async () => {
            throw new Error('nope')
          },
          writeView: async (view) => (written.push(view), true),
          writeBrowse: async () => true,
          selected: async () => null,
          writeDiffs: async () => true,
          patch: async () => undefined,
          writePatch: async () => true
        },
        start: async () => READY,
        createServices: () =>
          testPaneServices({
            list: { ok: true, value: [testSession(1)] },
            get: { ok: true, value: testDetail() }
          })
      })

      await broken.refresh({ withList: true })

      expect(written[0]).toMatchObject({ sessionId: ID, target: 'current' })
    })
  })

  describe('when building throws', () => {
    const other = { projectDirName: '-other', sessionId: testSessionId(7) }
    const failing = (message: string) => async (): Promise<string> => {
      throw new Error(message)
    }

    it('tags the error view with the browsed session, so it is not taken for loading forever', async () => {
      const { written, refresher } = setup({
        nav: { screen: 'session', ref: other, backTo: '-other' },
        sessionId: failing('secret /home/u/x')
      })

      await refresher.refresh({ withList: true })

      expect(written[0]).toMatchObject({
        status: 'error',
        errorCode: 'internal',
        target: 'browsed',
        sessionId: other.sessionId
      })
    })

    it('stores an error Browse view for the project asked for, so Browse does not stay on loading', async () => {
      const { browsed, refresher } = setup({
        nav: { screen: 'browse', projectDirName: '-q' },
        sessionId: failing('secret /home/u/x')
      })

      await refresher.refresh({ withList: true })

      expect(browsed).toHaveLength(1)
      expect(browsed[0]).toMatchObject({
        status: 'error',
        errorCode: 'internal',
        projectDirName: '-q'
      })
      expect(JSON.stringify(browsed[0])).not.toContain('secret')
    })
  })

  describe('whether Browse is stored', () => {
    it('is not before Browse is built, is after, and is not again once the stored views are forgotten', async () => {
      const { refresher } = setup({ nav: { screen: 'browse', projectDirName: null } })
      expect(refresher.isBrowseStored()).toBe(false)

      await refresher.refresh({ withList: true })
      expect(refresher.isBrowseStored()).toBe(true)

      refresher.forgetStored()
      expect(refresher.isBrowseStored()).toBe(false)
    })
  })
})

describe('createPaneRefresher worktree diffs', () => {
  const worktreeDetail = testDetail({
    children: [testNode('a1', { meta: testMeta({ worktreeBranch: 'feat/x' }) })]
  })
  const diffsAnswer = {
    ok: true as const,
    value: {
      git: 'ok' as const,
      sharedWorktree: null,
      agents: [
        {
          agentId: 'a1',
          inferredBase: false,
          result: {
            ok: true as const,
            diff: { uncommitted: 'included' as const, files: [], untracked: [] }
          }
        }
      ]
    }
  }

  it('loads the diff of a newly selected agent while the view is unchanged', async () => {
    const { written, diffed, selectedRef, refresher, services } = setup({
      get: { ok: true, value: worktreeDetail },
      diffs: diffsAnswer
    })

    await refresher.refresh({ withList: true })
    const key = written[0]?.root?.children[0]?.key ?? ''
    selectedRef.current = { sessionId: ID, key }
    await refresher.refresh({ withList: false })

    expect(written).toHaveLength(1)
    expect(diffed.at(-1)).toMatchObject({ key, status: 'ready' })
    expect(services.diffCalls).toBe(1)
  })

  it('loads the diff even when the engine refuses the view', async () => {
    const { diffed, selectedRef, refresher } = setup({
      get: { ok: true, value: worktreeDetail },
      diffs: diffsAnswer,
      writeView: async () => false
    })
    await refresher.refresh({ withList: true })
    const key = 'sub:-p/' + ID + ':a1'
    selectedRef.current = { sessionId: ID, key }

    await refresher.refresh({ withList: false })

    expect(diffed.at(-1)).toMatchObject({ key, status: 'ready' })
  })

  it('runs no diff work on the Browse screen', async () => {
    const { diffed, refresher, services } = setup({
      get: { ok: true, value: worktreeDetail },
      diffs: diffsAnswer,
      nav: { screen: 'browse', projectDirName: '-p' }
    })

    await refresher.refresh({ withList: true })
    await refresher.refresh({ withList: false })

    expect(diffed).toEqual([])
    expect(services.diffCalls).toBe(0)
  })

  describe('the worktree patch', () => {
    const patchAnswer = {
      ok: true as const,
      value: {
        kind: 'ready' as const,
        uncommitted: 'included' as const,
        truncatedTotal: false,
        files: [
          { path: 'f.ts', patch: 'diff --git a/f.ts b/f.ts\n@@ -1 +1 @@\n+x\n', truncated: false }
        ]
      }
    }
    const key = `sub:-p/${ID}:a1`
    const ask = (): PanePatch => emptyPanePatch({ sessionId: ID, key, status: 'loading', nowMs: 1 })

    it('loads a patch a press asked for, while the view is unchanged, and only once', async () => {
      const { patched, patchRef, selectedRef, refresher, written, services } = setup({
        get: { ok: true, value: worktreeDetail },
        diffs: diffsAnswer,
        patch: patchAnswer
      })
      await refresher.refresh({ withList: true })
      selectedRef.current = { sessionId: ID, key }
      patchRef.current = ask()

      await refresher.refresh({ withList: false })
      await refresher.refresh({ withList: false })

      expect(written).toHaveLength(1)
      expect(patched).toHaveLength(1)
      expect(patched[0]).toMatchObject({ status: 'ready', key })
      expect(services.patchCalls).toBe(1)
    })

    it('loads a patch left loading by a copy with no wiring on the next refresh, such as /beekeeper asks for', async () => {
      const { patched, patchRef, selectedRef, refresher } = setup({
        get: { ok: true, value: worktreeDetail },
        diffs: diffsAnswer,
        patch: patchAnswer
      })
      selectedRef.current = { sessionId: ID, key }
      patchRef.current = ask()

      await refresher.refresh({ withList: true })

      expect(patched.at(-1)).toMatchObject({ status: 'ready', key })
    })

    it('runs no patch work on the Browse screen', async () => {
      const { patched, patchRef, refresher, services } = setup({
        get: { ok: true, value: worktreeDetail },
        patch: patchAnswer,
        nav: { screen: 'browse', projectDirName: '-p' }
      })
      patchRef.current = ask()

      await refresher.refresh({ withList: true })

      expect(patched).toEqual([])
      expect(services.patchCalls).toBe(0)
    })
  })
})
