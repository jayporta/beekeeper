import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useNavigationStore } from '@renderer/features/navigation/state/useNavigationStore'
import { MAX_SCALE, MIN_SCALE, ZOOM_STEP } from '../graphZoom'
import { graphNode, renderGraph } from '../testGraphScene'

afterEach(() => {
  vi.restoreAllMocks()
  useNavigationStore.getState().reset()
})

/** The box the graph is scaled in: the node's parent. */
const surface = (): HTMLElement => graphNode(/^Lead/).parentElement as HTMLElement
/** The element that scrolls and pans: the surface's grandparent. */
const viewport = (): HTMLElement => surface().parentElement?.parentElement as HTMLElement
const scale = (): number => Number(/scale\(([\d.]+)\)/.exec(surface().style.transform)?.[1])

const press = async (name: string): Promise<void> => {
  await userEvent.click(screen.getByRole('button', { name }))
}

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
    const sizer = surface().parentElement as HTMLElement
    const before = sizer.style.width

    await press('Zoom in')

    expect(Number.parseFloat(sizer.style.width)).toBeCloseTo(Number.parseFloat(before) * ZOOM_STEP)
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

describe('GraphCanvas fit', () => {
  /** The scene's graph is 476 by 346 pixels. */
  const sizeViewport = (width: number, height: number): void => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(width)
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(height)
  }

  it('scales the whole graph into a view narrower than it', async () => {
    renderGraph()
    sizeViewport(238, 1000)

    await press('Fit the graph to the view')

    expect(scale()).toBeCloseTo(0.5)
  })

  it('scales by the height when the view is shorter than the graph', async () => {
    renderGraph()
    sizeViewport(1000, 173)

    await press('Fit the graph to the view')

    expect(scale()).toBeCloseTo(0.5)
  })

  it('does not magnify a graph that already fits', async () => {
    renderGraph()
    sizeViewport(5000, 5000)
    await press('Zoom in')

    await press('Fit the graph to the view')

    expect(scale()).toBe(1)
  })

  it('scrolls back to the top left', async () => {
    renderGraph()
    sizeViewport(238, 1000)
    viewport().scrollLeft = 80
    viewport().scrollTop = 60

    await press('Fit the graph to the view')

    expect([viewport().scrollLeft, viewport().scrollTop]).toEqual([0, 0])
  })

  it('leaves the scale and the scrollable area alone while the view has no size', async () => {
    renderGraph()
    await press('Zoom in')
    const sizer = surface().parentElement as HTMLElement
    const before = sizer.style.width

    await press('Fit the graph to the view')

    expect(scale()).toBeCloseTo(ZOOM_STEP)
    expect(sizer.style.width).toBe(before)
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
