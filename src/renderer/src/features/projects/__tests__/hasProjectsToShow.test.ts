import { describe, expect, it } from 'vitest'
import { hasProjectsToShow } from '../hasProjectsToShow'

describe('hasProjectsToShow', () => {
  it('is false before the list has loaded', () => {
    expect(hasProjectsToShow(undefined)).toBe(false)
  })

  it('is false for an empty list', () => {
    expect(hasProjectsToShow([])).toBe(false)
  })

  it('is true for a list with one project', () => {
    expect(hasProjectsToShow([{ dirName: '-a' }])).toBe(true)
  })

  it('is false for data that is not a list', () => {
    expect(hasProjectsToShow({ length: 1 })).toBe(false)
  })
})
