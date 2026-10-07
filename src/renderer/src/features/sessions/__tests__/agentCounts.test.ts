import { describe, expect, it } from 'vitest'
import { agentCounts } from '../agentCounts'
import { testLeadTeam, testRef, testSession } from '../testSessionFixtures'

describe('agentCounts', () => {
  it('takes the workflow agents out of the subagents, which the session counts them in', () => {
    const item = testSession(1, { subagentCount: 10, workflows: { runs: 1, agents: 8 } })

    expect(agentCounts(item)).toEqual({
      teammates: 0,
      subagents: 2,
      workflowRuns: 1,
      workflowAgents: 8
    })
  })

  it('treats every subagent as plain, with no workflow counts, when the workflows are unknown', () => {
    const item = testSession(1, { subagentCount: 10, workflows: null })

    expect(agentCounts(item)).toMatchObject({ subagents: 10, workflowRuns: 0, workflowAgents: 0 })
  })

  it('has no subagents when the subagent count is unknown', () => {
    expect(agentCounts(testSession(1, { subagentCount: null })).subagents).toBe(0)
  })

  it('never goes below zero subagents when the workflow agents outnumber the count', () => {
    const item = testSession(1, { subagentCount: 1, workflows: { runs: 1, agents: 3 } })

    expect(agentCounts(item).subagents).toBe(0)
  })

  it('counts the teammates of a lead', () => {
    const item = testSession(1, { team: testLeadTeam([testRef(2), testRef(3)]) })

    expect(agentCounts(item).teammates).toBe(2)
  })
})
