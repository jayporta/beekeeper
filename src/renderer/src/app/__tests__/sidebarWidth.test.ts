import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SIDEBAR_WIDTH,
  MAX_SIDEBAR_WIDTH,
  MIN_SIDEBAR_WIDTH,
  clampSidebarWidth,
  sidebarMaxWidth
} from '../sidebarWidth'

describe('sidebarMaxWidth', () => {
  it('caps a wide window at the absolute maximum', () => {
    expect(sidebarMaxWidth(2000)).toBe(MAX_SIDEBAR_WIDTH)
  })

  it('caps a mid-size window at 45% of its width', () => {
    expect(sidebarMaxWidth(1200)).toBe(540)
  })

  it('leaves main 400px in a window where that is the tighter limit', () => {
    expect(sidebarMaxWidth(720)).toBe(320)
  })

  it('never goes below the minimum', () => {
    expect(sidebarMaxWidth(300)).toBe(MIN_SIDEBAR_WIDTH)
  })
})

describe('clampSidebarWidth', () => {
  it('keeps a width inside the range', () => {
    expect(clampSidebarWidth(DEFAULT_SIDEBAR_WIDTH, 2000)).toBe(DEFAULT_SIDEBAR_WIDTH)
  })

  it('raises a width below the minimum', () => {
    expect(clampSidebarWidth(10, 2000)).toBe(MIN_SIDEBAR_WIDTH)
  })

  it('lowers a width above what the window leaves main', () => {
    expect(clampSidebarWidth(900, 1100)).toBe(495)
  })

  it('rounds to whole pixels', () => {
    expect(clampSidebarWidth(300.6, 2000)).toBe(301)
  })
})
