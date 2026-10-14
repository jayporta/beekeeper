import { describe, expect, it } from 'vitest'
import { hunksToPatch } from '../hunksToPatch'

describe('hunksToPatch', () => {
  it('joins hunks in order, each under its @@ header', () => {
    const patch = hunksToPatch([
      { oldStart: 1, oldLines: 2, newStart: 1, newLines: 2, lines: [' a', '-b', '+c'] },
      { oldStart: 9, oldLines: 1, newStart: 9, newLines: 2, lines: ['+d'] }
    ])

    expect(patch).toBe('@@ -1,2 +1,2 @@\n a\n-b\n+c\n@@ -9,1 +9,2 @@\n+d\n')
  })

  it('is empty for no hunks', () => {
    expect(hunksToPatch([])).toBe('')
  })
})
