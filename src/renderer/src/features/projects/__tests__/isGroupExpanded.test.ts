import { describe, expect, it } from 'vitest'
import { isGroupExpanded } from '../state/isGroupExpanded'

describe('isGroupExpanded', () => {
  it('follows the current page when the person chose nothing', () => {
    expect(isGroupExpanded(undefined, true)).toBe(true)
    expect(isGroupExpanded(undefined, false)).toBe(false)
  })

  it('keeps a group the person closed closed, though it holds the current page', () => {
    expect(isGroupExpanded(false, true)).toBe(false)
  })

  it('keeps a group the person opened open, though it holds nothing current', () => {
    expect(isGroupExpanded(true, false)).toBe(true)
  })
})
