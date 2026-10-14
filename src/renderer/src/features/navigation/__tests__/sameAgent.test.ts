import { describe, expect, it } from 'vitest'
import type { SelectedAgent } from '../state/useNavigationStore'
import { sameAgent } from '../sameAgent'

const refA = { projectDirName: '-Users-a-repo', sessionId: '11111111-1111-4111-8111-111111111111' }
const refB = { projectDirName: '-Users-a-repo', sessionId: '22222222-2222-4222-8222-222222222222' }
const refInOtherFolder = { ...refA, projectDirName: '-Users-a-other' }

describe('sameAgent', () => {
  it('treats the lead, which is no selection, as the same as itself', () => {
    expect(sameAgent(null, null)).toBe(true)
  })

  it('tells the lead from a selected agent', () => {
    const subagent: SelectedAgent = { kind: 'subagent', ownerRef: refA, agentId: 'a1' }

    expect(sameAgent(null, subagent)).toBe(false)
    expect(sameAgent(subagent, null)).toBe(false)
  })

  it('matches a subagent by its owner session and id', () => {
    const subagent: SelectedAgent = { kind: 'subagent', ownerRef: refA, agentId: 'a1' }

    expect(sameAgent(subagent, { kind: 'subagent', ownerRef: { ...refA }, agentId: 'a1' })).toBe(
      true
    )
    expect(sameAgent(subagent, { kind: 'subagent', ownerRef: refA, agentId: 'a2' })).toBe(false)
    expect(sameAgent(subagent, { kind: 'subagent', ownerRef: refB, agentId: 'a1' })).toBe(false)
    expect(
      sameAgent(subagent, { kind: 'subagent', ownerRef: refInOtherFolder, agentId: 'a1' })
    ).toBe(false)
  })

  it('matches a teammate by its own session', () => {
    const teammate: SelectedAgent = { kind: 'teammate', ref: refA }

    expect(sameAgent(teammate, { kind: 'teammate', ref: { ...refA } })).toBe(true)
    expect(sameAgent(teammate, { kind: 'teammate', ref: refB })).toBe(false)
  })

  it('matches a workflow run by its owner session and run id', () => {
    const workflow: SelectedAgent = { kind: 'workflow', ownerRef: refA, runId: 'r1' }

    expect(sameAgent(workflow, { kind: 'workflow', ownerRef: { ...refA }, runId: 'r1' })).toBe(true)
    expect(sameAgent(workflow, { kind: 'workflow', ownerRef: refA, runId: 'r2' })).toBe(false)
    expect(sameAgent(workflow, { kind: 'workflow', ownerRef: refB, runId: 'r1' })).toBe(false)
  })

  it('tells agents of different kinds apart', () => {
    expect(
      sameAgent(
        { kind: 'subagent', ownerRef: refA, agentId: 'r1' },
        { kind: 'workflow', ownerRef: refA, runId: 'r1' }
      )
    ).toBe(false)
    expect(
      sameAgent(
        { kind: 'teammate', ref: refA },
        { kind: 'subagent', ownerRef: refA, agentId: 'a1' }
      )
    ).toBe(false)
  })
})
