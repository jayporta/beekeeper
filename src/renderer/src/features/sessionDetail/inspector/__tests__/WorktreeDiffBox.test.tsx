import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import type { IpcResult } from '../../../../../../shared/ipc/ipcResult'
import type {
  AgentWorktreeDiffDto,
  WorktreeDiffCodeDto,
  WorktreeDiffsDto
} from '../../../../../../shared/ipc/worktreeDiffDto'
import { LISTS_STALE_TIME_MS } from '@renderer/app/listsStaleTime'
import { useNavigationStore } from '@renderer/features/navigation/state/useNavigationStore'
import { testRef } from '@renderer/features/sessions/testSessionFixtures'
import { createTestQueryClient } from '@renderer/testQueryWrapper'
import { SCENE_OTHER_FOLDER, SCENE_SESSION } from '../../graph/testGraphScene'
import { testDetail, testMeta, testNode, testReport } from '../../testSessionDetail'
import { LEAD_REPORT, inspector, renderInspectorScene } from '../testInspectorScene'

afterEach(() => {
  useNavigationStore.getState().reset()
})

const WRITER = testRef(2)
const TESTER = testRef(3, SCENE_OTHER_FOLDER)

/** A lead with a subagent `scout` on a worktree branch, and one, `reader`, on none. */
const worktreeDetail = testDetail({
  lead: LEAD_REPORT,
  children: [
    testNode('a1', { meta: testMeta({ name: 'scout', worktreeBranch: 'feature/x' }) }),
    testNode('a2', { meta: testMeta({ name: 'reader' }) })
  ],
  reports: { a1: testReport(), a2: testReport() }
})

const diffOf = (result: AgentWorktreeDiffDto['result']): IpcResult<WorktreeDiffsDto> => ({
  ok: true,
  value: {
    git: 'ok',
    agents: [{ agentId: 'a1', inferredBase: false, result }],
    sharedWorktree: null
  }
})
const okDiff = (
  files: { path: string; added: number | null; deleted: number | null }[]
): IpcResult<WorktreeDiffsDto> =>
  diffOf({ ok: true, diff: { uncommitted: 'included', files, untracked: [] } })

const open = async (diffs: Parameters<typeof renderInspectorScene>[0] = {}): Promise<void> => {
  renderInspectorScene({ detail: worktreeDetail, ...diffs })
  await userEvent.click(screen.getByRole('button', { name: /^scout/ }))
}

