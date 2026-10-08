import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { buildAssistantRecord, buildJsonlText } from '../../transcript/testFixtures'
import { readSubagentMessageReports } from '../readSubagentMessageReports'
import { createSessionScanDir, type SessionScanDir } from '../testSessionDir'

let dir: SessionScanDir

beforeEach(() => {
  dir = createSessionScanDir()
})

afterEach(() => {
  dir.cleanup()
})

describe('readSubagentMessageReports', () => {
  it("reads a subagent's assistant messages under its own identity", async () => {
    const subagent = dir.addSubagent('a1', {
      transcript: buildJsonlText([buildAssistantRecord({ messageId: 'msg_1' })])
    })

    const result = await readSubagentMessageReports({ subagent, readOptions: {} })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.reports).toHaveLength(1)
    expect(result.value.reports[0]?.identity).toEqual({ kind: 'subagent', agentId: 'a1' })
  })

  it('returns an error result for a transcript that cannot be read', async () => {
    const subagent = dir.missingSubagent('gone')

    const result = await readSubagentMessageReports({ subagent, readOptions: {} })

    expect(result.ok).toBe(false)
  })
})
