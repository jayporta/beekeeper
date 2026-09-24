import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SkippedLineError } from '../../transcript/readRecords'
import { ok, type Result } from '../../transcript/result'
import {
  buildAssistantToolUseRecord,
  buildEditToolUseResult,
  buildUserToolResultRecord
} from '../../transcript/testFileTouchFixtures'
import { buildAssistantRecord, buildJsonlText, toJsonlLine } from '../../transcript/testFixtures'
import { scanSession } from '../scanSession'
import { createSessionScanDir, type SessionScanDir } from '../testSessionDir'

// Lets one test make a specific subagent transcript's read fail after
// yielding a valid record, to prove a mid-read failure doesn't leave that
// message claimed in the shared ledger. Every other path reads for real.
const { flakyPath } = vi.hoisted(() => ({ flakyPath: { current: null as string | null } }))

vi.mock('../../transcript/readRecords', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../transcript/readRecords')>()
  return {
    ...actual,
    readRecords: (filePath: string, readOptions?: Parameters<typeof actual.readRecords>[1]) =>
      filePath === flakyPath.current
        ? failAfterOneRecord()
        : actual.readRecords(filePath, readOptions)
  }
})

/** The toolUseId {@link failAfterOneRecord} reports an Edit touch for, before it fails. */
const FLAKY_EDIT_TOOL_USE_ID = 'toolu_flaky_shared'

async function* failAfterOneRecord(): AsyncGenerator<
  Result<Record<string, unknown>, SkippedLineError>
> {
  yield ok(buildAssistantToolUseRecord({ toolUseId: FLAKY_EDIT_TOOL_USE_ID, toolName: 'Edit' }))
  yield ok(
    buildUserToolResultRecord({
      toolUseId: FLAKY_EDIT_TOOL_USE_ID,
      toolUseResult: buildEditToolUseResult('/repo/flaky-edit.ts')
    })
  )
  yield ok(buildAssistantRecord({ messageId: 'msg_shared' }))
  const error = new Error('simulated mid-read failure') as NodeJS.ErrnoException
  error.code = 'EIO'
  throw error
}

let dir: SessionScanDir

beforeEach(() => {
  dir = createSessionScanDir()
})

afterEach(() => {
  dir.cleanup()
  flakyPath.current = null
})

