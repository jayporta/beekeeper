import { chmod, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createScanScheduler } from '../../scheduling/scanScheduler'
import { listSessions } from '../../sessions/listSessions'
import type { ServiceDeps } from '../../serviceDeps'
import {
  NO_SCAN_CACHE,
  registerServiceTestTree,
  TEST_PROJECT,
  TEST_SESSION_ID,
  UNKNOWN_META_FIELD
} from '../../testServiceTree'
import { getSession } from '../getSession'

const ctx = registerServiceTestTree()

const notFound = { ok: false, error: { code: 'not-found' } }

describe('getSession', () => {
  const request = { projectDirName: TEST_PROJECT, sessionId: TEST_SESSION_ID }

  it('maps the scan to a DTO with arrays and a whitelisted meta', async () => {
    const result = await getSession(ctx.deps, request)
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
    const result = await getSession(ctx.deps, request)
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
    expect(await getSession(ctx.deps, { ...request, projectDirName: 'other' })).toEqual(notFound)
    const other = '22222222-2222-4222-8222-222222222222'
    expect(await getSession(ctx.deps, { ...request, sessionId: other })).toEqual(notFound)
  })

  it('returns not-found for a session deleted after it was listed', async () => {
    await listSessions(ctx.deps, { projectDirName: TEST_PROJECT })
    await rm(ctx.tree.sessionPath)
    expect(await getSession(ctx.deps, request)).toEqual(notFound)
  })

  it.skipIf(process.getuid?.() === 0)(
    'reports an unreadable subagents folder as a code-only error',
    async () => {
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
        const result = await getSession(ctx.deps, request)
        expect(result.ok && result.value.subagents).toEqual({
          ok: false,
          error: { code: 'unreadable' }
        })
        expect(result.ok && result.value.reconciliation.totals.transcriptPartial).toBe(true)
      } finally {
        await chmod(dir, 0o755)
      }
    }
  )

  it.skipIf(process.getuid?.() === 0)(
    'reports an unreadable subagent transcript as a code-only error for that agent',
    async () => {
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
        const result = await getSession(ctx.deps, request)
        const subagents = result.ok && result.value.subagents
        expect(subagents && subagents.ok && subagents.value[0]?.report).toEqual({
          ok: false,
          error: { code: 'unreadable' }
        })
      } finally {
        await chmod(transcript, 0o644)
      }
    }
  )

  it('scans once for two concurrent requests', async () => {
    let scans = 0
    let runs = 0
    let release = (): void => {}
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const inner = createScanScheduler({ maxConcurrent: 2 })
    // Holds the first scan open until the second request has asked for the same session.
    const counting: ServiceDeps['scans'] = {
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
      getSession({ ...ctx.deps, scans: counting, scanCache: NO_SCAN_CACHE }, request),
      getSession({ ...ctx.deps, scans: counting, scanCache: NO_SCAN_CACHE }, request)
    ])
    expect(both.map((result) => result.ok)).toEqual([true, true])
    expect(scans).toBe(1)
  })
})
