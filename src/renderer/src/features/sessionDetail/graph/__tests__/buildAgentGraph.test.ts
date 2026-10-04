import { describe, expect, it } from 'vitest'
import type { AgentNodeDto } from '../../../../../../shared/ipc/agentDto'
import type { SessionListItemDto } from '../../../../../../shared/ipc/sessionListDto'
import { testRow } from '@renderer/features/sessions/testSessionRows'
import {
  testAgentRole,
  testLeadTeam,
  testRef,
  testSession,
  testTeammateTeam,
  testUsage
} from '@renderer/features/sessions/testSessionFixtures'
import { testDetail, testMeta, testNode, testReport, testTokenGroup } from '../../testSessionDetail'
import { testSessionDetailT } from '../../testSessionDetailT'
import { buildAgentGraph } from '../buildAgentGraph'

const REF = testRef(1)

/** Builds the graph of a lead with no list entry, so only the detail speaks. */
function graphOf(detail = testDetail()): ReturnType<typeof buildAgentGraph> {
  return buildAgentGraph({
    detail,
    ref: REF,
    rootItem: null,
    rootRow: null,
    t: testSessionDetailT
  })
}

/** Builds the graph of the lead among `items`, the way the sessions list groups them. */
function graphAmong(
  items: readonly SessionListItemDto[],
  detail = testDetail()
): ReturnType<typeof buildAgentGraph> {
  const rootItem = items[0] ?? null
  return buildAgentGraph({
    detail,
    ref: REF,
    rootItem,
    rootRow: testRow(1, items),
    t: testSessionDetailT
  })
}

describe('buildAgentGraph a session with no subagents and no team', () => {
  it('is a single lead node named Lead and selected by default', () => {
    const graph = graphOf()

    expect(graph).toMatchObject({
      key: 'lead',
      kind: 'lead',
      name: 'Lead',
      selection: null,
      children: [],
      missingTeammates: 0,
      teamListsTruncated: false
    })
  })
})

describe('buildAgentGraph the root', () => {
  it("takes the lead's model from its list entry", () => {
    const graph = graphAmong([testSession(1, { model: 'claude-opus-5' })])

    expect(graph.model).toBe('claude-opus-5')
  })

  it("sums the lead's own tokens, counting the cache write of both windows", () => {
    const lead = testReport({
      tokenGroups: [
        testTokenGroup({ input: 1, output: 2, cacheRead: 4, cacheWrite5m: 8, cacheWrite1h: 16 }),
        testTokenGroup({ input: 32 }, 'claude-opus-5')
      ]
    })

    expect(graphOf(testDetail({ lead })).tokens).toBe(63)
  })

  it('has no tokens when the lead reported no usage, like a teammate with none', () => {
    expect(graphOf(testDetail({ lead: testReport({ tokenGroups: [] }) })).tokens).toBeNull()
  })

  it('is partial when the lead has unreadable transcript lines', () => {
    expect(graphOf(testDetail({ lead: testReport({ skippedLines: 1 }) })).partial).toBe(true)
  })

  it('is partial when the lead has an incomplete file list', () => {
    expect(graphOf(testDetail({ lead: testReport({ fileListIncomplete: true }) })).partial).toBe(
      true
    )
  })

  it('is not partial when its report is complete', () => {
    expect(graphOf().partial).toBe(false)
  })

  it('is a teammate named by its list label when the session is a teammate', () => {
    const lead = testRef(2)
    const items = [
      testSession(1, {
        role: testAgentRole('worker', 'Explore'),
        team: testTeammateTeam(lead, true)
      })
    ]

    const graph = graphAmong(items)

    expect(graph).toMatchObject({
      key: 'lead',
      kind: 'teammate',
      name: 'worker (Explore)',
      agentType: 'Explore',
      stopped: true,
      selection: null
    })
  })

  it('is a teammate when the session is an agent no lead claimed', () => {
    const items = [
      testSession(1, {
        role: testAgentRole('orphan', 'Explore'),
        team: { kind: 'ungrouped', teamName: 'auth' }
      })
    ]

    expect(graphAmong(items)).toMatchObject({ kind: 'teammate', name: 'orphan (Explore)' })
  })

  it('is named Teammate when a teammate session has no row in the grouped list', () => {
    const rootItem = testSession(1, { team: testTeammateTeam(testRef(2)) })

    const graph = buildAgentGraph({
      detail: testDetail(),
      ref: REF,
      rootItem,
      rootRow: null,
      t: testSessionDetailT
    })

    expect(graph).toMatchObject({ kind: 'teammate', name: 'Teammate' })
  })

  it('carries how many spawned teammates never appeared, and whether the lists were capped', () => {
    const items = [
      testSession(1, {
        team: testLeadTeam([], testUsage({ missingTeammates: 2, teamListsTruncated: true }))
      })
    ]

    expect(graphAmong(items)).toMatchObject({ missingTeammates: 2, teamListsTruncated: true })
  })
})

