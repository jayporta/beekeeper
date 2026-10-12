import { describe, expect, it } from 'vitest'
import { isGroupExpanded } from '../state/isGroupExpanded'

describe('isGroupExpanded', () => {
  it('follows the current page when the person chose nothing', () => {
    expect(isGroupExpanded({}, { dirName: '-a', holdsCurrent: true })).toBe(true)
    expect(isGroupExpanded({}, { dirName: '-a', holdsCurrent: false })).toBe(false)
  })

  it('keeps a group the person closed closed, though it holds the current page', () => {
    expect(isGroupExpanded({ '-a': false }, { dirName: '-a', holdsCurrent: true })).toBe(false)
  })

  it('keeps a group the person opened open, though it holds nothing current', () => {
    expect(isGroupExpanded({ '-a': true }, { dirName: '-a', holdsCurrent: false })).toBe(true)
  })

  it('ignores a choice made for another group', () => {
    expect(isGroupExpanded({ '-b': true }, { dirName: '-a', holdsCurrent: false })).toBe(false)
  })
})
