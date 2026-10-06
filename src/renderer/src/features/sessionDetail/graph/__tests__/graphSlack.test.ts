import { describe, expect, it } from 'vitest'
import { centeredScroll, panSlack, scrollAfterZoom } from '../graphSlack'

describe('panSlack', () => {
  it('leaves half the view on each side, so the graph’s edge can reach the middle', () => {
    expect(panSlack({ width: 1000, height: 600 })).toEqual({ width: 500, height: 300 })
  })

  it('is zero for a view with no size', () => {
    expect(panSlack({ width: 0, height: 0 })).toEqual({ width: 0, height: 0 })
  })

  it('leaves room for focus scrolling to bring a node clear of the scroll padding in the smallest view', () => {
    // The padding is the 44px target size on every side, and 56px at the bottom, where it also
    // clears the zoom controls (the 44px target plus a 12px inset). A node sits at least that far
    // in from the graph's edge, so room as deep as the padding on each side is enough.
    const smallest = panSlack({ width: 88, height: 160 })

    expect(smallest.width).toBeGreaterThanOrEqual(44)
    expect(smallest.height).toBeGreaterThanOrEqual(56)
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
