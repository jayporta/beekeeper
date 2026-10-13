import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { EMPTY_AGENT_SIGNALS_DTO } from '../../../../../../shared/ipc/emptyAgentSignals'
import type { SessionDetailDto } from '../../../../../../shared/ipc/sessionDetailDto'
import { useFirstRunStore } from '@renderer/features/firstRun/state/useFirstRunStore'
import { useNavigationStore } from '@renderer/features/navigation/state/useNavigationStore'
import { testRef, testSession } from '@renderer/features/sessions/testSessionFixtures'
import { installBeekeeperApi } from '@renderer/testBeekeeperApi'
import { renderApp, resetPersistedState } from '@renderer/testRenderApp'
import { testDetail, testMeta, testNode, testReport, testTokenGroup } from '../../testSessionDetail'

const DIR = '-Users-a-repo'

const lead = testSession(1, {
  projectDirName: DIR,
  title: 'Refactor parser',
  totalTokens: 10_000,
  subagentCount: 2
})

const signals = (
  toolErrors: number,
  longestErrorStreak: number
): typeof EMPTY_AGENT_SIGNALS_DTO => ({
  ...EMPTY_AGENT_SIGNALS_DTO,
  toolErrors,
  longestErrorStreak
})

const DETAIL = testDetail({
  lead: testReport({
    tokenGroups: [testTokenGroup({ input: 600, output: 400 })],
    signals: signals(3, 0)
  }),
  children: [
    testNode('a1', { meta: testMeta({ name: 'scout' }) }),
    testNode('a2', { meta: testMeta({ name: 'reader' }) })
  ],
  reports: {
    a1: testReport({
      tokenGroups: [testTokenGroup({ output: 3000, cacheRead: 1000 })],
      signals: signals(7, 4)
    })
  }
})

beforeEach(() => {
  useFirstRunStore.setState({ dismissed: true })
})

afterEach(async () => {
  useNavigationStore.getState().reset()
  await resetPersistedState()
})

async function open(detail: SessionDetailDto = DETAIL): Promise<void> {
  installBeekeeperApi({
    listSessions: () => Promise.resolve({ ok: true, value: [lead] }),
    getSession: () => Promise.resolve({ ok: true, value: detail })
  })
  useNavigationStore.getState().showSession(testRef(1, DIR))
  renderApp()
  await screen.findByRole('region', { name: 'Breakdown' })
}

const card = (name: string): ReturnType<typeof within> =>
  within(screen.getByRole('region', { name }))

describe('Breakdown card', () => {
  it('lists the lead’s and subagents’ tokens by class', async () => {
    await open()

    const rows = card('Breakdown')
      .getAllByRole('listitem')
      .map((row: HTMLElement) => row.textContent)

    expect(rows).toEqual(['Input600', 'Output3.4K', 'Cache read1K', 'Cache write0'])
  })

  it('says it counts the lead and subagents', async () => {
    await open()

    expect(card('Breakdown').getByText('Lead and subagents')).toBeTruthy()
  })

  it('marks the caption when a subagent’s report could not be read', async () => {
    await open(testDetail({ ...DETAIL, reports: { a1: 'error' }, children: DETAIL.tree.children }))

    expect(card('Breakdown').getByText('partial, see the note under the header')).toBeTruthy()
  })

  it('marks the caption when a report skipped transcript lines', async () => {
    await open(testDetail({ lead: testReport({ skippedLines: 3 }) }))

    expect(card('Breakdown').getByText('partial, see the note under the header')).toBeTruthy()
  })

  it('has no partial marker when every report was read', async () => {
    await open()

    expect(card('Breakdown').queryByText('partial, see the note under the header')).toBeNull()
  })
})

describe('Most tokens card', () => {
  it('ranks the agents by tokens with their share of the total', async () => {
    await open()

    const rows = card('Most tokens').getAllByRole('button')

    expect(rows.map((row: HTMLElement) => row.textContent)).toEqual(['scout4K40%', 'Lead1K10%'])
  })

  it('leaves out an agent with no tokens', async () => {
    await open()

    expect(card('Most tokens').queryByText('reader')).toBeNull()
  })

  it('selects the agent and focuses its graph node when a row is pressed', async () => {
    await open()

    await userEvent.click(card('Most tokens').getByRole('button', { name: /^scout/ }))

    await waitFor(() => {
      expect(document.activeElement?.getAttribute('data-agent-key')).toMatch(/^sub:.*:a1$/)
    })
    expect(useNavigationStore.getState().selectedAgent).toMatchObject({ agentId: 'a1' })
  })

  it('selects the lead, whose selection is null, and focuses its node', async () => {
    await open()
    await userEvent.click(card('Most tokens').getByRole('button', { name: /^scout/ }))

    await userEvent.click(card('Most tokens').getByRole('button', { name: /^Lead/ }))

    expect(useNavigationStore.getState().selectedAgent).toBeNull()
    expect(document.activeElement?.getAttribute('data-agent-key')).toBe('lead')
  })

  it('says so when no agent recorded tokens', async () => {
    await open(testDetail())

    expect(card('Most tokens').getByText('No agent recorded tokens.')).toBeTruthy()
  })
})

describe('Signals card with many agents', () => {
  const many = (count: number): SessionDetailDto => {
    const ids = Array.from({ length: count }, (_, i) => `a${i}`)
    return testDetail({
      children: ids.map((id) => testNode(id, { meta: testMeta({ name: `agent ${id}` }) })),
      reports: Object.fromEntries(
        ids.map((id, i) => [id, testReport({ signals: signals(100 - i, 0) })])
      )
    })
  }

  it('lists the six with the most tool errors and says how many more there are', async () => {
    await open(many(8))

    expect(card('Signals').getAllByRole('button')).toHaveLength(6)
    expect(card('Signals').getByText('and 2 more')).toBeTruthy()
  })

  it('says "and 1 more" for one left out', async () => {
    await open(many(7))

    expect(card('Signals').getByText('and 1 more')).toBeTruthy()
  })

  it('says nothing about more when all fit', async () => {
    await open(many(6))

    expect(card('Signals').queryByText(/and \d+ more/)).toBeNull()
  })
})

describe('Signals card', () => {
  it('ranks the agents with tool errors, with the streak when there is one', async () => {
    await open()

    const rows = card('Signals').getAllByRole('button')

    expect(rows.map((row: HTMLElement) => row.textContent)).toEqual(['scoutstreak 47', 'Lead3'])
  })

  it('explains what a tool error counts', async () => {
    await open()

    expect(card('Signals').getByText(/Includes calls a hook blocked/)).toBeTruthy()
  })

  it('says so when there are no tool errors', async () => {
    await open(testDetail())

    expect(card('Signals').getByText('No tool errors')).toBeTruthy()
    expect(card('Signals').queryByRole('button')).toBeNull()
  })

  it('selects the agent when a row is pressed', async () => {
    await open()

    await userEvent.click(card('Signals').getByRole('button', { name: /^scout/ }))

    expect(useNavigationStore.getState().selectedAgent).toMatchObject({ agentId: 'a1' })
  })
})
