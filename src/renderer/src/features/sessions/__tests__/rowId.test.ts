import { describe, expect, it } from 'vitest'
import { rowId } from '../rowId'

describe('rowId', () => {
  it('returns an id without whitespace for a folder name that contains a space', () => {
    expect(rowId('-Users-me-My Repo/abc')).not.toMatch(/\s/)
  })

  it('returns different ids for keys that differ only in whitespace', () => {
    expect(rowId('a b/c')).not.toBe(rowId('a\tb/c'))
  })
})
