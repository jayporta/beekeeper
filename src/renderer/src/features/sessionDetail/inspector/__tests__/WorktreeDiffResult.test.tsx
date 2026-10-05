import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type {
  AgentWorktreeDiffDto,
  UncommittedStatusDto,
  WorktreeDiffsDto
} from '../../../../../../shared/ipc/worktreeDiffDto'
import { WorktreeDiffResult } from '../WorktreeDiffResult'

const DIFFS: WorktreeDiffsDto = { git: 'ok', agents: [], sharedWorktree: null }

const entryOf = (
  uncommitted: UncommittedStatusDto,
  untracked: readonly string[] = []
): AgentWorktreeDiffDto => ({
  agentId: 'a1',
  inferredBase: false,
  result: {
    ok: true,
    diff: { uncommitted, files: [{ path: 'a.ts', added: 3, deleted: 1 }], untracked }
  }
})

describe('WorktreeDiffResult untracked files', () => {
  it('counts untracked paths apart from the changed files', () => {
    render(<WorktreeDiffResult diffs={DIFFS} entry={entryOf('included', ['x.ts', 'dir/'])} />)

    expect(screen.getByText(/\+3 −1 across 1 file/).textContent).toContain('2 untracked')
  })

  it('says nothing about untracked files when there are none', () => {
    render(<WorktreeDiffResult diffs={DIFFS} entry={entryOf('included')} />)

    expect(screen.getByText(/\+3 −1 across 1 file/).textContent).not.toContain('untracked')
  })
})

describe('WorktreeDiffResult uncommitted work', () => {
  it('says uncommitted work is left out when a git filter would have to run', () => {
    render(<WorktreeDiffResult diffs={DIFFS} entry={entryOf('skipped-filters')} />)

    expect(screen.getByText(/Uncommitted changes aren't included.*filter/)).toBeTruthy()
  })

  it('says uncommitted work is left out when the folder is not the agent’s worktree', () => {
    render(<WorktreeDiffResult diffs={DIFFS} entry={entryOf('worktree-mismatch')} />)

    expect(screen.getByText(/Uncommitted changes aren't included.*worktree/)).toBeTruthy()
  })

  it('says uncommitted work is left out when the agent’s worktree folder is not available', () => {
    render(<WorktreeDiffResult diffs={DIFFS} entry={entryOf('no-worktree')} />)

    expect(screen.getByText(/Uncommitted changes aren't included.*isn't available/)).toBeTruthy()
  })

  it('has no note when uncommitted work is included', () => {
    render(<WorktreeDiffResult diffs={DIFFS} entry={entryOf('included')} />)

    expect(screen.queryByText(/Uncommitted changes/)).toBeNull()
  })
})
