import { chmod, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createIpcDeps } from '../createIpcDeps'
import { guardIpc } from '../guardIpc'
import { getSessionHandler } from '../getSessionHandler'
import type { IpcDeps } from '../ipcDeps'
import { listProjectsHandler } from '../listProjectsHandler'
import { listSessionsHandler } from '../listSessionsHandler'
import { createScanScheduler } from '../scanScheduler'
import {
  TEST_PROJECT,
  TEST_SESSION_ID,
  UNKNOWN_META_FIELD,
  registerIpcTestTree
} from '../testIpcTree'

const ctx = registerIpcTestTree()

const notFound = { ok: false, error: { code: 'not-found' } }
const invalid = { ok: false, error: { code: 'invalid-request' } }

describe('listProjectsHandler', () => {
  it('lists project folder names and nothing else', async () => {
    expect(await listProjectsHandler(ctx.deps)).toEqual({
      ok: true,
      value: [{ dirName: TEST_PROJECT }]
    })
  })

  it('returns an empty list when the projects root does not exist', async () => {
    const result = await listProjectsHandler(createIpcDeps(`${ctx.tree.home}/nowhere`))
    expect(result).toEqual({ ok: true, value: [] })
  })
})

describe('listSessionsHandler', () => {
  it('lists a session with its summary and subagent count', async () => {
    const result = await listSessionsHandler(ctx.deps, { projectDirName: TEST_PROJECT })
    expect(result).toMatchObject({
      ok: true,
      value: [
        {
          sessionId: TEST_SESSION_ID,
          subagentCount: 1,
          summary: { ok: true, value: { title: 'My title', cost: null } }
        }
      ]
    })
  })

  it('returns not-found for an unknown project', async () => {
    expect(await listSessionsHandler(ctx.deps, { projectDirName: 'other' })).toEqual(notFound)
  })

  it('returns invalid-request for a traversal name without touching the disk', async () => {
    expect(await listSessionsHandler(ctx.deps, { projectDirName: '..' })).toEqual(invalid)
  })

  it('returns invalid-request for a non-object payload', async () => {
    expect(await listSessionsHandler(ctx.deps, TEST_PROJECT)).toEqual(invalid)
  })

  it('reports an unreadable summary as a code when the transcript vanishes after listing', async () => {
    const cache = {
      read: () =>
        Promise.resolve({
          ok: false as const,
          error: { reason: 'unreadable' as const, code: 'ENOENT' }
        })
    }
    const result = await listSessionsHandler(
      { projectsRoot: ctx.deps.projectsRoot, summaryCache: cache, summaries: ctx.deps.summaries },
      { projectDirName: TEST_PROJECT }
    )
    expect(result).toMatchObject({
      ok: true,
      value: [{ summary: { ok: false, error: { code: 'not-found' } } }]
    })
  })
})

describe('getSessionHandler', () => {
  const request = { projectDirName: TEST_PROJECT, sessionId: TEST_SESSION_ID }

  it('maps the scan to a DTO with arrays and a whitelisted meta', async () => {
    const result = await getSessionHandler(ctx.deps, request)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const detail = result.value
    expect(detail.sessionId).toBe(TEST_SESSION_ID)
    expect(detail.tree.agentId).toBeNull()
    expect(detail.tree.children).toHaveLength(1)
    expect(detail.subagents.ok).toBe(true)
    const reports = detail.subagents.ok ? detail.subagents.value : []
    expect(reports.map((s) => s.agentId)).toEqual(['a1'])
    expect(reports[0]?.report.ok).toBe(true)
    expect(detail.lead.messageCount).toBe(1)
  })

  it('drops meta fields that are not whitelisted', async () => {
    const result = await getSessionHandler(ctx.deps, request)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const child = result.value.tree.children[0]
    expect(child?.meta).toMatchObject({
      status: 'ok',
      meta: { agentType: 'Explore', description: 'look around' }
    })
    expect(JSON.stringify(result.value)).not.toContain(UNKNOWN_META_FIELD)
  })

  it('returns not-found for an unknown project or session', async () => {
    expect(await getSessionHandler(ctx.deps, { ...request, projectDirName: 'other' })).toEqual(
      notFound
    )
    const other = '22222222-2222-4222-8222-222222222222'
    expect(await getSessionHandler(ctx.deps, { ...request, sessionId: other })).toEqual(notFound)
  })

  it('returns not-found for a session deleted after it was listed', async () => {
    await listSessionsHandler(ctx.deps, { projectDirName: TEST_PROJECT })
    await rm(ctx.tree.sessionPath)
    expect(await getSessionHandler(ctx.deps, request)).toEqual(notFound)
  })

  it('reports an unreadable subagents folder as a code-only error', async () => {
    const dir = join(
      ctx.tree.home,
      '.claude',
      'projects',
      TEST_PROJECT,
      TEST_SESSION_ID,
      'subagents'
    )
    await chmod(dir, 0o000)
    try {
      const result = await getSessionHandler(ctx.deps, request)
      expect(result.ok && result.value.subagents).toEqual({
        ok: false,
        error: { code: 'unreadable' }
      })
      expect(result.ok && result.value.reconciliation.totals.transcriptPartial).toBe(true)
    } finally {
      await chmod(dir, 0o755)
    }
  })

  it('reports an unreadable subagent transcript as a code-only error for that agent', async () => {
    const dir = join(
      ctx.tree.home,
      '.claude',
      'projects',
      TEST_PROJECT,
      TEST_SESSION_ID,
      'subagents'
    )
    const transcript = join(dir, 'agent-a1.jsonl')
    await chmod(transcript, 0o000)
    try {
      const result = await getSessionHandler(ctx.deps, request)
      const subagents = result.ok && result.value.subagents
      expect(subagents && subagents.ok && subagents.value[0]?.report).toEqual({
        ok: false,
        error: { code: 'unreadable' }
      })
    } finally {
      await chmod(transcript, 0o644)
    }
  })

  it('returns not-found through the guard when the transcript vanishes mid-scan', async () => {
    const vanishing: IpcDeps['scans'] = {
      run: async (_key, task) => {
        await rm(ctx.tree.sessionPath)
        return task()
      }
    }
    const listener = guardIpc({
      isTrusted: () => true,
      handle: (payload) =>
        getSessionHandler({ projectsRoot: ctx.deps.projectsRoot, scans: vanishing }, payload)
    })
    expect(await listener({}, request)).toEqual(notFound)
  })

  it.each([
    ['a traversal project name', { ...request, projectDirName: '..' }],
    ['an uppercase session id', { ...request, sessionId: TEST_SESSION_ID.toUpperCase() }],
    ['a missing session id', { projectDirName: TEST_PROJECT }]
  ])('returns invalid-request for %s', async (_label, payload) => {
    expect(await getSessionHandler(ctx.deps, payload)).toEqual(invalid)
  })

  it('scans once for two concurrent requests', async () => {
    let scans = 0
    let runs = 0
    let release = (): void => {}
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const inner = createScanScheduler({ maxConcurrent: 2 })
    // Holds the first scan open until the second request has asked for the same session.
    const counting: IpcDeps['scans'] = {
      run: (key, task) => {
        runs += 1
        if (runs === 2) release()
        return inner.run(key, async () => {
          scans += 1
          await gate
          return task()
        })
      }
    }
    const both = await Promise.all([
      getSessionHandler({ projectsRoot: ctx.deps.projectsRoot, scans: counting }, request),
      getSessionHandler({ projectsRoot: ctx.deps.projectsRoot, scans: counting }, request)
    ])
    expect(both.map((result) => result.ok)).toEqual([true, true])
    expect(scans).toBe(1)
  })
})