describe('WorktreeDiffBox for a subagent on a worktree branch', () => {
  it('shows the branch and the lines it added and deleted across its files', async () => {
    await open({
      diffs: {
        [SCENE_SESSION.sessionId]: okDiff([
          { path: 'a.ts', added: 10, deleted: 2 },
          { path: 'b.ts', added: 5, deleted: 0 }
        ])
      }
    })

    expect(await inspector().findByText('+15 −2 across 2 files')).toBeTruthy()
    expect(inspector().getByRole('heading', { level: 3, name: 'Worktree diff' })).toBeTruthy()
    expect(inspector().getByText('feature/x').tagName).toBe('BDI')
  })

  it('reads the entry of the selected agent, not another worktree agent’s', async () => {
    await open({
      diffs: {
        [SCENE_SESSION.sessionId]: {
          ok: true,
          value: {
            git: 'ok',
            sharedWorktree: null,
            agents: [
              {
                agentId: 'someone-else',
                inferredBase: false,
                result: {
                  ok: true,
                  diff: {
                    uncommitted: 'included',
                    files: [{ path: 'z.ts', added: 99, deleted: 99 }],
                    untracked: []
                  }
                }
              },
              {
                agentId: 'a1',
                inferredBase: false,
                result: {
                  ok: true,
                  diff: {
                    uncommitted: 'included',
                    files: [{ path: 'a.ts', added: 1, deleted: 2 }],
                    untracked: []
                  }
                }
              }
            ]
          }
        }
      }
    })

    expect(await inspector().findByText('+1 −2 across 1 file')).toBeTruthy()
  })

  it('counts a binary file as a file with no lines, and one file in the singular', async () => {
    await open({
      diffs: {
        [SCENE_SESSION.sessionId]: okDiff([{ path: 'logo.png', added: null, deleted: null }])
      }
    })

    expect(await inspector().findByText('+0 −0 across 1 file')).toBeTruthy()
  })

  it('says it is loading the diff while git runs', async () => {
    await open({ diffs: { [SCENE_SESSION.sessionId]: new Promise(() => undefined) } })

    expect(await inspector().findByText('Loading the diff')).toBeTruthy()
    expect(inspector().getByText('feature/x')).toBeTruthy()
  })

  it('says the diff could not be loaded when the call fails', async () => {
    await open({
      diffs: { [SCENE_SESSION.sessionId]: { ok: false, error: { code: 'unreadable' } } }
    })

    expect(await inspector().findByText("beekeeper couldn't load the diff.")).toBeTruthy()
  })

  it.each([
    ['git-not-found', "Git isn't installed, so the diff isn't available."],
    ['git-too-old', 'This version of git is too old to show the diff. Update git to see it.']
  ] as const)('says so when git is unusable (%s), with no diff', async (git, note) => {
    await open({
      diffs: {
        [SCENE_SESSION.sessionId]: { ok: true, value: { git, agents: [], sharedWorktree: null } }
      }
    })

    expect(await inspector().findByText(note)).toBeTruthy()
    expect(inspector().queryByText(/across/)).toBeNull()
  })

  it.each([
    ['branch-not-found', 'The branch no longer exists.'],
    ['repo-missing', "The repository can't be found."],
    ['output-too-large', 'The diff is too large to show.'],
    ['timeout', 'Git took too long to produce the diff.'],
    ['too-many-agents', 'This session has too many worktree agents to diff them all.'],
    ['no-base', "There's no base branch to compare with."],
    ['git-failed', "The diff couldn't be computed."]
  ] as [WorktreeDiffCodeDto, string][])(
    'notes quietly why a diff failed (%s)',
    async (code, note) => {
      await open({ diffs: { [SCENE_SESSION.sessionId]: diffOf({ ok: false, code }) } })

      expect(await inspector().findByText(note)).toBeTruthy()
    }
  )

  it('says the diff could not be computed when the diffs hold no entry for the agent', async () => {
    await open({
      diffs: {
        [SCENE_SESSION.sessionId]: {
          ok: true,
          value: { git: 'ok', agents: [], sharedWorktree: null }
        }
      }
    })

    expect(await inspector().findByText("The diff couldn't be computed.")).toBeTruthy()
  })

  it('has no link to open the diff yet', async () => {
    await open({ diffs: { [SCENE_SESSION.sessionId]: okDiff([]) } })
    await inspector().findByText('+0 −0 across 0 files')

    expect(inspector().queryByRole('button')).toBeNull()
    expect(inspector().queryByRole('link')).toBeNull()
  })
})

describe('WorktreeDiffBox refresh', () => {
  const DIFFS_KEY = ['worktreeDiffs', SCENE_SESSION.projectDirName, SCENE_SESSION.sessionId]
  const DETAIL_KEY = ['session', SCENE_SESSION.projectDirName, SCENE_SESSION.sessionId]
  const COUNTS = '+3 −1 across 1 file'
  const cachedDiffs = okDiff([{ path: 'a.ts', added: 3, deleted: 1 }])
  const cachedValue = cachedDiffs.ok ? cachedDiffs.value : undefined
  const STALE = 2 * LISTS_STALE_TIME_MS

  /** Renders the scene with the detail and the diffs cached, both past their stale time. */
  const openCached = (diffsAgo: number): ReturnType<typeof renderInspectorScene> => {
    const client = createTestQueryClient()
    client.setQueryData(DIFFS_KEY, cachedValue, { updatedAt: Date.now() - diffsAgo })
    return renderInspectorScene({
      detail: worktreeDetail,
      client,
      detailUpdatedAt: Date.now() - 3 * LISTS_STALE_TIME_MS,
      diffs: { [SCENE_SESSION.sessionId]: okDiff([{ path: 'new.ts', added: 9, deleted: 9 }]) }
    })
  }

  it('loads the diffs when none are cached', async () => {
    const { api } = renderInspectorScene({
      detail: worktreeDetail,
      diffs: { [SCENE_SESSION.sessionId]: cachedDiffs }
    })

    await userEvent.click(screen.getByRole('button', { name: /^scout/ }))

    expect(await inspector().findByText(COUNTS)).toBeTruthy()
    expect(api.getWorktreeDiffs).toHaveBeenCalledTimes(1)
  })

  it('does not run git again when the cached diffs are newer than the cached detail', async () => {
    const { api } = openCached(STALE)

    await userEvent.click(screen.getByRole('button', { name: /^scout/ }))

    expect(await inspector().findByText(COUNTS)).toBeTruthy()
    expect(api.getWorktreeDiffs).not.toHaveBeenCalled()
  })

  it('runs git again when the detail was refreshed after the diffs were cached', async () => {
    const { api, client } = openCached(STALE)
    await userEvent.click(screen.getByRole('button', { name: /^scout/ }))
    await inspector().findByText(COUNTS)
    await userEvent.click(screen.getByRole('button', { name: /^reader/ }))

    client.setQueryData(DETAIL_KEY, worktreeDetail, { updatedAt: Date.now() })
    await userEvent.click(screen.getByRole('button', { name: /^scout/ }))

    expect(await inspector().findByText('+9 −9 across 1 file')).toBeTruthy()
    expect(api.getWorktreeDiffs).toHaveBeenCalledTimes(1)
  })
})

