import { fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GraphViewport } from '../GraphViewport'
import { ZOOM_STEP } from '../graphZoom'
import { renderGraph } from '../testGraphScene'
import {
  flushScrollEvents,
  modelScrollClamp,
  press,
  sizeView,
  sizer,
  stopModelingScrollClamp,
  surface,
  viewport,
  type ViewBox
} from '../testGraphViewport'
import { stubResizeObserver } from '../testResizeObserver'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  stopModelingScrollClamp()
})

/**
 * Renders the scene's graph, which is 476 by 346 pixels at scale 1, in a view of the given size with
 * the browser's scroll clamping modeled, and reports the view's first size.
 */
const renderSizedGraph = (
  view: ViewBox = { width: 1000, height: 600 }
): ReturnType<typeof stubResizeObserver> => {
  const resizing = stubResizeObserver()
  sizeView(view)
  renderGraph()
  modelScrollClamp()
  resizing.resize()
  return resizing
}

// A 1000 by 600 view leaves 524 by 300 of room beside the graph: the graph is narrower than half
// the view, which leaves the rest of it, and taller than half the view, which leaves half.
describe('GraphCanvas room to pan', () => {
  it('scrolls the graph’s top left to the view’s top left once the view has a size', () => {
    renderSizedGraph()

    expect([viewport().scrollLeft, viewport().scrollTop]).toEqual([524, 300])
  })

  it('places the graph past the room before it', () => {
    renderSizedGraph()

    expect([surface().style.left, surface().style.top]).toEqual(['524px', '300px'])
  })

  it('makes room to pan past every edge, by the view less the part kept in view', () => {
    renderSizedGraph()

    expect([sizer().style.width, sizer().style.height]).toEqual([
      `${476 + 2 * 524}px`,
      `${346 + 2 * 300}px`
    ])
  })

  it('pans a graph narrower than half the view inside the view', () => {
    renderSizedGraph()

    fireEvent.pointerDown(viewport(), { clientX: 200, clientY: 200, button: 0, pointerId: 1 })
    fireEvent.pointerMove(viewport(), { clientX: 500, clientY: 200, pointerId: 1 })

    // The graph is now 300 pixels in from the view's left.
    expect(viewport().scrollLeft).toBe(224)
  })

  it('pans a graph narrower than half the view to the view’s right edge but not past it', () => {
    renderSizedGraph()

    fireEvent.pointerDown(viewport(), { clientX: 200, clientY: 200, button: 0, pointerId: 1 })
    fireEvent.pointerMove(viewport(), { clientX: 2200, clientY: 200, pointerId: 1 })

    const graphRight = Number.parseFloat(surface().style.left) - viewport().scrollLeft + 476
    expect(graphRight).toBe(1000)
  })

  it('leaves half the view around a graph that zooming makes bigger than half of it', async () => {
    renderSizedGraph()

    await press('Zoom in')

    expect(Number.parseFloat(sizer().style.width)).toBeCloseTo(476 * ZOOM_STEP + 2 * 500)
  })

  it('keeps the graph where it is on screen when the view narrows', () => {
    const resizing = renderSizedGraph()
    viewport().scrollLeft = 300

    sizeView({ width: 800, height: 600 })
    resizing.resize()

    // The room before the graph goes from 524 to 400, so the graph stays 224 in from the view's left.
    expect(viewport().scrollLeft).toBe(176)
  })

  it('keeps the graph’s top where it is on screen when the view grows taller', () => {
    const resizing = renderSizedGraph()

    sizeView({ width: 1000, height: 700 })
    resizing.resize()

    // Half a 600 view is less than the graph's height, but half a 700 view is not, so the room
    // before the graph goes from 300 to 354.
    expect(viewport().scrollTop).toBe(354)
  })

  it('keeps the graph where it is on screen when the view grows although the browser clamped the offset first', () => {
    const resizing = renderSizedGraph({ width: 600, height: 400 })
    viewport().scrollLeft = 450

    // The browser lays the wider view out against the old content, whose end is then 436 in, before
    // the observer reports.
    sizeView({ width: 640, height: 400 })
    resizing.resize()

    // The room before the graph goes from 300 to 320.
    expect(viewport().scrollLeft).toBe(470)
  })
})

