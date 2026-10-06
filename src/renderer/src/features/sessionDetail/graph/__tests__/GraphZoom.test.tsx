import { fireEvent, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useNavigationStore } from '@renderer/features/navigation/state/useNavigationStore'
import { MAX_SCALE, MIN_SCALE, ZOOM_STEP } from '../graphZoom'
import { graphNode, renderGraph } from '../testGraphScene'
import {
  modelScrollClamp,
  press,
  scale,
  sizeView,
  sizer,
  stubControlsClearance,
  surface,
  viewport
} from '../testGraphViewport'
import { stubResizeObserver } from '../testResizeObserver'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  useNavigationStore.getState().reset()
})

describe('GraphCanvas zoom controls', () => {
  it('has labelled zoom out, fit and zoom in buttons in a group', () => {
    renderGraph()

    const group = screen.getByRole('group', { name: 'Zoom' })

    expect(group.querySelectorAll('button')).toHaveLength(3)
    for (const name of ['Zoom out', 'Fit the graph to the view', 'Zoom in']) {
      expect(screen.getByRole('button', { name })).toBeTruthy()
    }
  })

  it('starts at full size', () => {
    renderGraph()

    expect(scale()).toBe(1)
  })

  it('exposes the scale to the graph’s styles, so a node can keep its focus ring’s on-screen width', async () => {
    renderGraph()
    expect(surface().style.getPropertyValue('--graph-scale')).toBe('1')

    await press('Zoom in')

    expect(Number(surface().style.getPropertyValue('--graph-scale'))).toBeCloseTo(ZOOM_STEP)
  })

  it('magnifies by a step with zoom in, and shrinks by a step with zoom out', async () => {
    renderGraph()

    await press('Zoom in')
    expect(scale()).toBeCloseTo(ZOOM_STEP)

    await press('Zoom out')
    expect(scale()).toBeCloseTo(1)
  })

  it('stops zooming in at the maximum', async () => {
    renderGraph()

    for (let i = 0; i < 10; i += 1) await press('Zoom in')

    expect(scale()).toBe(MAX_SCALE)
  })

  it('stops zooming out at the minimum', async () => {
    renderGraph()

    for (let i = 0; i < 10; i += 1) await press('Zoom out')

    expect(scale()).toBe(MIN_SCALE)
  })

  it('sizes the scrollable area to the scaled graph', async () => {
    renderGraph()
    const before = sizer().style.width

    await press('Zoom in')

    expect(Number.parseFloat(sizer().style.width)).toBeCloseTo(
      Number.parseFloat(before) * ZOOM_STEP
    )
  })

  it('keeps the point at the center of the view where it was', async () => {
    renderGraph()
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(200)
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(100)
    viewport().scrollLeft = 40

    await press('Zoom in')

    // The point at 40 + 100 scrolled to 140 / 1 * 1.25 = 175 from the origin; the center stays at 100.
    expect(viewport().scrollLeft).toBeCloseTo((40 + 100) * ZOOM_STEP - 100)
  })
})

describe('GraphCanvas zoom with room around the graph', () => {
  it('keeps the point at the center of the view where it was', async () => {
    const resizing = stubResizeObserver()
    sizeView({ width: 200, height: 200 })
    renderGraph()
    modelScrollClamp()
    resizing.resize()

    await press('Zoom in')

    // The room before the graph is 100 each way. The center is 100 into the view and so into the
    // graph, which becomes 125 after the zoom.
    expect(viewport().scrollLeft).toBeCloseTo(100 + 125 - 100)
    expect(viewport().scrollTop).toBeCloseTo(100 + 125 - 100)
  })

  it('keeps the point under the pointer where it was when the wheel zooms', () => {
    const resizing = stubResizeObserver()
    sizeView({ width: 200, height: 200 })
    renderGraph()
    modelScrollClamp()
    resizing.resize()
    vi.spyOn(viewport(), 'getBoundingClientRect').mockReturnValue({ left: 50, top: 20 } as DOMRect)

    fireEvent.wheel(viewport(), { deltaY: -10, ctrlKey: true, clientX: 150, clientY: 120 })

    // The pointer is 100 into the view and so into the graph, which the zoom scales by the new scale.
    expect(viewport().scrollLeft).toBeCloseTo(100 + 100 * scale() - 100)
    expect(viewport().scrollTop).toBeCloseTo(100 + 100 * scale() - 100)
  })

  it('keeps the point under the pointer where it was when zooming grows a small graph past half the view', () => {
    const resizing = stubResizeObserver()
    sizeView({ width: 1000, height: 800 })
    renderGraph()
    modelScrollClamp()
    resizing.resize()
    vi.spyOn(viewport(), 'getBoundingClientRect').mockReturnValue({ left: 50, top: 20 } as DOMRect)

    // The graph is 476 wide, less than half the 1000 view, so 524 of room comes before it. Zooming
    // makes it wider than half, so 500 of room comes before it.
    fireEvent.wheel(viewport(), { deltaY: -10, ctrlKey: true, clientX: 250, clientY: 120 })

    // The pointer is 200 into the view and so into the graph, which the zoom scales by the new scale.
    expect(viewport().scrollLeft).toBeCloseTo(500 + 200 * scale() - 200)
  })
})