describe('WorktreeDiffBox when no diff applies', () => {
  it('is not shown, and git is not asked, for a subagent with no worktree branch', async () => {
    const { api } = renderInspectorScene({ detail: worktreeDetail })

    await userEvent.click(screen.getByRole('button', { name: /^reader/ }))

    expect(inspector().queryByText('Worktree diff')).toBeNull()
    expect(api.getWorktreeDiffs).not.toHaveBeenCalled()
  })

  it('is not shown, and git is not asked, for the lead', () => {
    const { api } = renderInspectorScene({ detail: worktreeDetail })

    expect(inspector().queryByText('Worktree diff')).toBeNull()
    expect(api.getWorktreeDiffs).not.toHaveBeenCalled()
  })

  it('asks for the session that holds the subagent', async () => {
    const { api } = renderInspectorScene({ detail: worktreeDetail })

    await userEvent.click(screen.getByRole('button', { name: /^scout/ }))

    await waitFor(() => {
      expect(api.getWorktreeDiffs).toHaveBeenCalledWith(
        SCENE_SESSION.projectDirName,
        SCENE_SESSION.sessionId
      )
    })
  })
})

describe('WorktreeDiffBox for a teammate in a session of its own', () => {
  const shared = (git: WorktreeDiffsDto['git'] = 'ok'): IpcResult<WorktreeDiffsDto> => ({
    ok: true,
    value: { git, agents: [], sharedWorktree: { lead: SCENE_SESSION, agentId: 'a1f3c9e2d4abc' } }
  })

  it('points at the lead’s subagent whose worktree it shares', async () => {
    renderInspectorScene({ diffs: { [WRITER.sessionId]: shared() } })

    await userEvent.click(screen.getByRole('button', { name: /^writer/ }))

    expect(await inspector().findByText(/Shares the worktree of subagent a1f3c9e2 /)).toBeTruthy()
    expect(inspector().getByRole('heading', { level: 3, name: 'Worktree diff' })).toBeTruthy()
  })

  it('shows the shared worktree even when git is unusable', async () => {
    renderInspectorScene({ diffs: { [WRITER.sessionId]: shared('git-not-found') } })

    await userEvent.click(screen.getByRole('button', { name: /^writer/ }))

    expect(await inspector().findByText(/Shares the worktree of subagent/)).toBeTruthy()
  })

  it('opens the lead’s session with that subagent selected from the button', async () => {
    renderInspectorScene({ diffs: { [WRITER.sessionId]: shared() } })
    await userEvent.click(screen.getByRole('button', { name: /^writer/ }))

    await userEvent.click(await inspector().findByRole('button', { name: 'Show that subagent' }))

    expect(useNavigationStore.getState()).toMatchObject({
      view: 'session',
      selectedSessionRef: SCENE_SESSION,
      selectedAgent: { kind: 'subagent', ownerRef: SCENE_SESSION, agentId: 'a1f3c9e2d4abc' }
    })
  })

  it('shows no box for a teammate that shares no worktree', async () => {
    const { api } = renderInspectorScene()

    await userEvent.click(screen.getByRole('button', { name: /^writer/ }))
    await inspector().findByText('Teammate · own session')
    await waitFor(() => {
      expect(api.getWorktreeDiffs).toHaveBeenCalled()
    })

    expect(inspector().queryByText('Worktree diff')).toBeNull()
  })

  it('reads the diffs of a teammate in another folder by its own folder', async () => {
    const { api } = renderInspectorScene()

    await userEvent.click(screen.getByRole('button', { name: /^tester/ }))

    await waitFor(() => {
      expect(api.getWorktreeDiffs).toHaveBeenCalledWith(TESTER.projectDirName, TESTER.sessionId)
    })
  })
})
