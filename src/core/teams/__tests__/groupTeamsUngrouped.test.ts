import { describe, expect, it } from 'vitest'
import { groupTeams } from '../groupTeams'
import { testAgent, testRef } from '../testTeamFixtures'

describe('groupTeams ungrouped', () => {
  it('surfaces a teammate whose lead transcript is absent as ungrouped under its team', () => {
    const orphan = testAgent(testRef('p', 'orphan'), { agentName: 'orphan', teamName: 'team-a' })

    const grouping = groupTeams([orphan])

    expect(grouping.leads).toHaveLength(0)
    expect(grouping.ungrouped).toEqual([{ teamName: 'team-a', members: [orphan] }])
  })

  it('groups an agent session with no usable team under teamName: null', () => {
    const stray = testAgent(testRef('p', 'stray'), { agentName: 'stray', teamName: null })

    const grouping = groupTeams([stray])

    expect(grouping.ungrouped).toEqual([{ teamName: null, members: [stray] }])
  })

  it('groups two ungrouped members of the same folded team together', () => {
    const first = testAgent(testRef('p', 'first'), { agentName: 'first', teamName: 'Team-A' })
    const second = testAgent(testRef('p', 'second'), { agentName: 'second', teamName: 'team-a' })

    const grouping = groupTeams([first, second])

    expect(grouping.ungrouped).toHaveLength(1)
    expect(grouping.ungrouped[0]?.members).toHaveLength(2)
  })

  it('keeps the null-team group separate from a named team', () => {
    const stray = testAgent(testRef('p', 'stray'), { agentName: 'stray', teamName: null })
    const orphan = testAgent(testRef('p', 'orphan'), { agentName: 'orphan', teamName: 'team-a' })

    const grouping = groupTeams([stray, orphan])

    expect(grouping.ungrouped).toHaveLength(2)
  })
})
