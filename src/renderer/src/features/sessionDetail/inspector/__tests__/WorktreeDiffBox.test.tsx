import { act, fireEvent, screen, waitFor } from '@testing-library/react'
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
import { shortId } from '@renderer/features/sessions/sessionLabel'
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

/** The hidden live copy repeats the shared note until it clears, so queries for the visible note skip status regions. */
const VISIBLE_ONLY = '[role="status"], script, style'

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

  it('announces a failed diff load in the status region that said it was loading', async () => {
    await open({
      diffs: { [SCENE_SESSION.sessionId]: { ok: false, error: { code: 'unreadable' } } }
    })

    const note = await inspector().findByText("beekeeper couldn't load the diff.")
    expect(note.closest('[role="status"]')).not.toBeNull()
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

  it('has nothing to open when the agent changed no files', async () => {
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

describe('WorktreeDiffBox for a subagent of a teammate’s session', () => {
  const drafterDetail = testDetail({
    lead: testReport(),
    children: [
      testNode('w1', { meta: testMeta({ name: 'drafter', worktreeBranch: 'feature/w' }) })
    ],
    reports: { w1: testReport() }
  })
  const writerDiffs = (
    sharedWorktree: WorktreeDiffsDto['sharedWorktree']
  ): IpcResult<WorktreeDiffsDto> => ({
    ok: true,
    value: {
      git: 'ok',
      sharedWorktree,
      agents: [
        {
          agentId: 'w1',
          inferredBase: false,
          result: {
            ok: true,
            diff: {
              uncommitted: 'included',
              files: [{ path: 'w.ts', added: 1, deleted: 0 }],
              untracked: []
            }
          }
        }
      ]
    }
  })
  const openDrafter = async (diffs: IpcResult<WorktreeDiffsDto>): Promise<void> => {
    renderInspectorScene({
      sessions: { [WRITER.sessionId]: { ok: true, value: drafterDetail } },
      diffs: { [WRITER.sessionId]: diffs }
    })
    await userEvent.click(screen.getByRole('button', { name: /^writer/ }))
    await userEvent.click(await screen.findByRole('button', { name: /^drafter/ }))
  }

  it('shows its own diff, and not the teammate’s shared worktree, in a session that has one', async () => {
    await openDrafter(writerDiffs({ lead: SCENE_SESSION, agentId: 'a1f3c9e2d4abc' }))

    expect(await inspector().findByText('+1 −0 across 1 file')).toBeTruthy()
    expect(inspector().queryByText(/Shares the worktree/)).toBeNull()
    expect(inspector().queryByRole('button', { name: /^Show subagent/ })).toBeNull()
  })

  it('does not run git again for the lead’s diffs when the selection comes back to its subagent', async () => {
    const client = createTestQueryClient()
    client.setQueryData(
      ['worktreeDiffs', SCENE_SESSION.projectDirName, SCENE_SESSION.sessionId],
      { git: 'ok', agents: [], sharedWorktree: null } satisfies WorktreeDiffsDto,
      { updatedAt: Date.now() - 2 * LISTS_STALE_TIME_MS }
    )
    const { api } = renderInspectorScene({
      detail: worktreeDetail,
      client,
      detailUpdatedAt: Date.now() - 3 * LISTS_STALE_TIME_MS,
      sessions: { [WRITER.sessionId]: { ok: true, value: drafterDetail } },
      diffs: { [WRITER.sessionId]: writerDiffs(null) }
    })

    await userEvent.click(screen.getByRole('button', { name: /^writer/ }))
    await userEvent.click(await screen.findByRole('button', { name: /^drafter/ }))
    await inspector().findByText('+1 −0 across 1 file')
    await userEvent.click(screen.getByRole('button', { name: /^scout/ }))
    await inspector().findByText('feature/x')

    const leadCalls = api.getWorktreeDiffs.mock.calls.filter(
      ([, id]) => id === SCENE_SESSION.sessionId
    )
    expect(leadCalls).toHaveLength(0)
  })
})

describe('WorktreeDiffBox status region', () => {
  it('announces the summary in the same status region that said it was loading', async () => {
    let finish: (result: IpcResult<WorktreeDiffsDto>) => void = () => undefined
    const pending = new Promise<IpcResult<WorktreeDiffsDto>>((resolve) => {
      finish = resolve
    })
    await open({ diffs: { [SCENE_SESSION.sessionId]: pending } })
    const status = (await inspector().findByText('Loading the diff')).closest('[role="status"]')
    expect(status).not.toBeNull()

    finish(okDiff([{ path: 'a.ts', added: 3, deleted: 1 }]))

    await waitFor(() => {
      expect(status?.textContent).toContain('+3 −1 across 1 file')
    })
    expect(status?.isConnected).toBe(true)
  })

  it('keeps the branch line outside the status region', async () => {
    await open({ diffs: { [SCENE_SESSION.sessionId]: okDiff([]) } })
    await inspector().findByText('+0 −0 across 0 files')

    expect(inspector().getByText('feature/x').closest('[role="status"]')).toBeNull()
  })
})

describe('WorktreeDiffBox shared worktree announcement', () => {
  const SHARED_NOTE =
    'Shares the worktree of subagent a1f3c9e2 in the lead session, so its changes are part of that diff.'
  const sharedValue: WorktreeDiffsDto = {
    git: 'ok',
    agents: [],
    sharedWorktree: { lead: SCENE_SESSION, agentId: 'a1f3c9e2d4abc' }
  }
  const writerStatus = async (): Promise<HTMLElement> => {
    await userEvent.click(screen.getByRole('button', { name: /^writer/ }))
    await inspector().findByText('Teammate · own session')
    return inspector().getByRole('status')
  }

  it('says the shared worktree note once it arrives for a teammate, which had no box before', async () => {
    let finish: (result: IpcResult<WorktreeDiffsDto>) => void = () => undefined
    const pending = new Promise<IpcResult<WorktreeDiffsDto>>((resolve) => {
      finish = resolve
    })
    renderInspectorScene({ diffs: { [WRITER.sessionId]: pending } })
    const status = await writerStatus()
    expect(status.textContent).toBe('')

    finish({ ok: true, value: sharedValue })

    await waitFor(() => {
      expect(status.textContent).toBe(SHARED_NOTE)
    })
  })

  it('says nothing when the diffs were cached before the inspector opened', async () => {
    const client = createTestQueryClient()
    client.setQueryData(['worktreeDiffs', WRITER.projectDirName, WRITER.sessionId], sharedValue)
    renderInspectorScene({ client })

    const status = await writerStatus()
    await inspector().findByText(SHARED_NOTE, { ignore: VISIBLE_ONLY })

    expect(status.textContent).toBe('')
  })

  it('says nothing for a teammate that shares no worktree', async () => {
    const { client } = renderInspectorScene()

    const status = await writerStatus()
    await waitFor(() => {
      expect(
        client.getQueryState(['worktreeDiffs', WRITER.projectDirName, WRITER.sessionId])?.status
      ).toBe('success')
    })

    expect(status.textContent).toBe('')
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

    expect(
      await inspector().findByText(/Shares the worktree of subagent a1f3c9e2 /, {
        ignore: VISIBLE_ONLY
      })
    ).toBeTruthy()
    expect(inspector().getByRole('heading', { level: 3, name: 'Worktree diff' })).toBeTruthy()
  })

  it('shows the shared worktree even when git is unusable', async () => {
    renderInspectorScene({ diffs: { [WRITER.sessionId]: shared('git-not-found') } })

    await userEvent.click(screen.getByRole('button', { name: /^writer/ }))

    expect(
      await inspector().findByText(/Shares the worktree of subagent/, { ignore: VISIBLE_ONLY })
    ).toBeTruthy()
  })

  it('opens the lead’s session with that subagent selected from the button', async () => {
    renderInspectorScene({ diffs: { [WRITER.sessionId]: shared() } })
    await userEvent.click(screen.getByRole('button', { name: /^writer/ }))

    await userEvent.click(
      await inspector().findByRole('button', { name: `Show subagent ${shortId('a1f3c9e2d4abc')}` })
    )

    expect(useNavigationStore.getState()).toMatchObject({
      view: 'session',
      selectedSessionRef: SCENE_SESSION,
      selectedAgent: { kind: 'subagent', ownerRef: SCENE_SESSION, agentId: 'a1f3c9e2d4abc' }
    })
  })

  it('shows no box for a teammate that shares no worktree', async () => {
    const { client } = renderInspectorScene()

    await userEvent.click(screen.getByRole('button', { name: /^writer/ }))
    await inspector().findByText('Teammate · own session')
    await waitFor(() => {
      expect(
        client.getQueryState(['worktreeDiffs', WRITER.projectDirName, WRITER.sessionId])?.status
      ).toBe('success')
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

describe('WorktreeDiffBox for an archived session', () => {
  const NOT_AVAILABLE = "Diffs aren't available for archived sessions."
  const archivedDetail = { ...worktreeDetail, archived: true }
  const changes = okDiff([{ path: 'a.ts', added: 10, deleted: 2 }])

  it('says diffs are not available, and asks for none', async () => {
    const { api } = renderInspectorScene({
      detail: archivedDetail,
      diffs: { [SCENE_SESSION.sessionId]: changes }
    })

    await userEvent.click(screen.getByRole('button', { name: /^scout/ }))

    expect(await inspector().findByText(NOT_AVAILABLE)).toBeTruthy()
    expect(api.getWorktreeDiffs).not.toHaveBeenCalled()
    expect(inspector().queryByRole('button', { name: 'Open diff' })).toBeNull()
  })

  it('still names the branch the subagent ran on', async () => {
    renderInspectorScene({ detail: archivedDetail })

    await userEvent.click(screen.getByRole('button', { name: /^scout/ }))

    expect(await inspector().findByText('feature/x')).toBeTruthy()
  })

  it('shows the diffs of a session read from disk, with no such message', async () => {
    renderInspectorScene({
      detail: worktreeDetail,
      diffs: { [SCENE_SESSION.sessionId]: changes }
    })

    await userEvent.click(screen.getByRole('button', { name: /^scout/ }))

    expect(await inspector().findByText('+10 −2 across 1 file')).toBeTruthy()
    expect(inspector().queryByText(NOT_AVAILABLE)).toBeNull()
  })

  it('replaces diffs already shown once the detail refetches into the archived state', async () => {
    const { client } = renderInspectorScene({
      detail: worktreeDetail,
      diffs: { [SCENE_SESSION.sessionId]: changes }
    })
    await userEvent.click(screen.getByRole('button', { name: /^scout/ }))
    expect(await inspector().findByText('+10 −2 across 1 file')).toBeTruthy()

    act(() => {
      client.setQueryData(
        ['session', SCENE_SESSION.projectDirName, SCENE_SESSION.sessionId],
        archivedDetail
      )
    })

    expect(await inspector().findByText(NOT_AVAILABLE)).toBeTruthy()
    expect(inspector().queryByText('+10 −2 across 1 file')).toBeNull()
    expect(inspector().queryByRole('button', { name: 'Open diff' })).toBeNull()
  })

  it('shows no box for a teammate in its own archived session', async () => {
    const shared: IpcResult<WorktreeDiffsDto> = {
      ok: true,
      value: {
        git: 'ok',
        agents: [],
        sharedWorktree: { lead: SCENE_SESSION, agentId: 'a1f3c9e2d4abc' }
      }
    }
    const { api } = renderInspectorScene({
      sessions: { [WRITER.sessionId]: { ok: true, value: testDetail({ archived: true }) } },
      diffs: { [WRITER.sessionId]: shared }
    })

    await userEvent.click(screen.getByRole('button', { name: /^writer/ }))
    await inspector().findByText('Teammate · own session')

    expect(inspector().queryByRole('heading', { name: 'Worktree diff' })).toBeNull()
    expect(inspector().queryByText(/Shares the worktree/)).toBeNull()
    expect(api.getWorktreeDiffs).not.toHaveBeenCalled()
  })

  it('removes a shared worktree note already shown once the teammate session turns archived', async () => {
    const shared: IpcResult<WorktreeDiffsDto> = {
      ok: true,
      value: {
        git: 'ok',
        agents: [],
        sharedWorktree: { lead: SCENE_SESSION, agentId: 'a1f3c9e2d4abc' }
      }
    }
    const { client } = renderInspectorScene({ diffs: { [WRITER.sessionId]: shared } })
    await userEvent.click(screen.getByRole('button', { name: /^writer/ }))
    await inspector().findByText(/Shares the worktree of subagent/, { ignore: VISIBLE_ONLY })

    act(() => {
      client.setQueryData(
        ['session', WRITER.projectDirName, WRITER.sessionId],
        testDetail({ archived: true })
      )
    })

    await waitFor(() => {
      expect(inspector().queryByRole('heading', { name: 'Worktree diff' })).toBeNull()
    })
    expect(inspector().queryByText(/Shares the worktree/, { ignore: VISIBLE_ONLY })).toBeNull()
  })
})

describe('WorktreeDiffBox when a session turns archived', () => {
  const NOT_AVAILABLE = "Diffs aren't available for archived sessions."
  const archivedDetail = { ...worktreeDetail, archived: true }
  const changes = okDiff([{ path: 'a.ts', added: 10, deleted: 2 }])
  const LEAD_KEY = ['session', SCENE_SESSION.projectDirName, SCENE_SESSION.sessionId]

  /** Opens the scout's diff box with its changes shown, returning the client and the box's result region. */
  async function openWithDiffs(): Promise<{
    client: ReturnType<typeof createTestQueryClient>
    region: HTMLElement
  }> {
    const { client } = renderInspectorScene({
      detail: worktreeDetail,
      diffs: { [SCENE_SESSION.sessionId]: changes }
    })
    await userEvent.click(screen.getByRole('button', { name: /^scout/ }))
    const shown = await inspector().findByText('+10 −2 across 1 file')
    const region = shown.closest('[role="status"]')
    if (!(region instanceof HTMLElement)) throw new Error('the result region should exist')
    return { client, region }
  }

  it('announces the change in the status region that already held the diffs', async () => {
    const { client, region } = await openWithDiffs()

    act(() => {
      client.setQueryData(LEAD_KEY, archivedDetail)
    })

    await waitFor(() => {
      expect(region.textContent).toBe(NOT_AVAILABLE)
    })
    expect(region.isConnected).toBe(true)
  })

  it('moves focus to the message when it was on the Open diff button', async () => {
    const { client, region } = await openWithDiffs()
    const button = await inspector().findByRole('button', { name: 'Open diff' })
    act(() => {
      button.focus()
    })

    act(() => {
      client.setQueryData(LEAD_KEY, archivedDetail)
    })

    await waitFor(() => {
      expect(document.activeElement).toBe(region)
    })
  })

  it('moves focus to the message and closes the patch dialog that was open', async () => {
    const { client, region } = await openWithDiffs()
    await userEvent.click(await inspector().findByRole('button', { name: 'Open diff' }))
    await screen.findByRole('dialog')

    act(() => {
      client.setQueryData(LEAD_KEY, archivedDetail)
    })

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull()
    })
    expect(document.activeElement).toBe(region)
  })

  it('does not reopen the patch dialog when the session turns live again', async () => {
    const { client } = await openWithDiffs()
    await userEvent.click(await inspector().findByRole('button', { name: 'Open diff' }))
    await screen.findByRole('dialog')
    act(() => {
      client.setQueryData(LEAD_KEY, archivedDetail)
    })
    await inspector().findByText(NOT_AVAILABLE)

    act(() => {
      client.setQueryData(LEAD_KEY, worktreeDetail)
    })

    expect(await inspector().findByRole('button', { name: 'Open diff' })).toBeTruthy()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('leaves focus alone when it was somewhere else', async () => {
    const { client } = await openWithDiffs()
    const scoutNode = screen.getByRole('button', { name: /^scout/ })
    act(() => {
      scoutNode.focus()
    })

    act(() => {
      client.setQueryData(LEAD_KEY, archivedDetail)
    })

    await inspector().findByText(NOT_AVAILABLE)
    expect(document.activeElement).toBe(scoutNode)
  })

  it('leaves focus alone when nothing had it', async () => {
    const { client } = await openWithDiffs()
    act(() => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
    })

    act(() => {
      client.setQueryData(LEAD_KEY, archivedDetail)
    })

    await inspector().findByText(NOT_AVAILABLE)
    expect(document.activeElement).toBe(document.body)
  })

  it('leaves focus alone when it moved out of the box before the session turned archived', async () => {
    const { client } = await openWithDiffs()
    const button = await inspector().findByRole('button', { name: 'Open diff' })
    act(() => {
      button.focus()
    })
    const scoutNode = screen.getByRole('button', { name: /^scout/ })
    act(() => {
      scoutNode.focus()
    })

    act(() => {
      client.setQueryData(LEAD_KEY, archivedDetail)
    })

    await inspector().findByText(NOT_AVAILABLE)
    expect(document.activeElement).toBe(scoutNode)
  })

  it('still moves focus when the focused button reports a blur that names no element, as removing it does', async () => {
    const { client, region } = await openWithDiffs()
    const button = await inspector().findByRole('button', { name: 'Open diff' })
    act(() => {
      button.focus()
    })
    fireEvent.focusOut(button, { relatedTarget: null })

    act(() => {
      client.setQueryData(LEAD_KEY, archivedDetail)
    })

    await waitFor(() => {
      expect(document.activeElement).toBe(region)
    })
  })

  it('moves focus to a message when it was on a teammate’s shared worktree link', async () => {
    const shared: IpcResult<WorktreeDiffsDto> = {
      ok: true,
      value: {
        git: 'ok',
        agents: [],
        sharedWorktree: { lead: SCENE_SESSION, agentId: 'a1f3c9e2d4abc' }
      }
    }
    const { client } = renderInspectorScene({ diffs: { [WRITER.sessionId]: shared } })
    await userEvent.click(screen.getByRole('button', { name: /^writer/ }))
    const link = await inspector().findByRole('button', { name: /^Show subagent/ })
    act(() => {
      link.focus()
    })

    act(() => {
      client.setQueryData(
        ['session', WRITER.projectDirName, WRITER.sessionId],
        testDetail({ archived: true })
      )
    })

    const message = await inspector().findByText(NOT_AVAILABLE)
    expect(document.activeElement).toBe(message.closest('[role="status"]'))
  })
})
