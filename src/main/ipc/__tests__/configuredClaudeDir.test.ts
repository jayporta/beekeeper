import { existsSync, watch } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildDiscoveryTree, type DiscoveryTree } from '../../../core/transcript/testDiscoveryTree'
import { buildAiTitleRecord, buildJsonlText } from '../../../core/transcript/testFixtures'
import { createProjectsWatcher } from '../../live/createProjectsWatcher'
import { createIpcDeps } from '../createIpcDeps'
import { listProjectsHandler } from '../listProjectsHandler'
import { listSessionsHandler } from '../listSessionsHandler'
import { TEST_SESSION_ID, registerIpcTestTree } from '../testIpcTree'

const ctx = registerIpcTestTree()

const CONFIGURED_PROJECT = '-Users-test-configured'

let configured: DiscoveryTree | undefined

/** A synthetic Claude folder, apart from the test's home, holding one project and one session. */
async function buildConfiguredTree(): Promise<string> {
  configured = await buildDiscoveryTree({
    files: {
      [`claude-data/projects/${CONFIGURED_PROJECT}/${TEST_SESSION_ID}.jsonl`]: buildJsonlText([
        buildAiTitleRecord('Configured title')
      ])
    }
  })
  return join(configured.root, 'claude-data')
}

afterEach(async () => {
  await configured?.cleanup()
  configured = undefined
})

describe('createIpcDeps projects root', () => {
  it('is projects under .claude in the home folder when no config folder is given', () => {
    expect(createIpcDeps('/home/someone').projectsRoot).toBe('/home/someone/.claude/projects')
  })

  it('is projects under the config folder when one is given', () => {
    expect(createIpcDeps('/home/someone', '/data/claude/').projectsRoot).toBe(
      '/data/claude/projects'
    )
  })

  it('stays under the home folder when the config folder is relative', () => {
    expect(createIpcDeps('/home/someone', 'claude').projectsRoot).toBe(
      '/home/someone/.claude/projects'
    )
  })
})

describe('a configured Claude folder', () => {
  it('is where the projects are listed from, not the home folder', async () => {
    const deps = createIpcDeps(ctx.tree.home, await buildConfiguredTree())

    expect(await listProjectsHandler(deps)).toEqual({
      ok: true,
      value: [{ dirName: CONFIGURED_PROJECT, label: null, worktreeOf: null, worktreeName: null }]
    })
  })

  it('is where the sessions of a project are listed from', async () => {
    const deps = createIpcDeps(ctx.tree.home, await buildConfiguredTree())

    const result = await listSessionsHandler(deps, { projectDirName: CONFIGURED_PROJECT })

    expect(result).toMatchObject({
      ok: true,
      value: [
        { sessionId: TEST_SESSION_ID, summary: { ok: true, value: { title: 'Configured title' } } }
      ]
    })
  })

  describe('that does not exist', () => {
    const missing = (): string => join(ctx.tree.home, 'no-such-claude-folder')

    it('lists no projects and creates nothing', async () => {
      const result = await listProjectsHandler(createIpcDeps(ctx.tree.home, missing()))

      expect(result).toEqual({ ok: true, value: [] })
      expect(existsSync(missing())).toBe(false)
    })

    it('is waited for by the watcher, and trying to watch it creates nothing', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
      const { projectsRoot } = createIpcDeps(ctx.tree.home, missing())
      // The test home has its own projects folder, so pin that the watcher gets the configured one.
      expect(projectsRoot).toBe(join(missing(), 'projects'))
      const watcher = createProjectsWatcher({
        root: projectsRoot,
        watch,
        exists: existsSync,
        windows: () => []
      })

      watcher.start()
      watcher.close()

      // A missing root is waited for quietly; any other failure would warn that live updates stopped.
      expect(warn).not.toHaveBeenCalled()
      expect(existsSync(missing())).toBe(false)
      warn.mockRestore()
    })
  })
})
