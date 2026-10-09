import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SessionListItemDto } from '../../../../../../shared/ipc/sessionListDto'
import { EMPTY_AGENT_SIGNALS_DTO } from '../../../../../../shared/ipc/emptyAgentSignals'
import { useNavigationStore } from '@renderer/features/navigation/state/useNavigationStore'
import {
  testLeadTeam,
  testRef,
  testSession,
  testUsage
} from '@renderer/features/sessions/testSessionFixtures'
import { testDetail, testNode, testReport, testTokenGroup } from '../../testSessionDetail'
import { layoutGraph as layoutGraphOriginal } from '../layoutGraph'
import { COLUMN_WIDTH, LEAF_PITCH, NODE_HEIGHT, NODE_WIDTH } from '../graphMetrics'
import {
  SCENE_OTHER_FOLDER as OTHER,
  SCENE_SESSION as SESSION,
  graphNode as node,
  graphNodes,
  renderGraph,
  renderGraphWith
} from '../testGraphScene'

vi.mock('../layoutGraph', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../layoutGraph')>()
  return { ...actual, layoutGraph: vi.fn(actual.layoutGraph) }
})

afterEach(() => {
  useNavigationStore.getState().reset()
  vi.mocked(layoutGraphOriginal).mockClear()
})

describe('GraphCanvas', () => {
  it('is a labelled region', () => {
    renderGraph()

    expect(screen.getByRole('region', { name: 'Agent graph' })).toBeTruthy()
  })

  it('is a single lead node for a session with no subagents and no team', () => {
    renderGraphWith({ detail: testDetail(), row: null })

    const region = within(screen.getByRole('region', { name: 'Agent graph' }))

    expect(graphNodes()).toHaveLength(1)
    expect(region.getByRole('button', { name: /^Lead, lead/ })).toBeTruthy()
  })

  it('has a node for the lead, each subagent, and each teammate, named by kind, parent and tokens', () => {
    renderGraph()

    const names = graphNodes().map((button) => button.getAttribute('aria-label'))

    expect(names).toEqual([
      'Lead, lead, 1.5K tokens, claude-opus-5',
      'scout, subagent of Lead, 40 tokens, Explore, claude-haiku-5',
      'reader, subagent of Lead, tokens not recorded, Explore',
      'writer (code), teammate of Lead, 2.5K tokens, code, claude-sonnet-5, stopped',
      'tester (code), teammate of Lead, 900 tokens, in -Users-a-other'
    ])
  })

  it('places each node at its layout position', () => {
    renderGraph()

    expect([node(/^Lead/).style.left, node(/^Lead/).style.top]).toEqual(['28px', '142px'])
    expect([node(/^scout/).style.left, node(/^scout/).style.top]).toEqual([
      `${28 + COLUMN_WIDTH}px`,
      '28px'
    ])
    expect(node(/^reader/).style.top).toBe(`${28 + LEAF_PITCH}px`)
    expect(node(/^Lead/).style.width).toBe(`${NODE_WIDTH}px`)
    expect(node(/^Lead/).style.height).toBe(`${NODE_HEIGHT}px`)
  })

  it('draws an edge from the lead to each of its four children, hidden from assistive technology', () => {
    const { container } = renderGraph()

    const svg = container.querySelector('svg')
    const paths = [...(svg?.querySelectorAll('path') ?? [])]

    expect(svg?.getAttribute('aria-hidden')).toBe('true')
    expect(paths).toHaveLength(4)
    expect(paths[0]?.getAttribute('d')).toMatch(/^M 216 \d+(\.\d+)? H 238 V 59 H 260$/)
  })

  it('shows the name and tokens on one line, and the type and model on the next', () => {
    renderGraph()

    const scout = within(node(/^scout/))

    expect(scout.getByText('scout')).toBeTruthy()
    expect(scout.getByText('40')).toBeTruthy()
    expect(scout.getByText('Explore · claude-haiku-5')).toBeTruthy()
  })

  it('shows the folder of a teammate in another folder in place of its type and model', () => {
    renderGraph()

    const tester = within(node(/^tester/))

    expect(tester.getByText('in -Users-a-other')).toBeTruthy()
    expect(tester.queryByText('code')).toBeNull()
  })

  it('flags a stopped teammate', () => {
    renderGraph()

    expect(within(node(/^writer/)).getByText('■ stopped')).toBeTruthy()
    expect(within(node(/^tester/)).queryByText('■ stopped')).toBeNull()
  })

  it('shows a dash for an agent whose tokens are not recorded', () => {
    const detail = testDetail({ children: [testNode('a1')], reports: { a1: 'error' } })
    renderGraphWith({ detail: detail, row: null })

    expect(within(node(/^Explore, subagent/)).getByText('tokens not recorded')).toBeTruthy()
  })

  it('renders transcript-derived text in bdi, so it cannot reorder the text around it', () => {
    renderGraph()

    expect(within(node(/^scout/)).getByText('scout').tagName).toBe('BDI')
    expect(within(node(/^scout/)).getByText('Explore · claude-haiku-5').tagName).toBe('BDI')
    expect(within(node(/^tester/)).getByText('in -Users-a-other').tagName).toBe('BDI')
  })

  it('does not lay the graph out again when only the selection changes', async () => {
    renderGraph()
    const calls = vi.mocked(layoutGraphOriginal).mock.calls.length

    await userEvent.click(node(/^scout/))
    await userEvent.click(node(/^reader/))

    expect(vi.mocked(layoutGraphOriginal).mock.calls.length).toBe(calls)
  })
})

