import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { useNavigationStore } from '@renderer/features/navigation/state/useNavigationStore'
import { testRef, testSession } from '@renderer/features/sessions/testSessionFixtures'
import { testDetail, testMeta, testNode, testReport } from '../../testSessionDetail'
import { LISTS_STALE_TIME_MS } from '@renderer/app/listsStaleTime'
import { createTestQueryClient } from '@renderer/testQueryWrapper'
import { SCENE_ITEMS, SCENE_SESSION } from '../../graph/testGraphScene'
import { LEAD_REPORT, inspector, pricedGroup, renderInspectorScene } from '../testInspectorScene'

afterEach(() => {
  useNavigationStore.getState().reset()
})

const WRITER = testRef(2)
const select = async (name: RegExp): Promise<void> => {
  await userEvent.click(screen.getByRole('button', { name }))
}

describe('AgentInspector for the lead', () => {
  it('is a region beside the graph, headed by the lead’s name one level under the page', () => {
    renderInspectorScene()

    expect(screen.getByRole('region', { name: 'Agent inspector' })).toBeTruthy()
    expect(inspector().getByRole('heading', { level: 2, name: 'Lead' })).toBeTruthy()
  })

  it('says it is the lead session', () => {
    renderInspectorScene()

    expect(inspector().getByText('Lead session')).toBeTruthy()
  })

  it('shows the model, how long the agent was active, and its message count', () => {
    renderInspectorScene()

    expect(inspector().getByText(/claude-opus-5/).textContent).toMatch(
      /claude-opus-5\s*·\s*1h 30m\s*·\s*12 messages/
    )
  })

  it('leaves out the span when the agent has no timestamps', () => {
    renderInspectorScene({ detail: testDetail({ lead: { ...LEAD_REPORT, activity: null } }) })

    const facts = inspector().getByText(/12 messages/).textContent

    expect(facts).toMatch(/claude-opus-5\s*·\s*12 messages/)
    expect(facts).not.toContain('1h')
  })

  it('counts a single message in the singular', () => {
    renderInspectorScene({ detail: testDetail({ lead: { ...LEAD_REPORT, messageCount: 1 } }) })

    expect(inspector().getByText(/1 message$/)).toBeTruthy()
  })

  it('shows its own tokens, what it adds up to with the agents below, and its cost', () => {
    renderInspectorScene()

    expect(inspector().getByText('1.6K tokens')).toBeTruthy()
    expect(inspector().getByText('5K tokens incl. 4 below')).toBeTruthy()
    expect(inspector().getByText('$2.50 at API prices')).toBeTruthy()
  })

  it('says there are no agents below a lone lead', () => {
    renderInspectorScene({
      detail: testDetail({ lead: LEAD_REPORT }),
      items: [testSession(1)]
    })

    expect(inspector().getByText('No agents below')).toBeTruthy()
  })

  it('shows tokens by class, with the cache write of both windows together', () => {
    renderInspectorScene()

    const row = (label: string): string | undefined =>
      inspector().getByText(label).closest('li')?.textContent

    expect(row('Input')).toBe('Input1K')
    expect(row('Output')).toBe('Output400')
    expect(row('Cache read')).toBe('Cache read100')
    expect(row('Cache write')).toBe('Cache write100')
    expect(
      inspector().getByRole('heading', { level: 3, name: 'Tokens · 1.6K tokens' })
    ).toBeTruthy()
  })

  it('hides the bars from assistive technology and keeps the counts as text', () => {
    renderInspectorScene()

    const bars = inspector().getByText('Input').closest('li')?.querySelectorAll('[aria-hidden]')

    expect(bars).toHaveLength(1)
  })

  it('has no flags or footnote when nothing is partial or stopped', () => {
    renderInspectorScene({ detail: testDetail({ lead: LEAD_REPORT }), items: [testSession(1)] })

    expect(inspector().queryByText('Stopped')).toBeNull()
    expect(inspector().queryByText(/Partial:/)).toBeNull()
    // Only the token rows and the files: no empty list of flags.
    expect(inspector().getAllByRole('list')).toHaveLength(2)
  })

  it('renders the name and the facts as plain text isolated from the text around them', () => {
    renderInspectorScene()

    expect(inspector().getByText('Lead').tagName).toBe('BDI')
    expect(inspector().getByText(/12 messages/).tagName).toBe('BDI')
  })

  it('sizes each token bar against the largest class', () => {
    renderInspectorScene()

    const fill = (label: string): string | undefined =>
      inspector().getByText(label).closest('li')?.querySelector('[style]')?.getAttribute('style') ??
      undefined

    expect([fill('Input'), fill('Output'), fill('Cache read')]).toEqual([
      'width: 100%;',
      'width: 40%;',
      'width: 10%;'
    ])
  })
})

