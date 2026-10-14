import { describe, expect, it } from 'vitest'
import type {
  AgentWorktreeDiffDto,
  NumstatEntryDto,
  WorktreeDiffsDto
} from '../../../../shared/ipc/worktreeDiffDto'
import { toPaneDiffs } from '../toPaneDiffs'

const IDS = { sessionId: 's1', key: 'sub:a1', agentId: 'a1', nowMs: 7 }

function okEntry(overrides: {
  files?: NumstatEntryDto[]
  untracked?: string[]
}): AgentWorktreeDiffDto {
  return {
    agentId: 'a1',
    inferredBase: false,
    result: {
      ok: true,
      diff: {
        uncommitted: 'included',
        files: overrides.files ?? [],
        untracked: overrides.untracked ?? []
      }
    }
  }
}

const dtoOf = (...agents: AgentWorktreeDiffDto[]): WorktreeDiffsDto => ({
  git: 'ok',
  agents,
  sharedWorktree: null
})

function diffOf(entry: AgentWorktreeDiffDto): ReturnType<typeof toPaneDiffs> {
  return toPaneDiffs({ ...IDS, dto: dtoOf(entry) })
}

describe('toPaneDiffs', () => {
  it('cleans paths and old paths of control characters', () => {
    const diffs = diffOf(
      okEntry({
        files: [{ path: 'a\u001b[31m.ts', oldPath: 'b\r.ts', added: 1, deleted: 0 }],
        untracked: ['n\u001bew.txt']
      })
    )

    expect(diffs.result).toMatchObject({
      files: [
        { path: expect.not.stringContaining('\u001b'), oldPath: expect.not.stringContaining('\r') }
      ],
      untracked: [expect.not.stringContaining('\u001b')]
    })
  })

  it('keeps null counts for a binary file and null for no old path', () => {
    const diffs = diffOf(okEntry({ files: [{ path: 'img.png', added: null, deleted: null }] }))

    expect(diffs.result).toMatchObject({
      files: [{ path: 'img.png', oldPath: null, added: null, deleted: null }]
    })
  })

  it('keeps the first 200 files and counts all of them', () => {
    const files = Array.from({ length: 250 }, (_, i) => ({ path: `f${i}`, added: 1, deleted: 0 }))

    const diffs = diffOf(okEntry({ files }))

    expect(diffs.result).toMatchObject({ ok: true, fileCount: 250 })
    expect(diffs.result?.ok && diffs.result.files).toHaveLength(200)
  })

  it('keeps the first 50 untracked paths and counts all of them', () => {
    const untracked = Array.from({ length: 60 }, (_, i) => `u${i}`)

    const diffs = diffOf(okEntry({ untracked }))

    expect(diffs.result).toMatchObject({ ok: true, untrackedCount: 60 })
    expect(diffs.result?.ok && diffs.result.untracked).toHaveLength(50)
  })

  it('maps a failed entry to its code and a ready status', () => {
    const diffs = diffOf({
      agentId: 'a1',
      inferredBase: false,
      result: { ok: false, code: 'branch-not-found' }
    })

    expect(diffs).toMatchObject({
      status: 'ready',
      git: 'ok',
      result: { ok: false, code: 'branch-not-found' }
    })
  })

  it('has no result when git is unavailable', () => {
    const diffs = toPaneDiffs({
      ...IDS,
      dto: { git: 'git-not-found', agents: [], sharedWorktree: null }
    })

    expect(diffs).toMatchObject({ git: 'git-not-found', result: null, status: 'ready' })
  })

  it('has no result when the service has no entry for the agent', () => {
    const diffs = toPaneDiffs({ ...IDS, dto: dtoOf({ ...okEntry({}), agentId: 'other' }) })

    expect(diffs.result).toBeNull()
  })

  it('carries the ids and the time', () => {
    expect(diffOf(okEntry({}))).toMatchObject({ sessionId: 's1', key: 'sub:a1', refreshedAtMs: 7 })
  })
})
