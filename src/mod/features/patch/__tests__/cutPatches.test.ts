import { describe, expect, it } from 'vitest'
import { cutPatches } from '../cutPatches'
import { dropLastHunk, hasHunk, keepWholeHunks } from '../hunks'
import type { PanePatchFile } from '../panePatch'

const HEADER = 'diff --git a/f b/f\n--- a/f\n+++ b/f\n'
const hunk = (n: number, size = 20): string => `@@ -${n} +${n} @@\n${'+'.repeat(size)}\n`

const file = (text: string, path = 'f'): PanePatchFile => ({
  path,
  oldPath: null,
  text,
  truncated: false
})

describe('hunks', () => {
  it('tells a patch with a hunk from one without', () => {
    expect(hasHunk(HEADER + hunk(1))).toBe(true)
    expect(hasHunk('diff --git a/x b/x\nBinary files differ\n')).toBe(false)
    expect(hasHunk('diff --git a/x b/x\n+@@ not a header\n')).toBe(false)
  })

  it('drops the last hunk and leaves a patch without hunks alone', () => {
    expect(dropLastHunk(HEADER + hunk(1) + hunk(2))).toBe(HEADER + hunk(1))
    expect(dropLastHunk(HEADER + hunk(1))).toBe(HEADER)
    expect(dropLastHunk('Binary files differ\n')).toBe('Binary files differ\n')
  })

  it('keeps whole hunks within a length, or nothing when the first does not fit', () => {
    const text = HEADER + hunk(1) + hunk(2) + hunk(3)

    expect(keepWholeHunks(text, text.length)).toBe(text)
    expect(keepWholeHunks(text, (HEADER + hunk(1) + hunk(2)).length + 5)).toBe(
      HEADER + hunk(1) + hunk(2)
    )
    expect(keepWholeHunks(text, HEADER.length + 5)).toBeNull()
  })
})

describe('cutPatches', () => {
  it('keeps every file that fits', () => {
    const files = [file(HEADER + hunk(1), 'a'), file(HEADER + hunk(1), 'b')]

    expect(cutPatches(files, 10_000)).toEqual({ files, omittedCount: 0 })
  })

  it('cuts the file that crosses the budget at a whole hunk, and drops the files after it', () => {
    const big = HEADER + hunk(1) + hunk(2) + hunk(3)
    const budget = (HEADER + hunk(1)).length + (HEADER + hunk(1) + hunk(2)).length + 3
    const files = [file(HEADER + hunk(1), 'a'), file(big, 'b'), file(HEADER + hunk(1), 'c')]

    const { files: kept, omittedCount } = cutPatches(files, budget)

    expect(kept.map((f) => f.path)).toEqual(['a', 'b'])
    expect(kept[1]).toMatchObject({ text: HEADER + hunk(1) + hunk(2), truncated: true })
    expect(omittedCount).toBe(1)
  })

  it('drops a file whose header and first hunk do not fit, and counts it', () => {
    const { files, omittedCount } = cutPatches([file(HEADER + hunk(1, 500))], 100)

    expect(files).toEqual([])
    expect(omittedCount).toBe(1)
  })

  it('never keeps more characters than the budget', () => {
    const files = Array.from({ length: 30 }, (_, i) => file(HEADER + hunk(1) + hunk(2), `f${i}`))

    const { files: kept } = cutPatches(files, 500)

    expect(kept.reduce((total, f) => total + f.text.length, 0)).toBeLessThanOrEqual(500)
  })

  it('counts a file the service left empty as omitted and keeps the rest', () => {
    const empty: PanePatchFile = { ...file(''), truncated: true }
    const { files, omittedCount } = cutPatches([empty, file(HEADER + hunk(1), 'b')], 10_000)

    expect(files.map((f) => f.path)).toEqual(['b'])
    expect(omittedCount).toBe(1)
  })
})
