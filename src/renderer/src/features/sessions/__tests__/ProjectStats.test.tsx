import { render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { installBeekeeperApi, testProject } from '@renderer/testBeekeeperApi'
import { createQueryWrapper } from '@renderer/testQueryWrapper'
import { ProjectStats } from '../ProjectStats'
import type { FolderStats as Stats } from '../folderStats'

const DIR = '-Users-a-alpha'
const WORKTREE = '-Users-a-alpha--claude-worktrees-x'

const COMPLETE: Stats = {
  sessions: 3,
  tokens: 150,
  usd: 1.5,
  agents: 7,
  latestMs: null,
  reasons: [],
  partial: { tokens: false, cost: false, sessions: false, agents: false }
}

function installProjects(): void {
  installBeekeeperApi({
    listProjects: () =>
      Promise.resolve({
        ok: true,
        value: [
          testProject(DIR),
          testProject(WORKTREE, { worktreeOf: DIR, worktreeName: 'x' }),
          testProject('-Users-a-beta')
        ]
      })
  })
}

function renderStats(stats: Stats, dirName = DIR): void {
  installProjects()
  render(<ProjectStats stats={stats} dirName={dirName} />, { wrapper: createQueryWrapper() })
}

/** The value of the stat with this label. */
function valueOf(label: string): string {
  const term = screen.getByText(label, { selector: 'dt' })
  return term.nextElementSibling?.textContent ?? ''
}

describe('ProjectStats', () => {
  it('shows each figure beside its label', () => {
    renderStats(COMPLETE)

    expect(valueOf('Sessions')).toBe('3')
    expect(valueOf('Tokens')).toBe('150')
    expect(valueOf('At API prices')).toBe('$1.50')
    expect(valueOf('Agents')).toBe('7')
  })

  it('says None for a folder with no latest time', () => {
    renderStats(COMPLETE)

    expect(valueOf('Latest')).toBe('None')
  })

  it('shows the latest time as a date and time', () => {
    renderStats({ ...COMPLETE, latestMs: Date.UTC(2026, 9, 12, 12, 0) })

    expect(valueOf('Latest')).not.toBe('None')
  })

  it('counts the worktrees of a project', async () => {
    renderStats(COMPLETE)

    await waitFor(() => expect(valueOf('Worktrees')).toBe('1'))
  })

  it('leaves Worktrees out for a worktree folder', async () => {
    renderStats(COMPLETE, WORKTREE)

    await waitFor(() => expect(screen.getByText('Sessions', { selector: 'dt' })).toBeTruthy())
    expect(screen.queryByText('Worktrees', { selector: 'dt' })).toBeNull()
  })

  it('has no footnote or marker when the figures are complete', () => {
    renderStats(COMPLETE)

    expect(screen.queryByText(/Partial/)).toBeNull()
    expect(document.querySelector('sup')).toBeNull()
  })

  it('marks the cost and explains why when a session recorded none', () => {
    renderStats({
      ...COMPLETE,
      reasons: ['withoutCost'],
      partial: { tokens: false, cost: true, sessions: false, agents: false }
    })

    const cost = screen.getByText('At API prices', { selector: 'dt' }).nextElementSibling
    expect(cost?.querySelector('sup')).not.toBeNull()
    expect(within(document.body).getByText(/Some sessions recorded no cost\./)).toBeTruthy()
    expect(valueOf('Tokens')).toBe('150')
    expect(
      screen.getByText('Tokens', { selector: 'dt' }).nextElementSibling?.querySelector('sup')
    ).toBeNull()
  })

  it('marks the agents when their count may be low', () => {
    renderStats({
      ...COMPLETE,
      reasons: ['uncountedSubagents'],
      partial: { tokens: false, cost: false, sessions: false, agents: true }
    })

    const agents = screen.getByText('Agents', { selector: 'dt' }).nextElementSibling
    expect(agents?.querySelector('sup')).not.toBeNull()
  })
})
