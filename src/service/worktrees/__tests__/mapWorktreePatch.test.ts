import { describe, expect, it } from 'vitest'
import { MAX_FILE_PATCH_BYTES } from '../../../core/git/capPatches'
import { err, ok } from '../../../core/shared/result'
import { mapWorktreePatch } from '../mapWorktreePatch'

describe('mapWorktreePatch', () => {
  it('maps a failure to its code alone', () => {
    expect(mapWorktreePatch(err('branch-not-found'))).toEqual({
      kind: 'failed',
      code: 'branch-not-found'
    })
  })

  it('maps patches to text, with the uncommitted status and no truncation', () => {
    const result = ok({
      uncommitted: 'included' as const,
      files: [
        { path: 'a.ts', patch: Buffer.from('+a\n') },
        { path: 'b.ts', oldPath: 'old.ts', patch: Buffer.from('rename\n') }
      ]
    })

    expect(mapWorktreePatch(result)).toEqual({
      kind: 'ready',
      uncommitted: 'included',
      files: [
        { path: 'a.ts', patch: '+a\n', truncated: false },
        { path: 'b.ts', oldPath: 'old.ts', patch: 'rename\n', truncated: false }
      ],
      truncatedTotal: false
    })
  })

  it('applies the size caps and reports a cut', () => {
    const big = Buffer.from('+x\n'.repeat(MAX_FILE_PATCH_BYTES))

    const mapped = mapWorktreePatch(
      ok({ uncommitted: 'no-worktree' as const, files: [{ path: 'big.ts', patch: big }] })
    )

    expect(mapped.kind === 'ready' && mapped.files[0]?.truncated).toBe(true)
    expect(
      mapped.kind === 'ready' && Buffer.byteLength(mapped.files[0]?.patch ?? '')
    ).toBeLessThanOrEqual(MAX_FILE_PATCH_BYTES)
  })

  it('copies no field the DTO does not name', () => {
    const file = { path: 'a.ts', patch: Buffer.from('+a\n'), secret: 'nope' }

    const mapped = mapWorktreePatch(ok({ uncommitted: 'included' as const, files: [file] }))

    expect(mapped.kind === 'ready' && Object.keys(mapped.files[0] ?? {}).sort()).toEqual([
      'patch',
      'path',
      'truncated'
    ])
  })
})