describe('buildAgentGraph subagents', () => {
  it('nests each subagent under the one that spawned it', () => {
    const tree = [
      testNode('parent', { children: [testNode('child')] }),
      testNode('sibling')
    ] as const

    const graph = graphOf(testDetail({ children: tree }))

    expect(graph.children.map((node) => node.name)).toEqual(['Explore', 'Explore'])
    expect(graph.children[0]?.children).toHaveLength(1)
    expect(graph.children[1]?.children).toEqual([])
  })

  it('keeps siblings in the tree’s order', () => {
    const children = ['c', 'a', 'b'].map((id) => testNode(id, { meta: testMeta({ name: id }) }))

    const graph = graphOf(testDetail({ children }))

    expect(graph.children.map((node) => node.name)).toEqual(['c', 'a', 'b'])
  })

  it('keeps the children of a subagent in the tree’s order', () => {
    const grandchildren = ['c', 'a', 'b'].map((id) =>
      testNode(id, { meta: testMeta({ name: id }) })
    )

    const graph = graphOf(
      testDetail({ children: [testNode('parent', { children: grandchildren })] })
    )

    expect(graph.children[0]?.children.map((node) => node.name)).toEqual(['c', 'a', 'b'])
  })

  it('keys and selects a subagent by the session that holds it and its agent id', () => {
    const graph = graphOf(testDetail({ children: [testNode('a1')] }))

    expect(graph.children[0]).toMatchObject({
      key: 'sub:-p/00000001-0000-4000-8000-000000000000:a1',
      kind: 'subagent',
      selection: { kind: 'subagent', ownerRef: REF, agentId: 'a1' }
    })
  })

  it("takes a subagent's name, type and model from its meta", () => {
    const meta = testMeta({
      name: 'scout',
      agentType: 'Explore',
      model: 'claude-haiku-5'
    })

    const graph = graphOf(testDetail({ children: [testNode('a1', { meta })] }))

    expect(graph.children[0]).toMatchObject({
      name: 'scout',
      agentType: 'Explore',
      model: 'claude-haiku-5'
    })
  })

  it('marks a subagent the person stopped', () => {
    const meta = testMeta({ stoppedByUser: true })

    const graph = graphOf(testDetail({ children: [testNode('a1', { meta })] }))

    expect(graph.children[0]?.stopped).toBe(true)
  })

  it.each([
    ['absent', { status: 'absent' } as const],
    ['unreadable', { status: 'error', reason: 'invalid-json' } as const]
  ])('names a subagent by its short id, with no type, when its meta is %s', (_label, meta) => {
    const graph = graphOf(testDetail({ children: [testNode('a1b2c3d4e5f6', { meta })] }))

    expect(graph.children[0]).toMatchObject({
      kind: 'subagent',
      name: 'a1b2c3d4',
      agentType: null,
      model: null
    })
  })

  it('sums a subagent’s tokens across its groups', () => {
    const report = testReport({
      tokenGroups: [testTokenGroup({ input: 10, cacheWrite5m: 5, cacheWrite1h: 5 })]
    })

    const graph = graphOf(testDetail({ children: [testNode('a1')], reports: { a1: report } }))

    expect(graph.children[0]?.tokens).toBe(20)
  })

  it('is partial for a subagent with unreadable lines or an incomplete file list', () => {
    const graph = graphOf(
      testDetail({
        children: [testNode('a1'), testNode('a2'), testNode('a3')],
        reports: {
          a1: testReport({ skippedLines: 2 }),
          a2: testReport({ fileListIncomplete: true }),
          a3: testReport()
        }
      })
    )

    expect(graph.children.map((node) => node.partial)).toEqual([true, true, false])
  })

  it('keeps a subagent whose report errored, partial and with no tokens', () => {
    const graph = graphOf(testDetail({ children: [testNode('a1')], reports: { a1: 'error' } }))

    expect(graph.children[0]).toMatchObject({ partial: true, tokens: null })
  })

  it('shows only the lead, partial, when the subagents folder is unreadable', () => {
    const graph = graphOf(testDetail({ children: [testNode('a1')], reports: false }))

    expect(graph).toMatchObject({ partial: true, children: [] })
  })

  it('handles a spawn chain tens of thousands deep', () => {
    let tail: AgentNodeDto = testNode('agent-0')
    for (let i = 1; i < 50_000; i += 1) tail = testNode(`agent-${i}`, { children: [tail] })

    const graph = graphOf(testDetail({ children: [tail] }))

    let depth = 0
    for (let node = graph.children[0]; node !== undefined; node = node.children[0]) depth += 1
    expect(depth).toBe(50_000)
  })
})

