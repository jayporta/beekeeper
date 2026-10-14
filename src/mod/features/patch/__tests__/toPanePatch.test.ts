import { describe, expect, it } from 'vitest'
import type { WorktreePatchFileDto } from '../../../../shared/ipc/worktreePatchDto'
import { PATCH_CHAR_BUDGET } from '../panePatch'
import { toPanePatch } from '../toPanePatch'

const IDS = { sessionId: 's1', key: 'sub:a1', nowMs: 5 }
const HEADER = 'diff --git a/f b/f\n--- a/f\n+++ b/f\n'
const hunk = (n: number): string => `@@ -${n} +${n} @@\n+line ${n}\n`

const dtoFile = (overrides: Partial<WorktreePatchFileDto> = {}): WorktreePatchFileDto => ({
  path: 'f',
  patch: HEADER + hunk(1),
  truncated: false,
  ...overrides
})

const readyOf = (files: WorktreePatchFileDto[]): ReturnType<typeof toPanePatch> =>
  toPanePatch({
    ...IDS,
    dto: { kind: 'ready', uncommitted: 'included', files, truncatedTotal: false }
  })

describe('toPanePatch', () => {
  it('carries the ids, the time and the uncommitted status', () => {
    expect(readyOf([dtoFile()])).toMatchObject({
      sessionId: 's1',
      key: 'sub:a1',
      status: 'ready',
      uncommitted: 'included',
      refreshedAtMs: 5,
      failure: null
    })
  })

  it('cleans paths and the patch text of control characters, keeping its newlines', () => {
    const patch = readyOf([
      dtoFile({
        path: 'a\u001b.ts',
        oldPath: 'b\r.ts',
        patch: HEADER + '@@ -1 +1 @@\n+x\u001b[31m\r\n'
      })
    ])

    const [file] = patch.files
    expect(file?.path).not.toContain('\u001b')
    expect(file?.oldPath).not.toContain('\r')
    expect(file?.text).not.toContain('\u001b')
    expect(file?.text).not.toContain('\r')
    expect(file?.text.split('\n')).toHaveLength(6)
  })

  it('trims a file the service cut back to its last whole hunk', () => {
    const [file] = readyOf([
      dtoFile({ patch: HEADER + hunk(1) + hunk(2) + '@@ -3 +3 @@\n+cu', truncated: true })
    ]).files

    expect(file).toMatchObject({ text: HEADER + hunk(1) + hunk(2), truncated: true })
  })

  it('counts a file the service left empty as omitted', () => {
    const patch = readyOf([dtoFile({ patch: '', truncated: true }), dtoFile({ path: 'b' })])

    expect(patch.files.map((f) => f.path)).toEqual(['b'])
    expect(patch.omittedCount).toBe(1)
  })

  it('keeps a 300 KB patch within the budget', () => {
    const big = HEADER + Array.from({ length: 5_000 }, (_, i) => hunk(i + 1)).join('')
    expect(big.length).toBeGreaterThan(100_000)

    const patch = readyOf([dtoFile({ patch: big }), dtoFile({ path: 'b' })])

    const total = patch.files.reduce((sum, f) => sum + f.text.length, 0)
    expect(total).toBeLessThanOrEqual(PATCH_CHAR_BUDGET)
    expect(patch.files[0]?.truncated).toBe(true)
    expect(patch.omittedCount).toBe(1)
  })

  it('maps unavailable git and a failed diff to a failure with no files', () => {
    expect(toPanePatch({ ...IDS, dto: { kind: 'unavailable', git: 'git-too-old' } })).toMatchObject(
      {
        status: 'ready',
        failure: { git: 'git-too-old' },
        files: []
      }
    )
    expect(toPanePatch({ ...IDS, dto: { kind: 'failed', code: 'timeout' } })).toMatchObject({
      failure: { code: 'timeout' },
      files: []
    })
  })
})
