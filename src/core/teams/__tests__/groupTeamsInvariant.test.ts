import { describe, expect, it } from 'vitest'
import { groupTeams } from '../groupTeams'
import {
  testActivity,
  testAgent,
  testLead,
  testRef,
  testSpawn,
  testTeamSpawns
} from '../testTeamFixtures'

describe('groupTeams folded-key collisions', () => {
  it('joins a spawn and a session whose team and name differ only by case, NFKC form, or combining marks', () => {
    const lead = testLead(testRef('p', 'lead'), {
      teamSpawns: testTeamSpawns([testSpawn('réviewer', 'ﬁnance-Team')])
    })
    const teammate = testAgent(testRef('p', 'reviewer'), {
      agentName: 'réviewer',
      teamName: 'finance-team'
    })

    const grouping = groupTeams([lead, teammate])

    expect(grouping.leads[0]?.teammates).toEqual([
      { session: teammate, joinedBy: 'spawn', stopped: false }
    ])
  })
})

describe('groupTeams every-session-appears-once invariant', () => {
  it('places every agent session exactly once, across leads and ungrouped, over a mixed fixture', () => {
    const lead1 = testLead(testRef('p', 'lead1'), {
      teamSpawns: testTeamSpawns([testSpawn('alice', 'team-a')])
    })
    const lead2 = testLead(testRef('p', 'lead2'))
    const spawnJoined = testAgent(testRef('p', 'alice'), { agentName: 'alice', teamName: 'team-a' })
    const teamJoined = testAgent(testRef('p', 'bob'), { agentName: 'bob', teamName: 'team-a' })
    const duplicatePairA = testAgent(testRef('p', 'dup-1'), {
      agentName: 'alice',
      teamName: 'team-a'
    })
    const ungroupedNamedTeam = testAgent(testRef('p', 'carol'), {
      agentName: 'carol',
      teamName: 'team-c'
    })
    const ungroupedNullTeam = testAgent(testRef('p', 'dave'), { agentName: 'dave', teamName: null })

    const agentSessions = [
      spawnJoined,
      teamJoined,
      duplicatePairA,
      ungroupedNamedTeam,
      ungroupedNullTeam
    ]
    const grouping = groupTeams([lead1, lead2, ...agentSessions])

    const placed = [
      ...grouping.leads.flatMap((g) => g.teammates.map((t) => t.session)),
      ...grouping.ungrouped.flatMap((g) => g.members)
    ]

    expect(placed).toHaveLength(agentSessions.length)
    for (const session of agentSessions) {
      expect(placed.filter((s) => s === session)).toHaveLength(1)
    }
  })

  it('includes every lead-role session in leads, even with no teammates', () => {
    const busy = testLead(testRef('p', 'busy'), {
      teamSpawns: testTeamSpawns([testSpawn('alice', 'team-a')])
    })
    const idle = testLead(testRef('p', 'idle'))

    const grouping = groupTeams([busy, idle])

    expect(grouping.leads.map((g) => g.lead.ref.sessionId).sort()).toEqual(['busy', 'idle'])
    expect(grouping.leads.find((g) => g.lead.ref.sessionId === 'idle')?.teammates).toEqual([])
  })
})

describe('groupTeams input-order determinism', () => {
  it('produces the same grouping whatever order the input sessions come in', () => {
    const lead1 = testLead(testRef('p', 'lead1'), {
      teamSpawns: testTeamSpawns([testSpawn('alice', 'team-a')])
    })
    const lead2 = testLead(testRef('p', 'lead2'), { activity: testActivity(50, 60) })
    const alice = testAgent(testRef('p', 'alice'), { agentName: 'alice', teamName: 'team-a' })
    const bob = testAgent(testRef('p', 'bob'), {
      agentName: 'bob',
      teamName: 'team-b',
      activity: testActivity(10, 20)
    })
    const carol = testAgent(testRef('p', 'carol'), {
      agentName: 'carol',
      teamName: 'team-b',
      activity: testActivity(0, 5)
    })
    const stray = testAgent(testRef('p', 'stray'), { agentName: 'stray', teamName: null })

    const inOrder = [lead1, lead2, alice, bob, carol, stray]
    const shuffled = [stray, carol, lead2, alice, lead1, bob]

    expect(groupTeams(shuffled)).toEqual(groupTeams(inOrder))
  })
})