describe('buildAgentGraph in-process teammates recorded as subagents', () => {
  const inProcess = { spawnDepth: 0, teamName: 'auth', name: 'worker' }

  it('is a teammate when its meta has spawn depth 0, a team name and a name', () => {
    const graph = graphOf(testDetail({ children: [testNode('a1', { meta: testMeta(inProcess) })] }))

    expect(graph.children[0]).toMatchObject({
      kind: 'teammate',
      name: 'worker',
      selection: { kind: 'subagent', agentId: 'a1' }
    })
  })

  it.each([
    ['no name', { spawnDepth: 0, teamName: 'auth' }],
    ['no team name', { spawnDepth: 0, name: 'worker' }],
    ['a deeper spawn depth', { spawnDepth: 1, teamName: 'auth', name: 'worker' }],
    ['no spawn depth', { teamName: 'auth', name: 'worker' }]
  ])('stays a subagent with %s', (_label, fields) => {
    const graph = graphOf(testDetail({ children: [testNode('a1', { meta: testMeta(fields) })] }))

    expect(graph.children[0]?.kind).toBe('subagent')
  })

  it('leaves a fork named by its description a subagent', () => {
    const meta = testMeta({ agentType: 'fork', isFork: true, description: 'try the other way' })

    const graph = graphOf(testDetail({ children: [testNode('a1', { meta })] }))

    expect(graph.children[0]).toMatchObject({ kind: 'subagent', name: 'try the other way' })
  })
})

describe('buildAgentGraph teammate sessions', () => {
  const other = '-other'
  const lead = testSession(1, {
    team: testLeadTeam([testRef(2), testRef(3, other)])
  })
  const first = testSession(2, {
    role: testAgentRole('writer', 'general-purpose'),
    team: testTeammateTeam(REF),
    model: 'claude-sonnet-5',
    totalTokens: 9999,
    transcriptTokens: 1234
  })
  const second = testSession(3, {
    projectDirName: other,
    role: testAgentRole('tester', 'Explore'),
    team: testTeammateTeam(REF, true)
  })

  it('sit after the lead’s subagents, as children of the lead', () => {
    const graph = graphAmong([lead, first, second], testDetail({ children: [testNode('a1')] }))

    expect(graph.children.map((node) => node.kind)).toEqual(['subagent', 'teammate', 'teammate'])
  })

  it('are named, keyed and selected by their own session', () => {
    const graph = graphAmong([lead, first, second])

    expect(graph.children[0]).toMatchObject({
      key: 'mate:-p/00000002-0000-4000-8000-000000000000',
      kind: 'teammate',
      name: 'writer (general-purpose)',
      agentType: 'general-purpose',
      model: 'claude-sonnet-5',
      tokens: 1234,
      selection: { kind: 'teammate', ref: testRef(2) },
      children: []
    })
  })

  it('select a teammate in another folder by that folder', () => {
    const graph = graphAmong([lead, first, second])

    expect(graph.children[1]?.selection).toEqual({ kind: 'teammate', ref: testRef(3, other) })
  })

  it('name the folder of a teammate that lives in another folder', () => {
    const graph = graphAmong([lead, first, second])

    expect(graph.children.map((node) => node.folder)).toEqual([null, other])
  })

  it('mark a stopped teammate', () => {
    const graph = graphAmong([lead, first, second])

    expect(graph.children.map((node) => node.stopped)).toEqual([false, true])
  })

  it('show their own transcript’s tokens, not the session total that includes their subagents', () => {
    const graph = graphAmong([lead, first, second])

    expect(graph.children[0]?.tokens).toBe(1234)
  })

  it('have no tokens when their own transcript has no usage', () => {
    const graph = graphAmong([lead, first, second])

    expect(graph.children[1]?.tokens).toBeNull()
  })

  it('are partial when the session summary has unreadable lines or could not be read', () => {
    const lines = testSession(2, { team: testTeammateTeam(REF), skippedLines: 3 })
    const unreadable = testSession(3, { team: testTeammateTeam(REF), unreadable: true })
    const items = [
      testSession(1, { team: testLeadTeam([testRef(2), testRef(3)]) }),
      lines,
      unreadable
    ]

    const graph = graphAmong(items)

    expect(graph.children.map((node) => node.partial)).toEqual([true, true])
  })
})