describe('GraphCanvas room to pan when the graph changes size', () => {
  it('keeps the graph where it is on screen when the graph and then the view change size', () => {
    const resizing = stubResizeObserver()
    sizeView({ width: 1000, height: 800 })
    const { rerender } = render(
      <GraphViewport width={300} height={200}>
        <div />
      </GraphViewport>
    )
    modelScrollClamp()
    resizing.resize()
    viewport().scrollLeft = 500
    viewport().scrollTop = 500

    // The view narrows in the same commit as the graph grows. A graph narrower than half the view
    // leaves the rest of the view beside it, so the room before it goes from 700 by 600 to 600 by
    // 550, and the graph stays at 200 by 100 on screen.
    sizeView({ width: 900, height: 800 })
    rerender(
      <GraphViewport width={400} height={250}>
        <div />
      </GraphViewport>
    )
    // The room before the graph goes from 600 to 500 wide, and the graph stays at 200 on screen.
    resizing.resize()

    const graphLeft = Number.parseFloat(surface().style.left) - viewport().scrollLeft
    const graphTop = Number.parseFloat(surface().style.top) - viewport().scrollTop
    expect([graphLeft, graphTop]).toEqual([200, 100])
  })
})

describe('GraphCanvas room to pan in the narrow layout', () => {
  it('keeps the graph where it is on screen when the graph grows and the view grows taller with it', () => {
    const resizing = stubResizeObserver()
    sizeView({ width: 1000, height: 160 })
    const { rerender } = render(
      <GraphViewport width={300} height={60}>
        <div />
      </GraphViewport>
    )
    modelScrollClamp()
    resizing.resize()
    // Panned to the bottom of the view: the graph's top is 100 down, with 100 of room before it.
    viewport().scrollTop = 0

    // The view's height follows the graph's, so both change in one commit, and the room before the
    // graph goes from 100 to 103 once the view has been measured.
    sizeView({ width: 1000, height: 206 })
    rerender(
      <GraphViewport width={300} height={150}>
        <div />
      </GraphViewport>
    )
    resizing.resize()

    expect(Number.parseFloat(surface().style.top) - viewport().scrollTop).toBe(100)
  })
})

describe('GraphCanvas room to pan after a zoom in the next frame', () => {
  it('keeps the graph where it is on screen when the view resizes before the zoom’s scroll event arrives', async () => {
    const resizing = stubResizeObserver()
    sizeView({ width: 600, height: 400 })
    renderGraph()
    modelScrollClamp({ deferEvents: true })
    resizing.resize()
    flushScrollEvents()

    // The view's center is 300 by 200 into it, and so into the graph, which becomes 375 by 250
    // after the zoom.
    await press('Zoom in')
    // The wider view's size reaches the page before the zoom's `scroll` event does, so the event
    // finds the view's size not yet measured, and is not counted.
    sizeView({ width: 700, height: 400 })
    flushScrollEvents()
    resizing.resize()

    const graphLeft = Number.parseFloat(surface().style.left) - viewport().scrollLeft
    const graphTop = Number.parseFloat(surface().style.top) - viewport().scrollTop
    expect([graphLeft + 375, graphTop + 250]).toEqual([300, 200])
  })
})

describe('GraphCanvas scroll tracking', () => {
  it('stops listening for scrolling once the graph is gone', () => {
    const { unmount } = renderGraph()
    const remove = vi.spyOn(viewport(), 'removeEventListener')

    unmount()

    expect(remove).toHaveBeenCalledWith('scroll', expect.any(Function))
  })
})

describe('GraphCanvas view height', () => {
  it('is set from the graph’s full size, which zooming doesn’t change', async () => {
    renderGraph()
    expect(viewport().style.getPropertyValue('--graph-height')).toBe('346px')

    await press('Zoom in')

    expect(viewport().style.getPropertyValue('--graph-height')).toBe('346px')
  })
})
