import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SessionDetailDto } from '../../../../../../shared/ipc/sessionDetailDto'
import type { SessionListItemDto } from '../../../../../../shared/ipc/sessionListDto'
import { useNavigationStore } from '@renderer/features/navigation/state/useNavigationStore'
import {
  testAgentRole,
  testLeadTeam,
  testRef,
  testSession,
  testTeammateTeam,
  testUsage
} from '@renderer/features/sessions/testSessionFixtures'
import { testRow } from '@renderer/features/sessions/testSessionRows'
import { layoutGraph as layoutGraphOriginal } from '../layoutGraph'
import { testDetail, testMeta, testNode, testReport, testTokenGroup } from '../../testSessionDetail'
import { GraphCanvas } from '../GraphCanvas'
import { COLUMN_WIDTH, LEAF_PITCH, NODE_HEIGHT, NODE_WIDTH } from '../graphMetrics'

vi.mock('../layoutGraph', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../layoutGraph')>()
  return { ...actual, layoutGraph: vi.fn(actual.layoutGraph) }
})

const SESSION = testRef(1)
const OTHER = '-Users-a-other'

const lead = testSession(1, {
  model: 'claude-opus-5',
  team: testLeadTeam(
    [testRef(2), testRef(3, OTHER)],
    testUsage({ missingTeammates: 0, teamListsTruncated: false })
  )
})
const writer = testSession(2, {
  role: testAgentRole('writer', 'code'),
  model: 'claude-sonnet-5',
  totalTokens: 2500,
  team: testTeammateTeam(SESSION, true)
})
const tester = testSession(3, {
  projectDirName: OTHER,
  role: testAgentRole('tester', 'code'),
  totalTokens: 900,
  team: testTeammateTeam(SESSION)
})
const ITEMS = [lead, writer, tester]

const subagents = [
  testNode('a1', {
    meta: testMeta({ name: 'scout', agentType: 'Explore', model: 'claude-haiku-5' })
  }),
  testNode('a2', { meta: testMeta({ name: 'reader', agentType: 'Explore' }) })
]
const DETAIL = testDetail({
  lead: testReport({ tokenGroups: [testTokenGroup({ input: 1500 })] }),
  children: subagents,
  reports: { a1: testReport({ tokenGroups: [testTokenGroup({ output: 40 })] }) }
})

afterEach(() => {
  useNavigationStore.getState().reset()
  vi.mocked(layoutGraphOriginal).mockClear()
})

function renderGraph(
  items: readonly SessionListItemDto[] = ITEMS,
  detail: SessionDetailDto = DETAIL
): ReturnType<typeof render> {
  return render(<GraphCanvas detail={detail} sessionRef={SESSION} row={testRow(1, items)} />)
}

const node = (name: RegExp | string): HTMLElement => screen.getByRole('button', { name })

describe('GraphCanvas', () => {
  it('is a labelled region', () => {
    renderGraph()

    expect(screen.getByRole('region', { name: 'Agent graph' })).toBeTruthy()
  })

  it('is a single lead node for a session with no subagents and no team', () => {
    render(<GraphCanvas detail={testDetail()} sessionRef={SESSION} row={null} />)

    const region = within(screen.getByRole('region', { name: 'Agent graph' }))

    expect(region.getAllByRole('button')).toHaveLength(1)
    expect(region.getByRole('button', { name: /^Lead, lead/ })).toBeTruthy()
  })

  it('has a node for the lead, each subagent, and each teammate, named by kind and tokens', () => {
    renderGraph()

    const names = screen.getAllByRole('button').map((button) => button.getAttribute('aria-label'))

    expect(names).toEqual([
      'Lead, lead, 1.5K tokens, claude-opus-5',
      'scout, subagent, 40 tokens, Explore, claude-haiku-5',
      'reader, subagent, 0 tokens, Explore',
      'writer (code), teammate, 2.5K tokens, code, claude-sonnet-5, stopped',
      'tester (code), teammate, 900 tokens, in -Users-a-other'
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
    render(<GraphCanvas detail={detail} sessionRef={SESSION} row={null} />)

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

describe('GraphCanvas partial data', () => {
  const partialDetail = testDetail({
    children: [testNode('a1')],
    reports: { a1: testReport({ skippedLines: 3 }) }
  })

  it('marks a partial agent and names it as partial', () => {
    render(<GraphCanvas detail={partialDetail} sessionRef={SESSION} row={null} />)

    const button = node(/^Explore, subagent/)

    expect(button.getAttribute('aria-label')).toContain('partial data')
    expect(within(button).getByText('¹')).toBeTruthy()
  })

  it('explains the marker in a footnote that the partial agent points at', () => {
    render(<GraphCanvas detail={partialDetail} sessionRef={SESSION} row={null} />)

    const note = screen.getByText(/Partial: part of this agent's data couldn't be read/)

    expect(node(/^Explore, subagent/).getAttribute('aria-describedby')).toBe(note.id)
    expect(node(/^Lead/).getAttribute('aria-describedby')).toBeNull()
  })

  it('has no footnote when nothing is partial', () => {
    renderGraph()

    expect(screen.queryByText(/Partial:/)).toBeNull()
  })

  it('leaves no empty notes container under a graph with nothing to explain', () => {
    renderGraph()

    expect(screen.getByRole('region', { name: 'Agent graph' }).children).toHaveLength(1)
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