describe('AgentInspector partial data', () => {
  it('flags a partial transcript and explains unreadable lines', () => {
    renderInspectorScene({
      detail: testDetail({ lead: { ...LEAD_REPORT, skippedLines: 2 } })
    })

    expect(inspector().getByText('Partial transcript')).toBeTruthy()
    expect(inspector().getByText(/Some transcript lines couldn't be read/)).toBeTruthy()
  })

  it('marks the tokens and the cost when transcript lines could not be read', () => {
    renderInspectorScene({ detail: testDetail({ lead: { ...LEAD_REPORT, skippedLines: 2 } }) })

    expect(inspector().getByText(/^1\.6K tokens/).textContent).toContain('¹')
    expect(inspector().getByText(/at API prices/).textContent).toContain('¹')
  })

  it('names the footnote, and gives its reasons in a fixed order', () => {
    const lead = {
      ...LEAD_REPORT,
      skippedLines: 1,
      fileListIncomplete: true,
      tokenGroups: [
        pricedGroup({ input: 5 }),
        pricedGroup({ input: 5 }, { kind: 'unpriced', reason: 'unknown-model' })
      ]
    }
    renderInspectorScene({ detail: testDetail({ lead }) })

    const note = inspector().getByText(/^¹ Partial:/).textContent ?? ''

    const order = [
      "Some transcript lines couldn't be read",
      'Some tokens have no known price',
      'The file list may be missing files'
    ].map((sentence) => note.indexOf(sentence))
    expect(order.every((at) => at >= 0)).toBe(true)
    expect(order).toEqual([...order].sort((a, b) => a - b))
  })

  it('marks a cost that leaves out tokens with no known price, and says so', () => {
    const lead = {
      ...LEAD_REPORT,
      tokenGroups: [
        pricedGroup({ input: 10 }),
        pricedGroup({ input: 5 }, { kind: 'unpriced', reason: 'unknown-model' })
      ]
    }
    renderInspectorScene({ detail: testDetail({ lead }) })

    expect(inspector().getByText(/\$2\.50 at API prices/).textContent).toContain('¹')
    expect(inspector().getByText(/Some tokens have no known price/)).toBeTruthy()
  })

  it('says the cost is not recorded when no token has a known price', () => {
    const lead = {
      ...LEAD_REPORT,
      tokenGroups: [pricedGroup({ input: 5 }, { kind: 'unpriced', reason: 'unknown-speed' })]
    }
    renderInspectorScene({ detail: testDetail({ lead }) })

    expect(inspector().getByText('cost not recorded')).toBeTruthy()
    expect(inspector().queryByText(/at API prices/)).toBeNull()
  })

  it('marks the rollup when an agent below has no tokens recorded', async () => {
    const detail = testDetail({
      lead: LEAD_REPORT,
      children: [testNode('a1', { meta: testMeta({ name: 'scout' }) })],
      reports: { a1: 'error' }
    })
    renderInspectorScene({ detail, items: [testSession(1)] })

    expect(inspector().getByText(/incl\. 1 below/).textContent).toContain('¹')
    expect(
      inspector().getByText(/Some agents below have partial or unrecorded totals/)
    ).toBeTruthy()
  })
})

describe('AgentInspector for an agent with no tokens recorded', () => {
  const noTokens = testDetail({
    lead: testReport({ messageCount: 2 }),
    children: [testNode('a1', { meta: testMeta({ name: 'scout' }) })],
    reports: { a1: testReport({ tokenGroups: [pricedGroup({ output: 40 })] }) }
  })

  it('says its tokens were not recorded and shows no tokens by class', () => {
    renderInspectorScene({ detail: noTokens, items: [testSession(1)] })

    expect(inspector().getByText('tokens not recorded')).toBeTruthy()
    expect(inspector().queryByRole('heading', { level: 3, name: /^Tokens/ })).toBeNull()
  })

  it('says the cost was not recorded instead of showing $0.00', () => {
    renderInspectorScene({ detail: noTokens, items: [testSession(1)] })

    expect(inspector().getByText('cost not recorded')).toBeTruthy()
    expect(inspector().queryByText(/at API prices/)).toBeNull()
  })

  it('marks the total with the agents below and explains why it may be low', () => {
    renderInspectorScene({ detail: noTokens, items: [testSession(1)] })

    expect(inspector().getByText(/40 tokens incl\. 1 below/).textContent).toContain('¹')
    expect(inspector().getByText(/This agent's own tokens weren't recorded/)).toBeTruthy()
  })
})

describe('AgentInspector when the subagents folder could not be read', () => {
  const unreadable = testDetail({ lead: LEAD_REPORT, reports: false })

  it('says the agents below could not be read, not that there are none', () => {
    renderInspectorScene({ detail: unreadable, items: [testSession(1)] })

    expect(inspector().getByText(/Agents below couldn't be read/).textContent).toContain('¹')
    expect(inspector().queryByText('No agents below')).toBeNull()
  })

  it('explains the marker in the footnote, even beside another reason', () => {
    const detail = testDetail({ lead: { ...LEAD_REPORT, skippedLines: 1 }, reports: false })
    renderInspectorScene({ detail, items: [testSession(1)] })

    const note = inspector().getByText(/^¹ Partial:/).textContent ?? ''

    expect(note).toContain("Some transcript lines couldn't be read")
    expect(note).toContain("couldn't read this session's subagents")
  })
})

describe('AgentInspector for a subagent', () => {
  it('shows who it is and its own figures when its node is selected', async () => {
    renderInspectorScene()

    await select(/^scout/)

    expect(inspector().getByRole('heading', { level: 2, name: 'scout' })).toBeTruthy()
    expect(inspector().getByText('Subagent · Explore')).toBeTruthy()
    expect(inspector().getByText('3 messages')).toBeTruthy()
    expect(inspector().getByText('40 tokens')).toBeTruthy()
    expect(inspector().getByText('No agents below')).toBeTruthy()
  })

  it('says it cannot read an agent, as a quiet note and not an alert', async () => {
    const detail = testDetail({ children: [testNode('a1')], reports: { a1: 'error' } })
    renderInspectorScene({ detail })

    await select(/^Explore/)

    expect(inspector().getByText("beekeeper couldn't read this agent's transcript.")).toBeTruthy()
    expect(inspector().queryByRole('alert')).toBeNull()
  })

  it('says it cannot read an agent whose report could not be read, and keeps who it is', async () => {
    const detail = testDetail({
      children: [testNode('a1', { meta: testMeta({ name: 'scout', agentType: 'Explore' }) })],
      reports: { a1: 'error' }
    })
    renderInspectorScene({ detail })

    await select(/^scout/)

    expect(inspector().getByRole('heading', { level: 2, name: 'scout' })).toBeTruthy()
    expect(inspector().getByText("beekeeper couldn't read this agent's transcript.")).toBeTruthy()
    expect(inspector().queryByText(/^Tokens/)).toBeNull()
  })

  it('flags a subagent the person stopped', async () => {
    const detail = testDetail({
      children: [testNode('a1', { meta: testMeta({ name: 'scout', stoppedByUser: true }) })],
      reports: { a1: testReport() }
    })
    renderInspectorScene({ detail })

    await select(/^scout/)

    expect(inspector().getByText('Stopped')).toBeTruthy()
  })

  it('names a teammate recorded in the lead’s transcript as one in the lead’s session', async () => {
    const detail = testDetail({
      children: [
        testNode('a1', { meta: testMeta({ name: 'worker', spawnDepth: 0, teamName: 'auth' }) })
      ]
    })
    renderInspectorScene({ detail })

    await select(/^worker/)

    expect(inspector().getByText("Teammate · in the lead's session")).toBeTruthy()
  })
})

describe('AgentInspector for a teammate', () => {
  const writerDetail = testDetail({
    lead: testReport({
      tokenGroups: [pricedGroup({ input: 400 })],
      messageCount: 7,
      fileTouches: [{ filePath: '/repo/w.ts', operation: 'update', source: 'edit-write' }]
    }),
    children: [testNode('w1', { meta: testMeta({ name: 'drafter' }) })],
    reports: { w1: testReport({ tokenGroups: [pricedGroup({ input: 70 })] }) }
  })

  it('says it is loading while the teammate’s session loads', async () => {
    renderInspectorScene({ sessions: { [WRITER.sessionId]: new Promise(() => undefined) } })

    await select(/^writer/)

    expect(await inspector().findByText('Loading this agent')).toBeTruthy()
    expect(inspector().getByRole('heading', { level: 2, name: 'writer (code)' })).toBeTruthy()
  })

  it('shows the teammate’s own session once it has loaded, with its subagents below', async () => {
    renderInspectorScene({ sessions: { [WRITER.sessionId]: { ok: true, value: writerDetail } } })

    await select(/^writer/)

    expect(await inspector().findByText('Teammate · own session')).toBeTruthy()
    expect(inspector().getByText('400 tokens')).toBeTruthy()
    expect(inspector().getByText('470 tokens incl. 1 below')).toBeTruthy()
    expect(inspector().getByText(/7 messages/)).toBeTruthy()
    expect(inspector().getByText('/repo/w.ts')).toBeTruthy()
    expect(inspector().getByText('Stopped')).toBeTruthy()
  })

  it('says it cannot read a teammate whose session could not be read', async () => {
    renderInspectorScene({
      sessions: { [WRITER.sessionId]: { ok: false, error: { code: 'unreadable' } } }
    })

    await select(/^writer/)

    expect(
      await inspector().findByText("beekeeper couldn't read this agent's transcript.")
    ).toBeTruthy()
  })

  /** The scene's sessions, with the writer reporting it has a subagent. */
  const itemsWithWriterSubagent = SCENE_ITEMS.map((item) =>
    item.sessionId === WRITER.sessionId ? { ...item, subagentCount: 1 } : item
  )
  // Every agent below has a report, so only the writer's missing subagents can make the total low.
  const leadWithReports = testDetail({
    lead: LEAD_REPORT,
    children: [testNode('a1', { meta: testMeta({ name: 'scout' }) })],
    reports: { a1: testReport({ tokenGroups: [pricedGroup({ output: 40 })] }) }
  })
  const sceneWithWriterSubagent = {
    detail: leadWithReports,
    items: itemsWithWriterSubagent,
    sessions: { [WRITER.sessionId]: { ok: true, value: writerDetail } as const }
  }

  it('adds an open teammate’s subagents to the lead’s rollup', async () => {
    renderInspectorScene(sceneWithWriterSubagent)
    expect(inspector().getByText(/tokens incl\. 3 below/)).toBeTruthy()

    await select(/^writer/)
    await inspector().findByText('Teammate · own session')
    await select(/^Lead/)

    expect(inspector().getByText(/tokens incl\. 4 below/)).toBeTruthy()
  })

  it('marks the lead’s total and explains it while a teammate’s subagents are not loaded', () => {
    renderInspectorScene(sceneWithWriterSubagent)

    expect(inspector().getByText(/tokens incl\. 3 below/).textContent).toContain('¹')
    expect(inspector().getByText(/subagents aren.t loaded yet/)).toBeTruthy()
  })

  it('drops the mark and the explanation once the teammate’s subagents are loaded', async () => {
    renderInspectorScene(sceneWithWriterSubagent)

    await select(/^writer/)
    await inspector().findByText('Teammate · own session')
    await select(/^Lead/)

    expect(inspector().getByText(/tokens incl\. 4 below/).textContent).not.toContain('¹')
    expect(inspector().queryByText(/subagents aren.t loaded yet/)).toBeNull()
  })

  it('still flags a stopped teammate whose session could not be read', async () => {
    renderInspectorScene({
      sessions: { [WRITER.sessionId]: { ok: false, error: { code: 'unreadable' } } }
    })

    await select(/^writer/)

    expect(await inspector().findByText('Stopped')).toBeTruthy()
  })

  it('announces the loading state politely', async () => {
    renderInspectorScene({ sessions: { [WRITER.sessionId]: new Promise(() => undefined) } })

    await select(/^writer/)

    expect(await inspector().findByRole('status')).toBeTruthy()
  })

  it('shows what a chip opened the session with selected, once it has loaded', async () => {
    useNavigationStore.getState().showSession(testRef(1), { kind: 'teammate', ref: WRITER })

    renderInspectorScene({ sessions: { [WRITER.sessionId]: { ok: true, value: writerDetail } } })

    await waitFor(() => {
      expect(inspector().getByText('Teammate · own session')).toBeTruthy()
    })
  })

  it('does not re-parse the lead when the selection comes back to it from a teammate', async () => {
    const stale = Date.now() - 3 * LISTS_STALE_TIME_MS
    const client = createTestQueryClient()
    client.setQueryData(['session', WRITER.projectDirName, WRITER.sessionId], writerDetail, {
      updatedAt: stale
    })
    const { api } = renderInspectorScene({
      client,
      detailUpdatedAt: stale,
      sessions: { [WRITER.sessionId]: { ok: true, value: writerDetail } }
    })

    await select(/^writer/)
    await inspector().findByText('Teammate · own session')
    await select(/^Lead/)

    expect(await inspector().findByText('Lead session')).toBeTruthy()
    const leadCalls = api.getSession.mock.calls.filter(([, id]) => id === SCENE_SESSION.sessionId)
    expect(leadCalls).toHaveLength(0)
  })

  it('shows the lead again, with no error, for a selection that is not in the graph', () => {
    useNavigationStore.getState().showSession(testRef(1), { kind: 'teammate', ref: testRef(9) })

    renderInspectorScene()

    expect(inspector().getByText('Lead session')).toBeTruthy()
  })
})
