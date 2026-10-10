import * as fs from 'node:fs'
import { appendFile, utimes } from 'node:fs/promises'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createAgentScanCache } from '../../../core/session/agentScanCache'
import { RESUME_RECENT_MS } from '../../../core/transcript/resumableScan'
import { buildAssistantRecord, buildJsonlText } from '../../../core/transcript/testFixtures'
import { startsDuring } from '../../../core/transcript/testReadStarts'
import { createIpcDeps } from '../createIpcDeps'
import { getSessionHandler } from '../getSessionHandler'
import { NO_SCAN_CACHE, TEST_PROJECT, TEST_SESSION_ID, registerIpcTestTree } from '../testIpcTree'

// Wraps the real `createReadStream` in a spy so a test can see where each
// read began, which is how a resumed read tells from a rescan.
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>()
  return { ...actual, createReadStream: vi.fn(actual.createReadStream) }
})

const ctx = registerIpcTestTree()
const request = { projectDirName: TEST_PROJECT, sessionId: TEST_SESSION_ID }

beforeEach(() => {
  vi.mocked(fs.createReadStream).mockClear()
})

/** A second assistant message, appended to the lead transcript as a live session would. */
const APPENDED = buildJsonlText([buildAssistantRecord({ messageId: 'msg_later' })])

/** Appends to the lead transcript and stamps it as just modified, so a clock tick never ties with the earlier stat. */
async function appendToLead(): Promise<void> {
  await appendFile(ctx.tree.sessionPath, APPENDED)
  const later = new Date(Date.now() + 5000)
  await utimes(ctx.tree.sessionPath, later, later)
}

/** The size the lead transcript had before {@link appendToLead}: every line in it is complete. */
function leadSize(): number {
  return fs.statSync(ctx.tree.sessionPath).size
}

describe('getSessionHandler resuming transcript scans', () => {
  it('reads only the appended bytes of a lead that grew since the last detail scan', async () => {
    const deps = { ...ctx.deps, scanCache: NO_SCAN_CACHE }
    await getSessionHandler(deps, request)
    const before = leadSize()
    await appendToLead()

    const starts = await startsDuring(() => getSessionHandler(deps, request))

    // The unchanged subagent is served from its kept scan, so the lead is the only read.
    expect(starts).toEqual([before])
  })

  it('returns the detail a scan from scratch returns', async () => {
    const deps = { ...ctx.deps, scanCache: NO_SCAN_CACHE }
    await getSessionHandler(deps, request)
    await appendToLead()

    const resumed = await getSessionHandler(deps, request)
    const fresh = await getSessionHandler(
      { ...createIpcDeps(ctx.tree.home), scanCache: NO_SCAN_CACHE },
      request
    )

    expect(resumed).toEqual(fresh)
  })

  it('reads a transcript in full when it was not modified recently', async () => {
    const deps = {
      ...ctx.deps,
      scanCache: NO_SCAN_CACHE,
      agentScans: createAgentScanCache({ now: () => Date.now() + 2 * RESUME_RECENT_MS })
    }
    await getSessionHandler(deps, request)
    await appendToLead()

    const starts = await startsDuring(() => getSessionHandler(deps, request))

    expect(starts).toEqual([0, 0])
  })

  it('reads nothing when no transcript changed, even without a cached scan', async () => {
    const deps = { ...ctx.deps, scanCache: NO_SCAN_CACHE }
    await getSessionHandler(deps, request)

    const starts = await startsDuring(() => getSessionHandler(deps, request))

    expect(starts).toEqual([])
  })
})
