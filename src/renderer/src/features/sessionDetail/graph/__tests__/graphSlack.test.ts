import { describe, expect, it } from 'vitest'
import { COLUMN_WIDTH, NODE_WIDTH, ORIGIN_X } from '../graphMetrics'
import { PAN_KEEP, centeredScroll, panSlack, scrollAfterZoom } from '../graphSlack'

describe('panSlack', () => {
  it('leaves the kept strip of a view out of the room on each side', () => {
    expect(panSlack({ width: 1000, height: 600 }, 0)).toEqual({ width: 904, height: 504 })
  })

  it('also leaves the room the zoom controls cover out of the room below the graph', () => {
    expect(panSlack({ width: 1000, height: 600 }, 100)).toEqual({ width: 904, height: 404 })
  })

  it('is zero for a view smaller than the kept strip', () => {
    expect(panSlack({ width: 40, height: 10 }, 0)).toEqual({ width: 0, height: 0 })
  })

  it('is zero in height for a view the kept strip and the controls fill', () => {
    expect(panSlack({ width: 1000, height: 150 }, 100).height).toBe(0)
  })

  it('keeps a 96 pixel strip', () => {
    expect(PAN_KEEP).toBe(96)
  })
})

describe('scrollAfterZoom', () => {
  it('matches a plain scale-around-the-anchor when there is no slack', () => {
    expect(scrollAfterZoom({ scroll: 100, anchor: 50, slack: 0, ratio: 2 })).toBe(250)
  })

  it('keeps the graph point under the anchor in place when there is slack', () => {
    // The point under the anchor is (940 + 100 - 900) = 140 into the graph, so
    // it is 175 after a 1.25 ratio, and the offset puts it back under the anchor.
    expect(scrollAfterZoom({ scroll: 940, anchor: 100, slack: 900, ratio: 1.25 })).toBe(975)
  })
})

describe('centeredScroll', () => {
  it('starts a graph smaller than the room halfway into it', () => {
    expect(centeredScroll({ slack: 900, content: 300, room: 500 })).toBe(800)
  })
})

describe('the room panSlack leaves', () => {
  it('leaves room to scroll any node to either edge of the view', () => {
    const view = 1000
    const scrollPadding = 44
    const graphWidth = 476
    const slack = panSlack({ width: view, height: view }, 0).width
    const maxScroll = graphWidth + 2 * slack - view

    const rightmostNodeLeft = ORIGIN_X + COLUMN_WIDTH
    const leftmostNodeRight = ORIGIN_X + NODE_WIDTH

    // A node left of the view scrolls in until its left edge is the padding in from the view's left.
    const scrollToLeftEdge = slack + rightmostNodeLeft - scrollPadding
    // A node right of the view scrolls in until its right edge is the padding in from the view's right.
    const scrollToRightEdge = slack + leftmostNodeRight - (view - scrollPadding)

    expect(scrollToLeftEdge).toBeLessThanOrEqual(maxScroll)
    expect(scrollToRightEdge).toBeGreaterThanOrEqual(0)
  })
})
