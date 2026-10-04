import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { buildAssistantRecord, buildJsonlText } from '../../transcript/testFixtures'
import { scanSession } from '../scanSession'
import { createSessionScanDir, type SessionScanDir } from '../testSessionDir'

const T1 = '2026-01-01T00:00:01.000Z'
const T2 = '2026-01-01T00:00:02.000Z'
const T3 = '2026-01-01T00:00:03.000Z'

let dir: SessionScanDir

beforeEach(() => {
  dir = createSessionScanDir()
})

afterEach(() => {
  dir.cleanup()
})

describe('scanSession agent activity', () => {
  it('spans the earliest to the latest timestamp of the messages an agent owns', async () => {
    const leadPath = dir.writeLead(
      buildJsonlText([
        buildAssistantRecord({ messageId: 'msg_2', timestamp: T2 }),
        buildAssistantRecord({ messageId: 'msg_1', timestamp: T1 }),
        buildAssistantRecord({ messageId: 'msg_3', timestamp: T3 })
      ])
    )

    const scan = await scanSession({ leadPath, subagents: [] })

    expect(scan.lead.activity).toEqual({ earliestMs: Date.parse(T1), latestMs: Date.parse(T3) })
  })

  it('has no span for an agent whose messages carry no timestamp', async () => {
    const leadPath = dir.writeLead(
      buildJsonlText([
        buildAssistantRecord({ messageId: 'msg_1', extra: { timestamp: undefined } })
      ])
    )

    const scan = await scanSession({ leadPath, subagents: [] })

    expect(scan.lead.activity).toBeNull()
  })

  it('has no span for an agent that owns no messages', async () => {
    const leadPath = dir.writeLead('')

    const scan = await scanSession({ leadPath, subagents: [] })

    expect(scan.lead.activity).toBeNull()
  })

  it("leaves a fork's copy of a lead message out of the fork's span", async () => {
    const leadPath = dir.writeLead(
      buildJsonlText([buildAssistantRecord({ messageId: 'msg_copied', timestamp: T1 })])
    )
    const fork = dir.addSubagent('atask1', {
      transcript: buildJsonlText([
        buildAssistantRecord({ messageId: 'msg_copied', timestamp: T1 }),
        buildAssistantRecord({ messageId: 'msg_own', timestamp: T3 })
      ])
    })

    const scan = await scanSession({ leadPath, subagents: [fork] })

    const forkResult = scan.subagents.get(fork.agentId)
    expect(forkResult?.ok).toBe(true)
    if (forkResult?.ok) {
      expect(forkResult.value.activity).toEqual({
        earliestMs: Date.parse(T3),
        latestMs: Date.parse(T3)
      })
    }
    expect(scan.lead.activity).toEqual({ earliestMs: Date.parse(T1), latestMs: Date.parse(T1) })
  })
})
