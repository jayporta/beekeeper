import { describe, expect, it } from 'vitest'
import { err, ok } from '../../shared/result'
import type { LineScanInput } from '../../transcript/feedLineScan'
import {
  buildAssistantToolUseRecord,
  buildUserToolResultRecord
} from '../../transcript/testFileTouchFixtures'
import { buildAssistantRecord, buildCostStateRecord } from '../../transcript/testFixtures'
import { leadIdentity } from '../agentIdentity'
import { AGENT_SCAN_BASE_WEIGHT, createAgentScan, type AgentScan } from '../agentScan'
import { createAgentReportsFold } from '../collectAgentReports'
import { createRecordedCostState } from '../recordedCostState'
import { createSpawnObserver } from '../spawnObserver'
import { BASE_TIME, buildBranchRecord, buildSpawnRecord, stampRecord } from '../testSpawnFixtures'

/** Lines that give every part of a scan something to hold, and one that can't be read. */
const LINES: readonly LineScanInput[] = [
  ok(buildAssistantRecord({ messageId: 'msg_1' })),
  ok(buildSpawnRecord({ toolUseIds: ['toolu_agent'], cwd: '/work', gitBranch: 'feat/x' })),
  err({ reason: 'invalid-json' }),
  ok(buildAssistantToolUseRecord({ toolUseId: 'toolu_1', toolName: 'Bash' })),
  ok(buildUserToolResultRecord({ toolUseId: 'toolu_1', isError: true })),
  ok(buildCostStateRecord({ totalCostUSD: 2 })),
  ok(buildAssistantRecord({ messageId: 'msg_2' }))
]

function scanOf(lines: readonly LineScanInput[], trackCostState = true): AgentScan {
  const scan = createAgentScan({ identity: leadIdentity, trackCostState })
  for (const line of lines) scan.observe(line)
  return scan
}

describe('createAgentScan', () => {
  it('reports what each of its parts would report on their own', () => {
    const fold = createAgentReportsFold(leadIdentity)
    const spawns = createSpawnObserver()
    const costState = createRecordedCostState()
    for (const line of LINES) {
      fold.observe(line)
      if (line.ok) {
        spawns.observe(line.value)
        costState.observe(line.value)
      }
    }

    expect(scanOf(LINES).snapshot()).toEqual({
      reports: fold.snapshot(),
      spawns: spawns.result(),
      costState: costState.latest()
    })
  })

  it('reports no cost state when it is not asked to track one', () => {
    expect(scanOf(LINES, false).snapshot().costState).toBeNull()
  })

  it('gives the same snapshot when read between lines as when read at the end', () => {
    const disturbed = createAgentScan({ identity: leadIdentity, trackCostState: true })
    for (const line of LINES) {
      disturbed.observe(line)
      disturbed.snapshot()
    }

    expect(disturbed.snapshot()).toEqual(scanOf(LINES).snapshot())
  })

  describe('a snapshot already taken', () => {
    it('keeps its reports, file touches and signal events when more lines follow', () => {
      const scan = scanOf(LINES.slice(0, 4))
      const snapshot = scan.snapshot()
      const before = structuredClone(snapshot)

      for (const line of LINES.slice(4)) scan.observe(line)

      expect(snapshot).toEqual(before)
    })

    it('keeps its spawns when a later record spawns more', () => {
      const scan = scanOf(LINES.slice(0, 2))
      const snapshot = scan.snapshot()

      scan.observe(ok(buildSpawnRecord({ toolUseIds: ['toolu_later'] })))

      expect([...snapshot.spawns.spawns.keys()]).toEqual(['toolu_agent'])
    })

    it('keeps its timeline entry when a later record dates it in place', () => {
      const scan = createAgentScan({ identity: leadIdentity, trackCostState: false })
      scan.observe(ok({ ...buildBranchRecord('one', '/a'), timestamp: undefined }))
      const snapshot = scan.snapshot()

      scan.observe(ok(stampRecord(buildBranchRecord('one', '/a'), 1000)))

      expect(snapshot.spawns.timeline).toEqual([{ branch: 'one', cwd: '/a', timestamp: undefined }])
      expect(scan.snapshot().spawns.timeline).toEqual([
        { branch: 'one', cwd: '/a', timestamp: BASE_TIME + 1000 }
      ])
    })

    it('keeps its timeline when a later record overflows and empties it', () => {
      const scan = createAgentScan({ identity: leadIdentity, trackCostState: false })
      const sighting = (n: number): LineScanInput => ok(buildBranchRecord(`b${n}`, `/c${n}`))
      for (let n = 0; n < 1000; n += 1) scan.observe(sighting(n))
      const snapshot = scan.snapshot()

      for (let n = 1000; n < 1100; n += 1) scan.observe(sighting(n))

      expect(snapshot.spawns.timeline).toHaveLength(1000)
      expect(scan.snapshot().spawns.timeline).toHaveLength(0)
    })
  })

  describe('weight', () => {
    it('starts at the base weight', () => {
      expect(createAgentScan({ identity: leadIdentity, trackCostState: true }).weight()).toBe(
        AGENT_SCAN_BASE_WEIGHT
      )
    })

    it('adds the reports, the spawns and the cost state it holds', () => {
      const fold = createAgentReportsFold(leadIdentity)
      const spawns = createSpawnObserver()
      const costState = createRecordedCostState()
      for (const line of LINES) {
        fold.observe(line)
        if (line.ok) {
          spawns.observe(line.value)
          costState.observe(line.value)
        }
      }

      expect(scanOf(LINES).weight()).toBe(
        AGENT_SCAN_BASE_WEIGHT + fold.weight() + spawns.weight() + costState.weight()
      )
    })

    it('leaves out the cost state when it is not tracked', () => {
      const tracked = scanOf(LINES, true).weight()
      const untracked = scanOf(LINES, false).weight()

      expect(tracked).toBeGreaterThan(untracked)
    })
  })
})