describe('GraphCanvas legend', () => {
  it('explains the marks when an agent has tool errors', () => {
    const detail = testDetail({
      children: [testNode('a1')],
      reports: { a1: testReport({ signals: { ...EMPTY_AGENT_SIGNALS_DTO, toolErrors: 3 } }) }
    })
    renderGraphWith({ detail, row: null })

    expect(screen.getByText('× tool errors')).toBeTruthy()
  })

  it('leaves the legend out when no agent has marks', () => {
    renderGraphWith({ detail: testDetail({ children: [testNode('a1')] }), row: null })

    expect(screen.queryByText('× tool errors')).toBeNull()
  })
})

describe('GraphCanvas partial data', () => {
  const partialDetail = testDetail({
    children: [testNode('a1')],
    reports: { a1: testReport({ skippedLines: 3 }) }
  })

  it('marks a partial agent and names it as partial', () => {
    renderGraphWith({ detail: partialDetail, row: null })

    const button = node(/^Explore, subagent/)

    expect(button.getAttribute('aria-label')).toContain('partial data')
    expect(within(button).getByText('¹')).toBeTruthy()
  })

  it('explains the marker in a footnote that the partial agent points at', () => {
    renderGraphWith({ detail: partialDetail, row: null })

    const note = screen.getByText(/Partial: part of this agent's data couldn't be read/)

    expect(node(/^Explore, subagent/).getAttribute('aria-describedby')).toBe(note.id)
    expect(node(/^Lead/).getAttribute('aria-describedby')).toBeNull()
  })

  it('says what a workflow’s marker means when a run is partial', () => {
    const detail = testDetail({
      children: [
        testNode('w1', { workflowRunId: 'wf_a' }),
        testNode('w2', { workflowRunId: 'wf_a' })
      ],
      reports: { w1: 'error' },
      workflowRuns: [{ runId: 'wf_a', record: null }]
    })
    renderGraphWith({ detail, row: null })

    expect(screen.getByText(/On a workflow, ¹ means some of its agents/)).toBeTruthy()
  })

  it('points a partial run at the workflow note, and the agents in it at the agent footnote', () => {
    const detail = testDetail({
      children: [
        testNode('w1', { workflowRunId: 'wf_a' }),
        testNode('w2', { workflowRunId: 'wf_a' })
      ],
      reports: { w1: 'error' },
      workflowRuns: [{ runId: 'wf_a', record: { name: 'scan', completed: true, phases: [] } }]
    })
    renderGraphWith({ detail, row: null })

    const workflowNote = screen.getByText(/On a workflow, ¹ means some of its agents/)
    const agentNote = screen.getByText(/Partial: part of this agent's data couldn't be read/)

    expect(workflowNote.id).not.toBe('')
    expect(workflowNote.id).not.toBe(agentNote.id)
    expect(node(/^scan, workflow/).getAttribute('aria-describedby')).toBe(workflowNote.id)
    expect(node(/^Explore, subagent of scan.*partial data/).getAttribute('aria-describedby')).toBe(
      agentNote.id
    )
  })

  it('names the run with its id for the agents in a run whose name another run shares', () => {
    const detail = testDetail({
      children: [
        testNode('w1', { workflowRunId: 'wf_a' }),
        testNode('w2', { workflowRunId: 'wf_b' })
      ],
      workflowRuns: [
        { runId: 'wf_a', record: { name: 'scan', completed: true, phases: [] } },
        { runId: 'wf_b', record: { name: 'scan', completed: true, phases: [] } }
      ]
    })
    renderGraphWith({ detail, row: null })

    expect(screen.getAllByRole('button', { name: /subagent of scan \(wf_a\)/ })).toHaveLength(1)
    expect(screen.getAllByRole('button', { name: /subagent of scan \(wf_b\)/ })).toHaveLength(1)
  })

  it('leaves the agent footnote out when only a run is partial, through an agent with no tokens', () => {
    const detail = testDetail({
      children: [
        testNode('w1', { workflowRunId: 'wf_a' }),
        testNode('w2', { workflowRunId: 'wf_a' })
      ],
      reports: { w1: testReport({ tokenGroups: [testTokenGroup({ input: 10 })] }) },
      workflowRuns: [{ runId: 'wf_a', record: { name: 'scan', completed: true, phases: [] } }]
    })
    renderGraphWith({ detail, row: null })

    expect(screen.getByText(/On a workflow, ¹ means some of its agents/)).toBeTruthy()
    expect(screen.queryByText(/Partial: part of this agent's data couldn't be read/)).toBeNull()
  })

  it('leaves the workflow note out when only an agent outside any run is partial', () => {
    renderGraphWith({ detail: partialDetail, row: null })

    expect(screen.queryByText(/On a workflow/)).toBeNull()
  })

  it('has no footnote when nothing is partial', () => {
    renderGraph()

    expect(screen.queryByText(/Partial:/)).toBeNull()
  })

  it('has only the keyboard hint in the notes under a graph with nothing to explain', () => {
    renderGraph()

    const notes = screen.getByText(/^Up and Down move/).parentElement

    expect(notes?.children).toHaveLength(1)
  })
})

