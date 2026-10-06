import { fireEvent } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ZOOM_STEP } from '../graphZoom'
import { renderGraph } from '../testGraphScene'
import { press, sizeView, sizer, surface, viewport } from '../testGraphViewport'
import { stubResizeObserver } from '../testResizeObserver'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

/** The scene's graph is 476 by 346 pixels at scale 1, and a 1000 by 600 view leaves 500 by 300 of room per side. */
const renderSizedGraph = (): ReturnType<typeof stubResizeObserver> => {
  const resizing = stubResizeObserver()
  sizeView({ width: 1000, height: 600 })
  renderGraph()
  resizing.resize()
  return resizing
}

describe('GraphCanvas room to pan', () => {
  it('scrolls the graph’s top left to the view’s top left once the view has a size', () => {
    renderSizedGraph()

    expect([viewport().scrollLeft, viewport().scrollTop]).toEqual([500, 300])
  })

  it('places the graph past the room before it', () => {
    renderSizedGraph()

    expect([surface().style.left, surface().style.top]).toEqual(['500px', '300px'])
  })

  it('makes room to pan past every edge of a graph narrower than the view', () => {
    renderSizedGraph()

    expect([sizer().style.width, sizer().style.height]).toEqual([
      `${476 + 2 * 500}px`,
      `${346 + 2 * 300}px`
    ])
  })

  it('pans past the graph’s left edge in a view wider than it', () => {
    renderSizedGraph()

    fireEvent.pointerDown(viewport(), { clientX: 200, clientY: 200, button: 0, pointerId: 1 })
    fireEvent.pointerMove(viewport(), { clientX: 500, clientY: 200, pointerId: 1 })

    // The graph is now 300 pixels in from the view's left.
    expect(viewport().scrollLeft).toBe(200)
  })

  it('keeps the room around the graph the same at any zoom', async () => {
    renderSizedGraph()

    await press('Zoom in')

    expect(Number.parseFloat(sizer().style.width)).toBeCloseTo(476 * ZOOM_STEP + 2 * 500)
  })

  it('keeps the graph where it is on screen when the view narrows', () => {
    const resizing = renderSizedGraph()
    viewport().scrollLeft = 700

    sizeView({ width: 800, height: 600 })
    resizing.resize()

    expect(viewport().scrollLeft).toBe(600)
  })

  it('keeps the graph’s top where it is on screen when the view grows taller', () => {
    const resizing = renderSizedGraph()

    sizeView({ width: 1000, height: 700 })
    resizing.resize()

    expect(viewport().scrollTop).toBe(350)
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
