import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  buildAssistantToolUseRecord,
  buildBashToolUseResult,
  buildUserToolResultRecord
} from '../../transcript/testFileTouchFixtures'
import { buildJsonlText } from '../../transcript/testFixtures'
import { scanSession } from '../scanSession'
import { createSessionScanDir, type SessionScanDir } from '../testSessionDir'

let dir: SessionScanDir

beforeEach(() => {
  dir = createSessionScanDir()
})

afterEach(() => {
  dir.cleanup()
})

/** A transcript holding one Bash call and its result. */
function bashTranscript(toolUseId: string, bashEditDiff: Record<string, unknown>): string {
  return buildJsonlText([
    buildAssistantToolUseRecord({ toolUseId, toolName: 'Bash' }),
    buildUserToolResultRecord({ toolUseId, toolUseResult: buildBashToolUseResult(bashEditDiff) })
  ])
}

describe('scanSession Bash file changes', () => {
  it("reports a lead's Bash-changed files as bash touches, with a complete list", async () => {
    const leadPath = dir.writeLead(
      bashTranscript('toolu_1', {
        changedFiles: ['/repo/a.ts'],
        files: [{ filePath: '/repo/a.ts', created: true }]
      })
    )

    const scan = await scanSession({ leadPath, subagents: [] })

    expect(scan.lead.fileTouches).toEqual([
      { filePath: '/repo/a.ts', operation: 'create', source: 'bash', toolUseId: 'toolu_1' }
    ])
    expect(scan.lead.fileListIncomplete).toBe(false)
  })

  it('flags only the agent whose Bash result could not tell what changed', async () => {
    const leadPath = dir.writeLead('')
    const flagged = dir.addSubagent('flagged', {
      transcript: bashTranscript('toolu_1', { unavailable: true })
    })
    const clean = dir.addSubagent('clean', {
      transcript: bashTranscript('toolu_2', { changedFiles: ['/repo/a.ts'] })
    })

    const scan = await scanSession({ leadPath, subagents: [flagged, clean] })

    const flags = [flagged, clean].map((subagent) => {
      const report = scan.subagents.get(subagent.agentId)
      return report?.ok ? report.value.fileListIncomplete : undefined
    })
    expect(flags).toEqual([true, false])
    expect(scan.lead.fileListIncomplete).toBe(false)
  })

  it("credits a fork's repeated Bash result, and its incompleteness, to the lead only", async () => {
    const result = { unavailable: true }
    const leadPath = dir.writeLead(bashTranscript('toolu_shared', result))
    const subagent = dir.addSubagent('forked', {
      transcript: bashTranscript('toolu_shared', result)
    })

    const scan = await scanSession({ leadPath, subagents: [subagent] })

    const forked = scan.subagents.get(subagent.agentId)
    expect(scan.lead.fileListIncomplete).toBe(true)
    expect(forked?.ok ? forked.value.fileListIncomplete : undefined).toBe(false)
  })

  it('keeps every path of a Bash result with the agent that owns it', async () => {
    const named = ['/repo/a.ts', '/repo/b.ts', '/repo/c.ts']
    const leadPath = dir.writeLead(bashTranscript('toolu_1', { changedFiles: named }))
    const subagent = dir.addSubagent('forked', {
      transcript: bashTranscript('toolu_1', { changedFiles: named })
    })

    const scan = await scanSession({ leadPath, subagents: [subagent] })

    const forked = scan.subagents.get(subagent.agentId)
    expect(scan.lead.fileTouches.map((touch) => touch.filePath)).toEqual(named)
    expect(forked?.ok ? forked.value.fileTouches : undefined).toEqual([])
  })
})