describe('GraphCanvas teammates that were not found', () => {
  const missing = (overrides: Parameters<typeof testUsage>[0]): SessionListItemDto[] => [
    testSession(1, { team: testLeadTeam([], testUsage(overrides)) })
  ]

  it('says how many teammates the lead spawned that are not in the list', () => {
    renderGraph(missing({ missingTeammates: 2 }), testDetail())

    expect(screen.getByText(/^2 teammates not found/)).toBeTruthy()
  })

  it('says it in the singular for one teammate', () => {
    renderGraph(missing({ missingTeammates: 1 }), testDetail())

    expect(screen.getByText(/^1 teammate not found/)).toBeTruthy()
  })

  it('says the lists were capped, so there may be more', () => {
    renderGraph(missing({ teamListsTruncated: true }), testDetail())

    expect(screen.getByText(/hit their cap/)).toBeTruthy()
  })

  it('describes the graph region with the note, so a screen reader meets it on entering', () => {
    renderGraph(missing({ missingTeammates: 2 }), testDetail())

    expect(
      screen.getByRole('region', { name: 'Agent graph', description: /2 teammates not found/ })
    ).toBeTruthy()
  })

  it('says nothing when no teammate is missing', () => {
    renderGraph(missing({}), testDetail())

    expect(screen.queryByText(/not found/)).toBeNull()
    expect(screen.queryByText(/hit their cap/)).toBeNull()
  })
})

describe('GraphCanvas selection', () => {
  const current = (): string[] =>
    screen
      .getAllByRole('button')
      .filter((button) => button.getAttribute('aria-current') === 'true')
      .map((button) => button.getAttribute('aria-label') ?? '')

  it('selects the lead by default', () => {
    renderGraph()

    expect(current()).toEqual([expect.stringMatching(/^Lead/)])
  })

  it('selects a subagent when its node is pressed, without counting a navigation', async () => {
    useNavigationStore.getState().showSession(SESSION)
    const before = useNavigationStore.getState().navigationCount
    renderGraph()

    await userEvent.click(node(/^scout/))

    expect(useNavigationStore.getState()).toMatchObject({
      selectedAgent: { kind: 'subagent', ownerRef: SESSION, agentId: 'a1' },
      navigationCount: before
    })
    expect(current()).toEqual([expect.stringMatching(/^scout/)])
  })

  it('selects a teammate by its own session when its node is pressed', async () => {
    renderGraph()

    await userEvent.click(node(/^tester/))

    expect(useNavigationStore.getState().selectedAgent).toEqual({
      kind: 'teammate',
      ref: testRef(3, OTHER)
    })
    expect(current()).toEqual([expect.stringMatching(/^tester/)])
  })

  it('selects the lead again, clearing the selected agent, when its node is pressed', async () => {
    useNavigationStore.getState().showSession(SESSION, {
      kind: 'subagent',
      ownerRef: SESSION,
      agentId: 'a1'
    })
    renderGraph()

    await userEvent.click(node(/^Lead/))

    expect(useNavigationStore.getState().selectedAgent).toBeNull()
    expect(current()).toEqual([expect.stringMatching(/^Lead/)])
  })

  it('shows the agent a teammate chip opened the session with as selected', () => {
    useNavigationStore.getState().showSession(SESSION, { kind: 'teammate', ref: testRef(2) })
    renderGraph()

    expect(current()).toEqual([expect.stringMatching(/^writer/)])
  })

  it('falls back to the lead, with no error, for a teammate that is not in the graph', () => {
    useNavigationStore.getState().showSession(SESSION, { kind: 'teammate', ref: testRef(9) })

    renderGraph()

    expect(current()).toEqual([expect.stringMatching(/^Lead/)])
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('falls back to the lead for a subagent that is not in the graph', () => {
    useNavigationStore.getState().showSession(SESSION, {
      kind: 'subagent',
      ownerRef: SESSION,
      agentId: 'gone'
    })

    renderGraph()

    expect(current()).toEqual([expect.stringMatching(/^Lead/)])
  })
})
