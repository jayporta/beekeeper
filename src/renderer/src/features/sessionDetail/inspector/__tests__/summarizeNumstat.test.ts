import { describe, expect, it } from 'vitest'
import { summarizeNumstat } from '../summarizeNumstat'

describe('summarizeNumstat', () => {
  it('sums the lines added and deleted across files', () => {
    const files = [
      { path: 'a.ts', added: 10, deleted: 2 },
      { path: 'b.ts', added: 5, deleted: 0 }
    ]

    expect(summarizeNumstat(files)).toEqual({ added: 15, deleted: 2, files: 2 })
  })

  it('counts a binary file as a file with no lines', () => {
    const files = [
      { path: 'a.ts', added: 3, deleted: 1 },
      { path: 'logo.png', added: null, deleted: null }
    ]

    expect(summarizeNumstat(files)).toEqual({ added: 3, deleted: 1, files: 2 })
  })

  it('counts a renamed file once', () => {
    expect(summarizeNumstat([{ path: 'new.ts', oldPath: 'old.ts', added: 1, deleted: 1 }])).toEqual(
      {
        added: 1,
        deleted: 1,
        files: 1
      }
    )
  })

  it('is empty for no files', () => {
    expect(summarizeNumstat([])).toEqual({ added: 0, deleted: 0, files: 0 })
  })
})