describe('scanSession usage', () => {
  it('takes the per-field max of split records owned by the same agent', async () => {
    const leadPath = dir.writeLead(
      buildJsonlText([
        buildAssistantRecord({
          messageId: 'msg_1',
          inputTokens: 50,
          outputTokens: 5,
          usageExtra: { cache_read_input_tokens: 100 }
        }),
        buildAssistantRecord({
          messageId: 'msg_1',
          inputTokens: 10,
          outputTokens: 90,
          usageExtra: { cache_read_input_tokens: 20 }
        })
      ])
    )

    const scan = await scanSession({ leadPath, subagents: [] })

    expect(scan.lead.usage.messageCount).toBe(1)
    expect(scan.lead.usage.tokenGroups[0]?.tokens).toEqual({
      input: 50,
      output: 90,
      cacheRead: 100,
      cacheWrite5m: 0,
      cacheWrite1h: 0
    })
  })

  it("credits a fork's repeated lead message id to the lead, not the subagent", async () => {
    const leadPath = dir.writeLead(
      buildJsonlText([buildAssistantRecord({ messageId: 'msg_fork', outputTokens: 10 })])
    )
    const subagent = dir.addSubagent('atask1', {
      transcript: buildJsonlText([
        buildAssistantRecord({ messageId: 'msg_fork', outputTokens: 999 }),
        buildAssistantRecord({ messageId: 'msg_sub_only', outputTokens: 7 })
      ])
    })

    const scan = await scanSession({ leadPath, subagents: [subagent] })

    expect(scan.lead.usage.messageCount).toBe(1)
    expect(scan.lead.usage.tokenGroups[0]?.tokens.output).toBe(10)

    const subagentResult = scan.subagents.get(subagent.agentId)
    expect(subagentResult?.ok).toBe(true)
    if (subagentResult?.ok) {
      expect(subagentResult.value.usage.messageCount).toBe(1)
      expect(subagentResult.value.usage.tokenGroups[0]?.tokens.output).toBe(7)
    }
  })

  it('reports an empty transcript as zero messages with no groups and no touches', async () => {
    const leadPath = dir.writeLead('')

    const scan = await scanSession({ leadPath, subagents: [] })

    expect(scan.lead.usage).toEqual({ tokenGroups: [], messageCount: 0, skippedLines: 0 })
    expect(scan.lead.fileTouches).toEqual([])
  })

  it('isolates an unreadable subagent transcript while others still report', async () => {
    const leadPath = dir.writeLead('')
    const badSubagent = dir.missingSubagent('bad')
    const goodSubagent = dir.addSubagent('good', {
      transcript: buildJsonlText([buildAssistantRecord({ messageId: 'msg_good' })])
    })

    const scan = await scanSession({ leadPath, subagents: [badSubagent, goodSubagent] })

    const badResult = scan.subagents.get(badSubagent.agentId)
    expect(badResult).toEqual({ ok: false, error: { reason: 'unreadable', code: 'ENOENT' } })

    const goodResult = scan.subagents.get(goodSubagent.agentId)
    expect(goodResult?.ok).toBe(true)
    if (goodResult?.ok) expect(goodResult.value.usage.messageCount).toBe(1)
  })

  it('rejects when the lead transcript cannot be read', async () => {
    const leadPath = join(dir.writeLead(''), '..', 'missing-lead.jsonl')

    await expect(scanSession({ leadPath, subagents: [] })).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it("doesn't leave a message claimed in the ledger when its reporting subagent's read fails partway through", async () => {
    const leadPath = dir.writeLead(
      buildJsonlText([buildAssistantRecord({ messageId: 'msg_lead' })])
    )
    const flakySubagent = dir.addSubagent('flaky', {
      transcript: buildJsonlText([buildAssistantRecord({ messageId: 'msg_shared' })])
    })
    const laterSubagent = dir.addSubagent('later', {
      transcript: buildJsonlText([buildAssistantRecord({ messageId: 'msg_shared' })])
    })
    flakyPath.current = flakySubagent.transcript.path

    const scan = await scanSession({ leadPath, subagents: [flakySubagent, laterSubagent] })

    expect(scan.subagents.get(flakySubagent.agentId)?.ok).toBe(false)

    const laterResult = scan.subagents.get(laterSubagent.agentId)
    expect(laterResult?.ok).toBe(true)
    if (laterResult?.ok) expect(laterResult.value.usage.messageCount).toBe(1)
  })

  it('counts a malformed line as skipped without failing the scan', async () => {
    const content = `not valid json\n${toJsonlLine(buildAssistantRecord({ messageId: 'msg_1' }))}\n`
    const leadPath = dir.writeLead(content)

    const scan = await scanSession({ leadPath, subagents: [] })

    expect(scan.lead.usage.skippedLines).toBe(1)
    expect(scan.lead.usage.messageCount).toBe(1)
  })
})

describe('scanSession file touches', () => {
  function editTranscript(toolUseId: string, filePath: string): string {
    return buildJsonlText([
      buildAssistantToolUseRecord({ toolUseId, toolName: 'Edit' }),
      buildUserToolResultRecord({ toolUseId, toolUseResult: buildEditToolUseResult(filePath) })
    ])
  }

  it('reports the lead touch a single Edit call made', async () => {
    const leadPath = dir.writeLead(editTranscript('toolu_1', '/repo/lead.ts'))

    const scan = await scanSession({ leadPath, subagents: [] })

    expect(scan.lead.fileTouches).toEqual([
      { filePath: '/repo/lead.ts', operation: 'edit', toolUseId: 'toolu_1' }
    ])
  })

  it("credits a fork's repeated lead Edit toolUseId to the lead, not the subagent", async () => {
    const leadPath = dir.writeLead(editTranscript('toolu_shared', '/repo/lead-edit.ts'))
    const subagent = dir.addSubagent('atask1', {
      transcript: editTranscript('toolu_shared', '/repo/forked-edit.ts')
    })

    const scan = await scanSession({ leadPath, subagents: [subagent] })

    expect(scan.lead.fileTouches).toEqual([
      { filePath: '/repo/lead-edit.ts', operation: 'edit', toolUseId: 'toolu_shared' }
    ])
    const subagentResult = scan.subagents.get(subagent.agentId)
    expect(subagentResult?.ok).toBe(true)
    if (subagentResult?.ok) expect(subagentResult.value.fileTouches).toEqual([])
  })

  it("credits a later subagent's Edit toolUseId when an earlier subagent's read fails partway through", async () => {
    const leadPath = dir.writeLead('')
    const flakySubagent = dir.addSubagent('flaky', { transcript: '' })
    const laterSubagent = dir.addSubagent('later', {
      transcript: editTranscript(FLAKY_EDIT_TOOL_USE_ID, '/repo/later-edit.ts')
    })
    flakyPath.current = flakySubagent.transcript.path

    const scan = await scanSession({ leadPath, subagents: [flakySubagent, laterSubagent] })

    const flakyResult = scan.subagents.get(flakySubagent.agentId)
    expect(flakyResult?.ok).toBe(false)

    const laterResult = scan.subagents.get(laterSubagent.agentId)
    expect(laterResult?.ok).toBe(true)
    if (laterResult?.ok) {
      expect(laterResult.value.fileTouches).toEqual([
        { filePath: '/repo/later-edit.ts', operation: 'edit', toolUseId: FLAKY_EDIT_TOOL_USE_ID }
      ])
    }
  })
})

describe('scanSession tree', () => {
  it('roots the tree at the lead with no subagents', async () => {
    const leadPath = dir.writeLead('')

    const scan = await scanSession({ leadPath, subagents: [] })

    expect(scan.tree).toEqual({
      identity: { kind: 'lead' },
      metaStatus: { status: 'absent' },
      isTeammate: false,
      children: []
    })
  })

  it('nests a subagent under its parent and marks a teammate, from meta read off disk', async () => {
    const leadPath = dir.writeLead('')
    const parent = dir.addSubagent('parent', {
      transcript: '',
      meta: { agentType: 'general-purpose', teamName: 'core-team' }
    })
    const child = dir.addSubagent('child', {
      transcript: '',
      meta: { agentType: 'code-reviewer', parentAgentId: 'parent' }
    })

    const scan = await scanSession({ leadPath, subagents: [parent, child] })

    const parentNode = scan.tree.children[0]
    expect(parentNode?.identity).toEqual({ kind: 'subagent', agentId: 'parent' })
    expect(parentNode?.isTeammate).toBe(true)
    expect(parentNode?.children.map((c) => c.identity)).toEqual([
      { kind: 'subagent', agentId: 'child' }
    ])
  })

  it('keeps a subagent parented to the lead when its meta file is missing', async () => {
    const leadPath = dir.writeLead('')
    const subagent = dir.addSubagent('a', { transcript: '' })

    const scan = await scanSession({ leadPath, subagents: [subagent] })

    expect(scan.tree.children.map((c) => c.identity)).toEqual([{ kind: 'subagent', agentId: 'a' }])
    expect(scan.tree.children[0]?.metaStatus).toEqual({ status: 'absent' })
  })

  it('keeps a subagent parented to the lead when its meta file is malformed, carrying the error status', async () => {
    const leadPath = dir.writeLead('')
    const subagent = dir.addSubagent('a', { transcript: '', meta: 'not json' })

    const scan = await scanSession({ leadPath, subagents: [subagent] })

    expect(scan.tree.children.map((c) => c.identity)).toEqual([{ kind: 'subagent', agentId: 'a' }])
    expect(scan.tree.children[0]?.metaStatus).toEqual({ status: 'error', reason: 'invalid-json' })
  })
})
