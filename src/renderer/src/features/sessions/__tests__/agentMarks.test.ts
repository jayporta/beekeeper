import { describe, expect, it } from 'vitest'
import { AGENT_MARK_LIMIT, agentMarks } from '../agentMarks'
import {
  testAgentRole,
  testLeadTeam,
  testRef,
  testSession,
  testTeammateTeam
} from '../testSessionFixtures'

describe('agentMarks', () => {
  it('gives a solo session with no subagents one lead mark', () => {
    expect(agentMarks(testSession(1))).toEqual({ marks: ['lead'], overflow: 0 })
  })

  it('marks a lead, then one teammate per grouped teammate, then one subagent per subagent', () => {
    const item = testSession(1, {
      team: testLeadTeam([testRef(2), testRef(3), testRef(4)]),
      subagentCount: 2
    })

    expect(agentMarks(item)).toEqual({
      marks: ['lead', 'teammate', 'teammate', 'teammate', 'subagent', 'subagent'],
      overflow: 0
    })
  })

  it('opens a teammate session with a teammate mark, not a lead mark', () => {
    const item = testSession(2, { team: testTeammateTeam(testRef(1)), subagentCount: 1 })

    expect(agentMarks(item)).toEqual({ marks: ['teammate', 'subagent'], overflow: 0 })
  })

  it('opens an ungrouped teammate session with a teammate mark', () => {
    const item = testSession(2, { team: { kind: 'ungrouped', teamName: 'team' } })

    expect(agentMarks(item).marks).toEqual(['teammate'])
  })

  it('opens a session whose role is an agent with a teammate mark even without a team entry', () => {
    const item = testSession(2, { role: testAgentRole('reviewer', 'code') })

    expect(agentMarks(item).marks).toEqual(['teammate'])
  })

  it('still gives an unreadable session its one first mark', () => {
    expect(agentMarks(testSession(1, { unreadable: true }))).toEqual({
      marks: ['lead'],
      overflow: 0
    })
  })

  it('adds no subagent marks when the subagent count is unknown', () => {
    expect(agentMarks(testSession(1, { subagentCount: null })).marks).toEqual(['lead'])
  })

  it('caps the marks at the limit and counts the rest as overflow', () => {
    const { marks, overflow } = agentMarks(testSession(1, { subagentCount: 40 }))

    expect(marks).toHaveLength(AGENT_MARK_LIMIT)
    expect(marks[0]).toBe('lead')
    expect(marks.slice(1).every((mark) => mark === 'subagent')).toBe(true)
    expect(overflow).toBe(29)
  })

  it('has no overflow at exactly the limit', () => {
    const { marks, overflow } = agentMarks(testSession(1, { subagentCount: AGENT_MARK_LIMIT - 1 }))

    expect(marks).toHaveLength(AGENT_MARK_LIMIT)
    expect(overflow).toBe(0)
  })

  it('draws one workflow mark per run, after the teammates and before the plain subagents', () => {
    const item = testSession(1, {
      team: testLeadTeam([testRef(2)]),
      subagentCount: 10,
      workflows: { runs: 1, agents: 8 }
    })

    expect(agentMarks(item)).toEqual({
      marks: ['lead', 'teammate', 'workflow', 'subagent', 'subagent'],
      overflow: 0
    })
  })

  it('draws a workflow mark for a session whose subagents are all workflow agents', () => {
    const item = testSession(1, { subagentCount: 3, workflows: { runs: 1, agents: 3 } })

    expect(agentMarks(item).marks).toEqual(['lead', 'workflow'])
  })

  it('keeps the runs when the limit cuts the plain subagents short', () => {
    const item = testSession(1, { subagentCount: 13, workflows: { runs: 2, agents: 2 } })

    const { marks, overflow } = agentMarks(item)

    expect(marks).toEqual(['lead', 'workflow', 'workflow', ...Array<string>(9).fill('subagent')])
    expect(overflow).toBe(2)
  })

  it('draws no workflow marks when the workflows are unknown', () => {
    const item = testSession(1, { subagentCount: 3, workflows: null })

    expect(agentMarks(item).marks).toEqual(['lead', 'subagent', 'subagent', 'subagent'])
  })

  it('keeps teammates ahead of subagents when the limit cuts the strip short', () => {
    const teammates = Array.from({ length: 11 }, (_, index) => testRef(index + 2))
    const item = testSession(1, { team: testLeadTeam(teammates), subagentCount: 5 })

    const { marks, overflow } = agentMarks(item)

    expect(marks).toEqual(['lead', ...Array<string>(11).fill('teammate')])
    expect(overflow).toBe(5)
  })
})