describe('GraphCanvas zoom out near the far edges', () => {
  it('keeps the center where it was although the browser clamps the offsets to the shrunken graph', async () => {
    sizeView({ width: 200, height: 100 })
    renderGraph()
    modelScrollClamp()
    await press('Zoom in')
    viewport().scrollLeft = 300
    viewport().scrollTop = 300

    await press('Zoom out')

    expect(viewport().scrollLeft).toBeCloseTo((300 + 100) / ZOOM_STEP - 100)
    expect(viewport().scrollTop).toBeCloseTo((300 + 50) / ZOOM_STEP - 50)
  })
})

describe('GraphCanvas fit', () => {
  it('scales the whole graph into a view narrower than it', async () => {
    sizeView({ width: 238, height: 1000 })
    renderGraph()

    await press('Fit the graph to the view')

    expect(scale()).toBeCloseTo(0.5)
  })

  it('scales by the height less the room the zoom controls cover', async () => {
    sizeView({ width: 1000, height: 273 })
    renderGraph()
    stubControlsClearance(100)

    await press('Fit the graph to the view')

    expect(scale()).toBeCloseTo(0.5)
  })

  it('gives the same scale however many times it is pressed', async () => {
    sizeView({ width: 1000, height: 300 })
    renderGraph()
    stubControlsClearance(56)
    await press('Zoom out')
    await press('Zoom out')

    const scales: number[] = []
    for (let i = 0; i < 3; i += 1) {
      await press('Fit the graph to the view')
      scales.push(scale())
    }

    expect(scales[0]).toBeCloseTo((300 - 56) / 346)
    expect(scales[1]).toBeCloseTo(scales[0] ?? NaN)
    expect(scales[2]).toBeCloseTo(scales[0] ?? NaN)
  })

  it('does not magnify a graph that already fits', async () => {
    sizeView({ width: 5000, height: 5000 })
    renderGraph()
    await press('Zoom in')

    await press('Fit the graph to the view')

    expect(scale()).toBe(1)
  })

  it('centers the fitted graph in the room above the zoom controls, with the room it has at its new scale', async () => {
    const resizing = stubResizeObserver()
    sizeView({ width: 900, height: 400 })
    renderGraph()
    modelScrollClamp()
    stubControlsClearance(100)
    resizing.resize()

    await press('Fit the graph to the view')

    // The 300 pixel room above the controls fits the graph at 300 / 346, so it is narrower than
    // half the 900 view and has more room beside it than it had at full size.
    const fitted = { width: 476 * (300 / 346), height: 300 }
    const graphLeft = Number.parseFloat(surface().style.left) - viewport().scrollLeft
    const graphTop = Number.parseFloat(surface().style.top) - viewport().scrollTop
    expect(graphLeft).toBeCloseTo((900 - fitted.width) / 2)
    expect(graphTop).toBeCloseTo((300 - fitted.height) / 2)
  })

  it('leaves the scale and the scrollable area alone while the view has no size', async () => {
    renderGraph()
    await press('Zoom in')
    const before = sizer().style.width

    await press('Fit the graph to the view')

    expect(scale()).toBeCloseTo(ZOOM_STEP)
    expect(sizer().style.width).toBe(before)
  })
})

