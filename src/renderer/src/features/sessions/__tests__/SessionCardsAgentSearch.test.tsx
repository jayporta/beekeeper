import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { SessionListItemDto } from '../../../../../shared/ipc/sessionListDto'
import { useFirstRunStore } from '@renderer/features/firstRun/state/useFirstRunStore'
import { useNavigationStore } from '@renderer/features/navigation/state/useNavigationStore'
import { installBeekeeperApi, testProject } from '@renderer/testBeekeeperApi'
import { renderApp, resetPersistedState } from '@renderer/testRenderApp'
import { useSessionsViewStore } from '../state/useSessionsViewStore'
import {
  testAgentRole,
  testLeadTeam,
  testRef,
  testSession,
  testTeammateTeam
} from '../testSessionFixtures'

const DIR = '-Users-a-repo'

const SCOUT = { name: 'scout', description: 'Map the auth flow', agentType: 'Explore' }

const refactor = testSession(1, {
  projectDirName: DIR,
  title: 'Refactor parser',
  latestMs: 3,
  agentTerms: [SCOUT]
})
const authTitled = testSession(2, {
  projectDirName: DIR,
  title: 'Fix auth flow',
  latestMs: 2,
  agentTerms: [SCOUT]
})
const lead = testSession(3, {
  projectDirName: DIR,
  title: 'Team lead',
  latestMs: 1,
  team: testLeadTeam([testRef(4, DIR)])
})
const mate = testSession(4, {
  projectDirName: DIR,
  role: testAgentRole('reviewer', 'code'),
  team: testTeammateTeam(testRef(3, DIR)),
  agentTerms: [{ name: 'checker', description: null, agentType: 'Plan' }]
})

beforeEach(() => {
  useFirstRunStore.setState({ dismissed: true })
  useSessionsViewStore.setState({ query: '' })
})

afterEach(async () => {
  useNavigationStore.getState().reset()
  await resetPersistedState()
})

async function search(text: string, sessions: readonly SessionListItemDto[]): Promise<void> {
  installBeekeeperApi({
    listProjects: () => Promise.resolve({ ok: true, value: [testProject(DIR)] }),
    listSessions: () => Promise.resolve({ ok: true, value: sessions })
  })
  renderApp()
  const box = await screen.findByRole('searchbox', { name: 'Search sessions' })
  if (text !== '') await userEvent.type(box, text)
}

const card = async (name: string): Promise<HTMLElement> => {
  const item = (await screen.findByRole('button', { name })).closest('li')
  if (item === null) throw new Error(`No card for ${name}`)
  return item
}

const scanning = testSession(6, {
  projectDirName: DIR,
  title: 'Audit deps',
  latestMs: 4,
  workflowRunNames: ['security scan']
})

describe('session search by workflow run', () => {
  it('shows a session whose workflow run matches, naming the workflow', async () => {
    await search('SCAN', [scanning, refactor])

    const shown = await card('Audit deps')
    expect(within(shown).getByText('matching workflow security scan')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Refactor parser' })).toBeNull()
  })

  it('names the workflow rather than a subagent when both match', async () => {
    const both = testSession(7, {
      projectDirName: DIR,
      title: 'Both',
      latestMs: 1,
      workflowRunNames: ['explore sweep'],
      agentTerms: [SCOUT]
    })

    await search('explore', [both])

    const shown = await card('Both')
    expect(within(shown).getByText('matching workflow explore sweep')).toBeTruthy()
    expect(within(shown).queryByText(/^matching subagent/)).toBeNull()
  })

  it('shows a workflow name as plain text', async () => {
    const markup = testSession(8, {
      projectDirName: DIR,
      title: 'Plain',
      latestMs: 1,
      workflowRunNames: ['<b>bold</b>']
    })

    await search('bold', [markup])

    expect(within(await card('Plain')).getByText('matching workflow <b>bold</b>')).toBeTruthy()
  })

  it('shows no "matching workflow" line without a search', async () => {
    await search('', [scanning])

    expect(within(await card('Audit deps')).queryByText(/^matching workflow/)).toBeNull()
  })
})

describe('session search by subagent', () => {
  it.each([
    ['name', 'SCOUT'],
    ['description', 'map the AUTH'],
    ['type', 'explore']
  ])('shows a session whose subagent matches by %s, naming the subagent', async (_field, text) => {
    await search(text, [refactor, lead, mate])

    const shown = await card('Refactor parser')
    expect(within(shown).getByText('matching subagent scout')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Team lead' })).toBeNull()
  })

  it('shows one card with no "matching subagent" line when the title and a subagent both match', async () => {
    await search('auth flow', [authTitled, refactor])

    expect(screen.getAllByRole('button', { name: 'Fix auth flow' })).toHaveLength(1)
    const shown = await card('Fix auth flow')
    expect(within(shown).queryByText(/^matching subagent/)).toBeNull()
    expect(within(await card('Refactor parser')).getByText('matching subagent scout')).toBeTruthy()
  })

  it('highlights a teammate’s chip, and adds no "matching subagent" line, when its own subagent matches', async () => {
    await search('checker', [lead, mate, refactor])

    const shown = await card('Team lead')
    expect(within(shown).getByRole('button', { name: /^reviewer \(code\)/ })).toBeTruthy()
    expect(within(shown).getByText('matches search')).toBeTruthy()
    expect(within(shown).queryByText(/^matching subagent/)).toBeNull()
    expect(screen.queryByRole('button', { name: 'Refactor parser' })).toBeNull()
  })

  it('shows a subagent name as plain text', async () => {
    const markup = testSession(5, {
      projectDirName: DIR,
      title: 'Plain',
      latestMs: 1,
      agentTerms: [{ name: '<b>bold</b>', description: null, agentType: 'Explore' }]
    })

    await search('bold', [markup])

    expect(within(await card('Plain')).getByText('matching subagent <b>bold</b>')).toBeTruthy()
  })

  it('shows no "matching subagent" line without a search', async () => {
    await search('', [refactor])

    expect(within(await card('Refactor parser')).queryByText(/^matching subagent/)).toBeNull()
  })
})
