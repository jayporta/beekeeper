import { describe, expect, it } from 'vitest'
import type { SessionListItemDto } from '../../../../../shared/ipc/sessionListDto'
import { agentCountLabel, hasAgents } from '../agentCountLabel'
import { testLeadTeam, testRef, testSession, testTeammateTeam } from '../testSessionFixtures'
import { testSessionsT } from '../testSessionsT'

const withSubagents = (item: SessionListItemDto, count: number | null): SessionListItemDto => ({
  ...item,
  subagentCount: count
})

const labelOf = (item: SessionListItemDto): string | null => agentCountLabel(item, testSessionsT)

const leadOf = (teammates: number): SessionListItemDto =>
  testSession(1, {
    team: testLeadTeam(Array.from({ length: teammates }, (_, i) => testRef(i + 2)))
  })

describe('agentCountLabel', () => {
  it.each([
    [1, '1 teammate'],
    [3, '3 teammates']
  ])('counts %i teammates of a lead', (count, label) => {
    expect(labelOf(leadOf(count))).toBe(label)
  })

  it.each([
    [1, '1 subagent'],
    [2, '2 subagents']
  ])('counts %i subagents of a session with no team', (count, label) => {
    expect(labelOf(withSubagents(testSession(1), count))).toBe(label)
  })

  it('joins teammates and subagents', () => {
    expect(labelOf(withSubagents(leadOf(3), 2))).toBe('3 teammates, 2 subagents')
  })

  it('joins the singular forms', () => {
    expect(labelOf(withSubagents(leadOf(1), 1))).toBe('1 teammate, 1 subagent')
  })

  it('names the workflow runs and their agents after the plain subagents', () => {
    const item = testSession(1, { subagentCount: 10, workflows: { runs: 1, agents: 8 } })

    expect(labelOf(item)).toBe('2 subagents, 1 workflow (8 agents)')
  })

  it('leaves out subagents when every one is a workflow agent', () => {
    const item = testSession(1, { subagentCount: 3, workflows: { runs: 1, agents: 3 } })

    expect(labelOf(item)).toBe('1 workflow (3 agents)')
  })

  it('joins teammates, subagents and workflows, with the agent count in the singular', () => {
    const item = testSession(1, {
      team: testLeadTeam([testRef(2), testRef(3)]),
      subagentCount: 2,
      workflows: { runs: 2, agents: 1 }
    })

    expect(labelOf(item)).toBe('2 teammates, 1 subagent, 2 workflows (1 agent)')
  })

  it('counts every subagent as plain when the workflows are unknown', () => {
    expect(labelOf(testSession(1, { subagentCount: 4, workflows: null }))).toBe('4 subagents')
  })

  it('says None for a readable lead with neither', () => {
    expect(labelOf(testSession(1))).toBe('None')
  })

  it('shows a teammate its own subagents', () => {
    const teammate = testSession(2, { team: testTeammateTeam(testRef(1)) })

    expect(labelOf(withSubagents(teammate, 2))).toBe('2 subagents')
    expect(labelOf(teammate)).toBe('None')
  })

  it('shows the teammates alone when the subagent count is unknown', () => {
    expect(labelOf(withSubagents(leadOf(2), null))).toBe('2 teammates')
  })

  it('is null when the subagent count is unknown and there are no teammates', () => {
    expect(labelOf(withSubagents(testSession(1), null))).toBeNull()
  })

  it('is null for a session whose summary could not be read', () => {
    expect(labelOf(withSubagents(testSession(1, { unreadable: true }), 2))).toBeNull()
  })
})

describe('hasAgents', () => {
  it('is true for a lead with teammates', () => {
    expect(hasAgents(leadOf(1))).toBe(true)
  })

  it('is true for a session with subagents', () => {
    expect(hasAgents(withSubagents(testSession(1), 2))).toBe(true)
  })

  it('is true for a session whose only agents are workflow agents', () => {
    const item = testSession(1, { subagentCount: 3, workflows: { runs: 1, agents: 3 } })

    expect(hasAgents(item)).toBe(true)
  })

  it('is false for a session with neither', () => {
    expect(hasAgents(testSession(1))).toBe(false)
  })

  it('is false when the subagent count is unknown and there are no teammates', () => {
    expect(hasAgents(withSubagents(testSession(1), null))).toBe(false)
  })
})