describe('GraphCanvas wheel', () => {
  it.each([['ctrlKey'], ['metaKey']])('zooms with %s and the wheel turned up', (modifier) => {
    renderGraph()

    fireEvent.wheel(viewport(), { deltaY: -100, [modifier]: true })

    expect(scale()).toBeGreaterThan(1)
  })

  it('keeps the point under the pointer where it was', () => {
    renderGraph()
    vi.spyOn(viewport(), 'getBoundingClientRect').mockReturnValue({
      left: 50,
      top: 20
    } as DOMRect)
    viewport().scrollLeft = 40
    viewport().scrollTop = 10

    fireEvent.wheel(viewport(), { deltaY: -100, ctrlKey: true, clientX: 150, clientY: 70 })

    const ratio = scale()
    expect(viewport().scrollLeft).toBeCloseTo((40 + 100) * ratio - 100)
    expect(viewport().scrollTop).toBeCloseTo((10 + 50) * ratio - 50)
  })

  it('zooms out when the wheel turns down with Ctrl', () => {
    renderGraph()

    fireEvent.wheel(viewport(), { deltaY: 100, ctrlKey: true })

    expect(scale()).toBeLessThan(1)
  })

  it('cancels the browser’s own zoom when it zooms', () => {
    renderGraph()

    expect(fireEvent.wheel(viewport(), { deltaY: -100, ctrlKey: true })).toBe(false)
  })

  it('leaves a plain wheel turn alone, so the page scrolls as usual', () => {
    renderGraph()

    const notPrevented = fireEvent.wheel(viewport(), { deltaY: -100 })

    expect(notPrevented).toBe(true)
    expect(scale()).toBe(1)
  })

  it('stays within the limits however far the wheel turns', () => {
    renderGraph()

    fireEvent.wheel(viewport(), { deltaY: -1e6, ctrlKey: true })
    expect(scale()).toBe(MAX_SCALE)

    fireEvent.wheel(viewport(), { deltaY: 1e6, ctrlKey: true })
    expect(scale()).toBe(MIN_SCALE)
  })

  it('listens once, however many times the scale changes', async () => {
    const add = vi.spyOn(HTMLElement.prototype, 'addEventListener')
    renderGraph()

    await press('Zoom in')
    await press('Zoom in')
    fireEvent.wheel(viewport(), { deltaY: -100, ctrlKey: true })

    const onViewport = add.mock.calls.filter(
      ([type], call) => type === 'wheel' && add.mock.contexts[call] === viewport()
    )
    expect(onViewport).toHaveLength(1)
  })

  it('zooms from the scale the last change left, not the one it first saw', async () => {
    renderGraph()
    await press('Zoom in')

    fireEvent.wheel(viewport(), { deltaY: 0, ctrlKey: true })

    expect(scale()).toBeCloseTo(ZOOM_STEP)
  })

  it('stops listening once the graph is gone', () => {
    const { unmount } = renderGraph()
    const element = viewport()
    const remove = vi.spyOn(element, 'removeEventListener')

    unmount()

    expect(remove).toHaveBeenCalledWith('wheel', expect.any(Function))
  })
})

describe('GraphCanvas pan', () => {
  const down = (target: Element, x: number, y: number): void => {
    fireEvent.pointerDown(target, { clientX: x, clientY: y, button: 0, pointerId: 1 })
  }
  const move = (target: Element, x: number, y: number): void => {
    fireEvent.pointerMove(target, { clientX: x, clientY: y, pointerId: 1 })
  }

  it('scrolls the view by how far the background is dragged', () => {
    renderGraph()
    viewport().scrollLeft = 100
    viewport().scrollTop = 50

    down(viewport(), 200, 200)
    move(viewport(), 170, 220)

    expect([viewport().scrollLeft, viewport().scrollTop]).toEqual([130, 30])
  })

  it('keeps following the pointer from where it last was', () => {
    renderGraph()
    viewport().scrollLeft = 100

    down(viewport(), 200, 200)
    move(viewport(), 190, 200)
    move(viewport(), 180, 200)

    expect(viewport().scrollLeft).toBe(120)
  })

  it('does not pan from a press on a node', () => {
    renderGraph()
    viewport().scrollLeft = 100

    down(graphNode(/^scout/), 200, 200)
    move(viewport(), 100, 200)

    expect(viewport().scrollLeft).toBe(100)
  })

  it('does not pan from any button but the primary', () => {
    renderGraph()
    viewport().scrollLeft = 100

    fireEvent.pointerDown(viewport(), { clientX: 200, clientY: 200, button: 2, pointerId: 1 })
    move(viewport(), 100, 200)

    expect(viewport().scrollLeft).toBe(100)
  })

  it('stops panning when the pointer is released', () => {
    renderGraph()
    viewport().scrollLeft = 100

    down(viewport(), 200, 200)
    fireEvent.pointerUp(viewport(), { pointerId: 1 })
    move(viewport(), 100, 200)

    expect(viewport().scrollLeft).toBe(100)
  })

  it('stops panning when the browser cancels the pointer', () => {
    renderGraph()
    viewport().scrollLeft = 100

    down(viewport(), 200, 200)
    fireEvent.pointerCancel(viewport(), { pointerId: 1 })
    move(viewport(), 100, 200)

    expect(viewport().scrollLeft).toBe(100)
  })

  it('does nothing when the pointer moves without a press', () => {
    renderGraph()
    viewport().scrollLeft = 100

    move(viewport(), 100, 200)

    expect(viewport().scrollLeft).toBe(100)
  })
})
